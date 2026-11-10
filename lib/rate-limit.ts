// 轻量限流：基于数据库固定窗口计数，跨实例/重启都生效。
// 用于登录爆破、注册刷邀请码、写信刷屏等场景。
import { db } from "./db";

export type RateResult = { ok: true } | { ok: false; retryAfter: number };

/**
 * 在 windowMs 窗口内最多允许 limit 次；超限返回剩余秒数。
 * key 建议带业务前缀，例如 `login:邮箱`。
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateResult> {
  const now = Date.now();
  try {
    const row = (
      await db.execute({ sql: "SELECT count, reset_at FROM rate_limits WHERE key=?", args: [key] })
    ).rows[0] as any;

    if (!row || Number(row.reset_at) <= now) {
      await db.execute({
        sql: `INSERT INTO rate_limits(key, count, reset_at) VALUES(?, 1, ?)
              ON CONFLICT(key) DO UPDATE SET count=1, reset_at=excluded.reset_at`,
        args: [key, now + windowMs],
      });
      return { ok: true };
    }

    const count = Number(row.count);
    const resetAt = Number(row.reset_at);
    if (count >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
    }
    await db.execute({ sql: "UPDATE rate_limits SET count=count+1 WHERE key=?", args: [key] });
    return { ok: true };
  } catch {
    // 限流表异常不阻断正常业务（宁可放行，不可误伤）
    return { ok: true };
  }
}

/** 生成「稍后再试」的友好提示 */
export function tooManyText(retryAfter: number): string {
  const min = Math.ceil(retryAfter / 60);
  return min > 1 ? `操作太频繁，请 ${min} 分钟后再试` : `操作太频繁，请 ${retryAfter} 秒后再试`;
}
