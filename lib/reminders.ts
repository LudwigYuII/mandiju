// 每日提醒：生辰问候 + 节气/节日首日提醒（幂等，按当天去重）
import { db } from "./db";
import { notify } from "./notify";
import { sendMail } from "./mail";
import { todayFirstDay } from "./calendar";

function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** 当天是否已发过某类提醒 */
async function alreadySent(userId: string, type: string, dayStart: number): Promise<boolean> {
  const r = await db.execute({
    sql: "SELECT 1 FROM notifications WHERE user_id=? AND type=? AND created_at >= ? LIMIT 1",
    args: [userId, type, dayStart],
  });
  return r.rows.length > 0;
}

export async function runDailyReminders(now: Date = new Date()) {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const dayStart = startOfDay(now);

  // 生日问候：当天过生日的局友
  const bdayUsers = await db.execute({
    sql: "SELECT id, pen_name, email, birthday FROM users WHERE birthday IS NOT NULL",
  });
  for (const u of bdayUsers.rows as any[]) {
    const bd = String(u.birthday);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) continue;
    const [by, bm, bdd] = bd.split("-").map(Number);
    if (bm !== m || bdd !== d) continue;
    const uid = String(u.id);
    if (await alreadySent(uid, "birthday", dayStart)) continue;
    await notify(uid, "birthday", `生日快乐！今日寄信可盖「生辰」纪念票 🎂`, "/write");
    const email = String(u.email ?? "");
    if (email) {
      await sendMail(
        email,
        "慢递局 · 生日快乐",
        `${String(u.pen_name)}，生日快乐！今天在局里寄一封信，就能得到生辰纪念票。`
      );
    }
  }

  // 节气/节日首日：提醒全局限定票发行
  const fd = todayFirstDay(now);
  if (fd) {
    const all = await db.execute("SELECT id FROM users");
    for (const u of all.rows as any[]) {
      const uid = String(u.id);
      if (await alreadySent(uid, "festival", dayStart)) continue;
      await notify(
        uid,
        "festival",
        `今日${fd.name} · 限定票发行中，写信可选用并盖首日戳`,
        "/write"
      );
    }
  }
}
