// 阅后即焚：焚毁逻辑（仅服务端引用）
import { db } from "./db";

/** 焚毁：正文彻底抹除，只留信封元数据作为「灰烬」墓碑 */
export async function wipeBurn(letterId: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM likes WHERE letter_id=?", args: [letterId] });
  await db.execute({ sql: "DELETE FROM replies WHERE letter_id=?", args: [letterId] });
  await db.execute({ sql: "DELETE FROM topic_letters WHERE letter_id=?", args: [letterId] });
  await db.execute({
    sql: "UPDATE letters SET burned=1, title='（已焚毁）', body='', image=NULL WHERE id=?",
    args: [letterId],
  });
}

/** 兜底清扫：倒计时已到期的焚毁信（懒执行，任何入口都可调用） */
export async function expireBurnLetters(): Promise<void> {
  await db.execute({
    sql: `UPDATE letters SET burned=1, title='（已焚毁）', body='', image=NULL
          WHERE burn_seconds IS NOT NULL AND burn_seconds > 0 AND burned=0
            AND burned_at IS NOT NULL AND burned_at <= ?`,
    args: [Date.now()],
  });
}
