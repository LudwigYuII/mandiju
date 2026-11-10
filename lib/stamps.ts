import { db } from "./db";
import manifest from "@/data/manifest.json";
import { isSiteAnniversary, seasonalStamps } from "./calendar";
import { notify } from "./notify";
import { achievementsFor, unlockText } from "./achievements";

export function weatherCodeToStampId(code: number | null, gust: number | null): string | null {
  if (code == null) return null;
  if (code === 45 || code === 48) return "B11"; // 大雾
  if ([65, 66, 67, 82].includes(code)) return "B10"; // 暴雨
  if ([95, 96, 99].includes(code)) return "B13"; // 雷电
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "B09"; // 初雪
  if (gust != null && gust >= 30) return "B14"; // 大风
  return null;
}

export async function grantStamp(uid: string, stampId: string, source: string) {
  const r = await db.execute({
    sql: "INSERT OR IGNORE INTO user_stamps(user_id, stamp_id, acquired_at, source) VALUES(?,?,?,?)",
    args: [uid, stampId, Date.now(), source],
  });
  if (Number((r as any)?.rowsAffected ?? 0) > 0) {
    const def = (manifest.stamps as any[]).find((s) => s.id === stampId);
    await notify(uid, "stamp", `解锁新邮票：${def?.name ?? stampId}`, "/stamps");
  }
}

export async function ownedStampIds(uid: string): Promise<Set<string>> {
  const r = await db.execute({ sql: "SELECT stamp_id FROM user_stamps WHERE user_id=?", args: [uid] });
  return new Set(r.rows.map((x) => String(x.stamp_id)));
}

export async function availableStamps(uid: string) {
  const owned = await ownedStampIds(uid);
  const season = new Map(seasonalStamps().map((s) => [s.stampId, s]));
  return (manifest.stamps as any[]).filter(
    (s) => s.acquire.type === "common" || owned.has(s.id) || season.has(s.id)
  ).map((s) => {
    const se = season.get(s.id);
    return se ? { ...s, seasonal: se.label } : s;
  });
}

/** 是否处于当年发行窗口（可选用、用后解锁） */
export function isSeasonalStamp(stampId: string): { kind: string; name: string } | null {
  const s = seasonalStamps().find((x) => x.stampId === stampId);
  return s ? { kind: s.kind, name: s.name } : null;
}

export async function applySendGrants(uid: string, sent: number, weatherStampId: string | null) {
  if (sent === 10) await grantStamp(uid, "B05", "第10封信·成人礼");
  if (sent === 50) await grantStamp(uid, "B06", "第50封信");
  if (sent === 100) await grantStamp(uid, "B07", "第100封信");
  if (isSiteAnniversary()) await grantStamp(uid, "B08", "建站周年");
  if (weatherStampId) await grantStamp(uid, weatherStampId, "气候·随信");
  const u = await db.execute({ sql: "SELECT birthday FROM users WHERE id=?", args: [uid] });
  const bday = String(u.rows[0]?.birthday ?? "");
  if (bday) {
    const [m, d] = bday.split("-");
    const now = new Date();
    if (Number(m) === now.getMonth() + 1 && Number(d) === now.getDate()) {
      await grantStamp(uid, "B15", "生辰");
    }
  }
}

/** 已寄出封信数：与设置页「已寄出 N 封信」同一口径（users.letters_sent，含时光胶囊） */
export async function sentLetterCount(uid: string): Promise<number> {
  const r = await db.execute({ sql: "SELECT letters_sent FROM users WHERE id=?", args: [uid] });
  const n = Number((r.rows[0] as any)?.letters_sent ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 寄信里程碑解锁（幂等）：user_achievements 主键 (user_id, milestone)，
 * INSERT OR IGNORE 未命中则说明此前已发放过，不再重复通知。
 * 理想调用点是发信动作成功之后（lib/actions.ts），邮票册页也会兜底调用一次。
 */
export async function applyAchievementGrants(uid: string, sent?: number): Promise<void> {
  const count = sent ?? (await sentLetterCount(uid));
  const reached = achievementsFor(count).filter((a) => a.reached);
  if (reached.length === 0) return;
  // 先读已发放档位，避免每次进邮票册都发一轮无谓的写请求（读到空集才补发）
  const recorded = await db.execute({
    sql: "SELECT milestone FROM user_achievements WHERE user_id=?",
    args: [uid],
  });
  const done = new Set(recorded.rows.map((r) => Number((r as any).milestone)));
  for (const a of reached) {
    if (done.has(a.sent)) continue;
    const r = await db.execute({
      sql: "INSERT OR IGNORE INTO user_achievements(user_id, milestone, unlocked_at) VALUES(?,?,?)",
      args: [uid, a.sent, Date.now()],
    });
    if (Number((r as any)?.rowsAffected ?? 0) > 0) {
      await notify(uid, "stamp", `解锁寄信成就「${a.label}」：${unlockText(a)}`, "/stamps");
    }
  }
}
