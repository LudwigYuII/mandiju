// 邮件通知：接入 Resend（未配置时降级为控制台日志）
import { db } from "./db";
import { notify } from "./notify";
import { sendPushToUser } from "./push";

export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[MAIL] to=${to} | ${subject} | ${text}`);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "慢递局 <letters@ludwig.uno>",
        to: [to],
        subject,
        text,
      }),
    });
  } catch (e) {
    console.error("[MAIL] send failed:", e);
  }
}

/** 送达通知扫描：私信/胶囊送达后通知收件人（懒执行，随页面加载触发） */
export async function sweepDelivered() {
  const rows = await db.execute({
    sql: `SELECT l.id, l.title, l.recipient_id, l.author_id, l.burn_seconds, ua.pen_name AS author_pen,
                 ur.email AS recip_email, ur.pen_name AS recip_pen
          FROM letters l
          JOIN users ua ON ua.id = l.author_id
          LEFT JOIN users ur ON ur.id = l.recipient_id
          WHERE l.deliver_at <= ? AND l.notified = 0 AND l.recipient_id IS NOT NULL
            AND l.read_at IS NULL AND l.burned = 0`,
    args: [Date.now()],
  });
  for (const r of rows.rows as any[]) {
    // 幂等保护：cron 与首页懒扫描可能并发，已通知过就跳过
    const link = `/letter/${String(r.id)}`;
    const dup = await db.execute({
      sql: "SELECT 1 FROM notifications WHERE user_id=? AND type='letter_in' AND link=? LIMIT 1",
      args: [String(r.recipient_id), link],
    });
    if (dup.rows.length > 0) continue;

    const email = String(r.recip_email ?? "");
    const isCapsule = String(r.recipient_id) === String(r.author_id);
    const isBurn = Number(r.burn_seconds ?? 0) > 0;
    const subject = isCapsule
      ? "慢递局 · 你的时光胶囊到期了"
      : isBurn
        ? "慢递局 · 你收到一封阅后即焚的信"
        : "慢递局 · 你收到一封信";
    const text = isCapsule
      ? `你写给自己的信《${String(r.title)}》已到期解锁，回局里看看吧。`
      : isBurn
        ? `${String(r.author_pen)} 寄给你的信《${String(r.title)}》已经送达。这是一封阅后即焚的信：拆封即开始倒计时，读完即焚，只能看这一次。`
        : `${String(r.author_pen)} 寄给你的信《${String(r.title)}》已经送达，回局里看看吧。`;
    if (email) await sendMail(email, subject, text);
    await notify(
      String(r.recipient_id),
      "letter_in",
      isCapsule
        ? `你的时光胶囊《${String(r.title)}》已解锁`
        : isBurn
          ? `你收到一封阅后即焚的信：《${String(r.title)}》，拆封即焚`
          : `你收到一封信：《${String(r.title)}》`,
      link
    );
    // Web Push（未配置 VAPID 时静默跳过）
    try {
      await sendPushToUser(
        String(r.recipient_id),
        isCapsule
          ? "慢递局 · 时光胶囊已解锁"
          : isBurn
            ? "慢递局 · 阅后即焚"
            : "慢递局 · 你收到一封信",
        isCapsule
          ? `你写给自己的信《${String(r.title)}》到期了`
          : isBurn
            ? `${String(r.author_pen)} 寄来一封阅后即焚的信，拆封即燃`
            : `${String(r.author_pen)} 寄来一封信：《${String(r.title)}》`,
        link
      );
    } catch {
      /* push 失败不影响送达 */
    }
  }
  if (rows.rows.length > 0) {
    await db.execute({
      sql: `UPDATE letters SET notified = 1 WHERE deliver_at <= ? AND notified = 0 AND recipient_id IS NOT NULL`,
      args: [Date.now()],
    });
  }
}
