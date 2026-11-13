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

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  idempotencyKey?: string,
): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!mailConfigured()) {
    // 无 key：静默降级为日志，绝不抛错影响主流程
    console.warn(
      "[MAIL] Delivery unavailable: email provider is not configured",
    );
    return {
      ok: false,
      error: "未配置 RESEND_API_KEY（当前降级为控制台日志）",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "慢递局 <letters@ludwig.uno>",
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[MAIL] send failed:", res.status);
      return { ok: false, error: `邮件服务返回 ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[MAIL] send failed:", e);
    return { ok: false, error: String(e) };
  }
}

/** Durable delivery outbox. Never use client timers or a read receipt to deliver a letter. */
export async function sweepDelivered() {
  const now = Date.now();
  const due = await db.execute({
    sql: `SELECT l.id,l.recipient_id,u.email,u.mail_notices FROM letters l JOIN users u ON u.id=l.recipient_id
    WHERE l.deliver_at<=? AND l.notified=0 AND l.recipient_id IS NOT NULL AND l.burned=0 LIMIT 200`,
    args: [now],
  });
  for (const l of due.rows) {
    const subs = (
      await db.execute({
        sql: "SELECT id FROM push_subs WHERE user_id=?",
        args: [String(l.recipient_id)],
      })
    ).rows;
    for (const channel of [
      "inapp",
      "email",
      ...subs.map((x) => `push:${String(x.id)}`),
    ]) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO delivery_jobs(letter_id,channel) VALUES(?,?)",
        args: [String(l.id), channel],
      });
    }
  }
  const jobs = await db.execute({
    sql: `SELECT j.*,l.recipient_id,l.deliver_at,l.burned,u.email,u.mail_notices
    FROM delivery_jobs j JOIN letters l ON l.id=j.letter_id JOIN users u ON u.id=l.recipient_id
    WHERE j.status IN ('pending','processing') AND j.next_attempt_at<=? AND j.lease_until<=? AND l.deliver_at<=? LIMIT 200`,
    args: [now, now, now],
  });
  for (const j of jobs.rows) {
    const id = String(j.letter_id),
      channel = String(j.channel),
      uid = String(j.recipient_id);
    const token = crypto.randomUUID();
    const lease = await db.execute({
      sql: "UPDATE delivery_jobs SET status='processing',lease_until=?,claim_token=?,attempts=attempts+1 WHERE letter_id=? AND channel=? AND status IN ('pending','processing') AND lease_until<=? RETURNING attempts",
      args: [Date.now() + 300000, token, id, channel, Date.now()],
    });
    if (!lease.rows.length) continue;
    let status = "sent";
    try {
      if (Number(j.burned)) {
        status = "skipped";
      } else if (channel === "inapp") {
        // Legacy event lookup avoids replaying already notified historical letters.
        const old = (
          await db.execute({
            sql: "SELECT 1 FROM notifications WHERE user_id=? AND type='letter_in' AND link=? LIMIT 1",
            args: [uid, `/letter/${id}`],
          })
        ).rows.length;
        if (!old)
          await db.execute({
            sql: "INSERT OR IGNORE INTO notifications(id,user_id,type,body,link,created_at,event_key) VALUES(?,?,?,?,?,?,?)",
            args: [
              crypto.randomUUID(),
              uid,
              "letter_in",
              "你有一封新到的信。",
              `/letter/${id}`,
              Date.now(),
              `letter_in:${id}`,
            ],
          });
      } else if (channel === "email") {
        if (!Number(j.mail_notices) || !mailConfigured()) status = "skipped";
        else if (
          !(
            await sendMail(
              String(j.email),
              "慢递局 · 来信",
              "你有一封新到的信，可在方便时回局里阅读。",
              `letter:${id}`,
            )
          ).ok
        )
          throw new Error("email_delivery_failed");
      } else if (channel.startsWith("push:")) {
        const sub = (
          await db.execute({
            sql: "SELECT endpoint FROM push_subs WHERE id=? AND user_id=?",
            args: [channel.slice(5), uid],
          })
        ).rows[0];
        if (!sub) status = "skipped";
        else if (
          !(await sendPushToUser(
            uid,
            "慢递局 · 来信",
            "你有一封新到的信。",
            `/letter/${id}`,
            String(sub.endpoint),
          ))
        )
          throw new Error("push_delivery_failed");
      }
      await db.execute({
        sql: "UPDATE delivery_jobs SET status=?,lease_until=0,last_error=NULL WHERE letter_id=? AND channel=? AND claim_token=?",
        args: [status, id, channel, token],
      });
    } catch {
      const delay = Math.min(
        3600000,
        30000 * 2 ** Math.min(7, Number(lease.rows[0].attempts)),
      );
      await db.execute({
        sql: "UPDATE delivery_jobs SET status='pending',lease_until=0,next_attempt_at=?,last_error='channel_failed' WHERE letter_id=? AND channel=? AND claim_token=?",
        args: [Date.now() + delay, id, channel, token],
      });
    }
    await db.execute({
      sql: "UPDATE letters SET notified=1 WHERE id=? AND NOT EXISTS(SELECT 1 FROM delivery_jobs WHERE letter_id=? AND status NOT IN ('sent','skipped'))",
      args: [id, id],
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
    const user = (
      await db.execute({
        sql: "SELECT email,mail_notices FROM users WHERE id=?",
        args: [opts.authorId],
      })
    ).rows[0];
    if (!user || !Number(user.mail_notices)) return;
    await sendMail(
      String(user.email),
      "慢递局 · 批注",
      "有人为你的文字留下批注，可在方便时回局里阅读。",
    );
  } catch {
    console.error("[MAIL] reply notification failed");
  }
}
