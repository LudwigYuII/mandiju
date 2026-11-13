import { db } from "./db";

export type NotifyType =
  | "letter_in"
  | "reply"
  | "like"
  | "stamp"
  | "friend"
  | "birthday"
  | "festival"
  | "announce";

export async function notify(
  userId: string,
  type: NotifyType,
  body: string,
  link?: string,
) {
  await db.execute({
    sql: "INSERT INTO notifications(id, user_id, type, body, link, created_at) VALUES(?,?,?,?,?,?)",
    args: [crypto.randomUUID(), userId, type, body, link ?? null, Date.now()],
  });
}

export async function unreadCount(userId: string): Promise<number> {
  const r = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND read=0",
    args: [userId],
  });
  return Number((r.rows[0] as any)?.n ?? 0);
}
