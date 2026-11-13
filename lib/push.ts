// Web Push：订阅管理与发送（VAPID）
// 由「push-pwa-onboard」队友完整实现。
// 约定：web-push v4 为纯 ESM 且不附带类型声明（API 同 v3：setVapidDetails / sendNotification）。
import { db } from "./db";
// @ts-ignore -- web-push v4 无类型声明文件
import * as webpush from "web-push";

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  link: string,
  onlyEndpoint?: string,
): Promise<boolean> {
  const publicKey = process.env.MDJ_VAPID_PUBLIC;
  const privateKey = process.env.MDJ_VAPID_PRIVATE;
  // 未配置密钥时静默跳过，绝不抛错影响信件送达
  if (!publicKey || !privateKey) return true;

  try {
    webpush.setVapidDetails(
      process.env.MDJ_VAPID_SUBJECT || "mailto:letters@ludwig.uno",
      publicKey,
      privateKey,
    );
  } catch (e) {
    console.error("[push] configuration failed");
    return false;
  }

  const rows = await db.execute({
    sql: "SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id=? AND (? IS NULL OR endpoint=?)",
    args: [userId, onlyEndpoint ?? null, onlyEndpoint ?? null],
  });

  const payload = JSON.stringify({
    title,
    body,
    link,
    tag: `letter:${link}`,
    icon: "/assets/logo/A0.png",
    badge: "/assets/logo/A0.png",
  });

  let ok = true;
  for (const r of rows.rows) {
    const endpoint = String(r.endpoint);
    try {
      await webpush.sendNotification(
        {
          endpoint,
          keys: {
            p256dh: String(r.p256dh),
            auth: String(r.auth),
          },
        },
        payload,
      );
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      const statusCode = Number(err?.statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        // 订阅已被推送服务回收：删除过期订阅
        try {
          await db.execute({
            sql: "DELETE FROM push_subs WHERE endpoint=? AND user_id=?",
            args: [endpoint, userId],
          });
        } catch (delErr) {
          console.error("[push] 清理过期订阅失败：", delErr);
        }
      } else {
        ok = false;
        // 其余失败只记录，不抛出
        console.error(`[push] delivery failed (statusCode=${statusCode})`);
      }
    }
  }
  return ok;
}

export async function removePushSub(
  endpoint: string,
  userId: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM push_subs WHERE endpoint=? AND user_id=?",
    args: [endpoint, userId],
  });
}
