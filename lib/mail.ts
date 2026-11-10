// 邮件通知：接入 Resend（未配置时降级为控制台日志）
import { db } from "./db";
import { notify } from "./notify";
import { sendPushToUser } from "./push";

export type MailResult = { ok: boolean; error?: string };

/** 邮件通道是否已配置（只在服务端用；不要把 key 本身传给客户端） */
export function mailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/** 发件人地址是否自定义（未配置 MAIL_FROM 时用默认 letters@ludwig.uno） */
export function mailFromConfigured(): boolean {
  const from = process.env.MAIL_FROM;
  return typeof from === "string" && from.trim().length > 0;
}

export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!mailConfigured()) {
    // 无 key：静默降级为日志，绝不抛错影响主流程
    console.log(`[MAIL] 未配置 RESEND_API_KEY，跳过发送（仅日志）to=${to} | ${subject} | ${text}`);
    return { ok: false, error: "未配置 RESEND_API_KEY（当前降级为控制台日志）" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
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
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[MAIL] send failed:", res.status, body);
      return { ok: false, error: `Resend ${res.status}：${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[MAIL] send failed:", e);
    return { ok: false, error: String(e) };
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

/**
 * 回信 / 批注通知邮件：有人在你的信下留批注时，给信件作者发一封邮件。
 *
 * 约定与其它邮件一致：
 *   · 没有 RESEND_API_KEY 时静默跳过（只留一行日志）；
 *   · 查邮箱 / 发信的任何异常都只打日志，绝不影响批注本身与页面跳转。
 *
 * 接入点（lib/actions.ts → addReplyAction，在 notify(authorId, "reply", ...) 之后补一行）：
 *   await sendReplyNoticeEmail({
 *     authorId, letterId,
 *     letterTitle: String((l.rows[0] as any)?.title ?? ""),
 *     replierPen: sess.pen, replyBody: body,
 *   });
 */
export async function sendReplyNoticeEmail(opts: {
  authorId: string;
  letterId: string;
  letterTitle: string;
  replierPen: string;
  replyBody: string;
}): Promise<void> {
  if (!mailConfigured()) return;
  try {
    const r = await db.execute({
      sql: "SELECT email FROM users WHERE id=?",
      args: [opts.authorId],
    });
    const email = String((r.rows[0] as { email?: unknown } | undefined)?.email ?? "");
    if (!email) return;
    const excerpt = opts.replyBody.length > 300 ? `${opts.replyBody.slice(0, 300)}…` : opts.replyBody;
    await sendMail(
      email,
      `慢递局 · ${opts.replierPen} 在《${opts.letterTitle}》下留了批注`,
      `${opts.replierPen} 在《${opts.letterTitle}》下批注：\n\n${excerpt}\n\n回局里看看：https://ludwig.uno/letter/${opts.letterId}`
    );
  } catch (e) {
    console.error("[MAIL] 批注通知邮件失败（不影响批注）：", e);
  }
}
