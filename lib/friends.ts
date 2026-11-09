// 好友系统：只有互相成为笔友（或对方曾来信）才能互相寄信
import { db } from "./db";

export type Friendship = "none" | "pending_out" | "pending_in" | "friends";

export async function friendshipBetween(a: string, b: string): Promise<Friendship> {
  const r = await db.execute({
    sql: "SELECT status FROM friends WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?) LIMIT 1",
    args: [a, b, b, a],
  });
  const row = r.rows[0] as any;
  if (!row) return "none";
  if (String(row.status) === "accepted") return "friends";
  return String(row.requester_id) === a ? "pending_out" : "pending_in";
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  return (await friendshipBetween(a, b)) === "friends";
}

/** 收件人权限：站长可写给任何人；任何人可写给站长；笔友互寄；收到过对方的信即可回信 */
export async function canWriteTo(meId: string, targetId: string): Promise<boolean> {
  if (meId === targetId) return false; // 自己寄自己走胶囊通道
  const roles = await db.execute({
    sql: "SELECT id, role FROM users WHERE id IN (?,?)",
    args: [meId, targetId],
  });
  const me = (roles.rows as any[]).find((x) => String(x.id) === meId);
  const target = (roles.rows as any[]).find((x) => String(x.id) === targetId);
  if (!me || !target) return false;
  if (String(me.role) === "admin" || String(target.role) === "admin") return true;
  if (await areFriends(meId, targetId)) return true;
  // 收到过对方的信即可回信（回信豁免）
  const got = await db.execute({
    sql: "SELECT 1 FROM letters WHERE recipient_id=? AND author_id=? AND deliver_at <= ? LIMIT 1",
    args: [meId, targetId, Date.now()],
  });
  return got.rows.length > 0;
}

export type PenpalInfo = {
  id: string;
  pen: string;
  avatarId: string;
  bgId: string;
  seal: string;
  via: "friend" | "replied";
};

/** 写信页收件人清单：笔友 + 曾来信者（可回信） */
export async function getPenpals(meId: string): Promise<PenpalInfo[]> {
  const r = await db.execute({
    sql: `SELECT u.id, u.pen_name, u.avatar_id, u.bg_id, u.seal_text, f.status, f.requester_id
          FROM friends f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
          WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
          ORDER BY f.accepted_at ASC`,
    args: [meId, meId, meId],
  });
  const friends = (r.rows as any[]).map((x) => ({
    id: String(x.id),
    pen: String(x.pen_name),
    avatarId: String(x.avatar_id),
    bgId: String(x.bg_id),
    seal: String(x.seal_text || x.pen_name[0]),
    via: "friend" as const,
  }));

  // 曾来信者（非好友，回信豁免）
  const got = await db.execute({
    sql: `SELECT DISTINCT u.id, u.pen_name, u.avatar_id, u.bg_id, u.seal_text
          FROM letters l JOIN users u ON u.id = l.author_id
          WHERE l.recipient_id = ? AND l.deliver_at <= ?
          ORDER BY l.deliver_at DESC LIMIT 20`,
    args: [meId, Date.now()],
  });
  const replied = (got.rows as any[])
    .filter((x) => !friends.some((f) => f.id === String(x.id)))
    .map((x) => ({
      id: String(x.id),
      pen: String(x.pen_name),
      avatarId: String(x.avatar_id),
      bgId: String(x.bg_id),
      seal: String(x.seal_text || x.pen_name[0]),
      via: "replied" as const,
    }));
  return [...friends, ...replied];
}

/** 笔名搜索（用于找笔友） */
export async function searchPen(pen: string, excludeId: string) {
  const r = await db.execute({
    sql: `SELECT id, pen_name, avatar_id, bg_id, seal_text, letters_sent, created_at
          FROM users WHERE pen_name LIKE ? AND id != ? ORDER BY created_at ASC LIMIT 12`,
    args: [`%${pen}%`, excludeId],
  });
  return (r.rows as any[]).map((x) => ({
    id: String(x.id),
    pen: String(x.pen_name),
    avatarId: String(x.avatar_id),
    bgId: String(x.bg_id),
    seal: String(x.seal_text || x.pen_name[0]),
    sent: Number(x.letters_sent),
    createdAt: Number(x.created_at),
  }));
}

export async function pendingRequestsFor(uid: string, dir: "in" | "out") {
  const r = await db.execute({
    sql: `SELECT f.requester_id, f.addressee_id, f.created_at, u.pen_name, u.avatar_id, u.bg_id, u.seal_text
          FROM friends f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
          WHERE f.status = 'pending' AND (f.requester_id = ? OR f.addressee_id = ?)
          ORDER BY f.created_at DESC LIMIT 30`,
    args: [uid, uid, uid],
  });
  return (r.rows as any[]).filter((x) =>
    dir === "in" ? String(x.addressee_id) === uid : String(x.requester_id) === uid
  );
}

export async function friendList(uid: string) {
  const r = await db.execute({
    sql: `SELECT u.id, u.pen_name, u.avatar_id, u.bg_id, u.seal_text, u.letters_sent
          FROM friends f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
          WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
          ORDER BY f.accepted_at ASC LIMIT 60`,
    args: [uid, uid, uid],
  });
  return (r.rows as any[]).map((x) => ({
    id: String(x.id),
    pen: String(x.pen_name),
    avatarId: String(x.avatar_id),
    bgId: String(x.bg_id),
    seal: String(x.seal_text || x.pen_name[0]),
    sent: Number(x.letters_sent),
  }));
}
