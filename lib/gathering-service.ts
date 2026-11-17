import type { Client, Transaction } from "@libsql/client";
import { active, allowance } from "./literary-service";
import { blockedBetween } from "./study-service";
import { plainText, workBody } from "./literary-policy";
import { gatheringTime } from "./gathering-policy";
import { SITE_TIME_ZONE } from "./time";
type Sql = Pick<Client, "execute"> | Pick<Transaction, "execute">;
const audience = `(s.owner_id=? OR (s.hidden=0 AND (s.visibility='public' OR EXISTS(SELECT 1 FROM literary_members m WHERE m.space_id=s.id AND m.user_id=? AND m.status='joined') AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.owner_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=s.owner_id)))))`;
export async function readGathering(q: Sql, id: string, viewer = "") {
  return (
    await q.execute({
      sql: `SELECT s.*,u.pen_name FROM literary_spaces s JOIN public_users u ON u.id=s.owner_id WHERE s.id=? AND s.kind='gathering' AND (${audience} OR (s.hidden=0 AND EXISTS(SELECT 1 FROM literary_members m WHERE m.space_id=s.id AND m.user_id=? AND m.status='invited') AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.owner_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=s.owner_id))))`,
      args: [id, viewer, viewer, viewer, viewer, viewer, viewer, viewer],
    })
  ).rows[0];
}
export async function readGatheringPosts(
  q: Sql,
  id: string,
  viewer = "",
  offset = 0,
  now = Date.now(),
) {
  return (
    await q.execute({
      sql: `SELECT p.*,u.pen_name FROM gathering_posts p JOIN literary_spaces s ON s.id=p.space_id JOIN public_users u ON u.id=p.author_id WHERE s.kind='gathering' AND s.id=? AND ${audience} AND p.hidden=0 AND p.withdrawn=0 AND (?<s.ends_at OR p.archive_consent=1) ORDER BY p.created_at,p.id LIMIT 20 OFFSET ?`,
      args: [id, viewer, viewer, viewer, viewer, now, offset],
    })
  ).rows;
}
export async function readGatheringMembers(
  q: Sql,
  id: string,
  viewer = "",
  now = Date.now(),
) {
  return (
    await q.execute({
      sql: `SELECT m.user_id,u.pen_name FROM literary_members m JOIN literary_spaces s ON s.id=m.space_id JOIN public_users u ON u.id=m.user_id WHERE s.kind='gathering' AND s.id=? AND ${audience} AND m.status='joined' AND (?<s.ends_at OR m.archive_consent=1) ORDER BY m.created_at,m.user_id`,
      args: [id, viewer, viewer, viewer, viewer, now],
    })
  ).rows;
}
export async function listGatherings(q: Sql, viewer = "", offset = 0) {
  return (
    await q.execute({
      sql: `SELECT s.*,u.pen_name,m.status FROM literary_spaces s JOIN public_users u ON u.id=s.owner_id LEFT JOIN literary_members m ON m.space_id=s.id AND m.user_id=? WHERE s.kind='gathering' AND (s.owner_id=? OR (s.hidden=0 AND (s.visibility='public' OR m.status IN ('invited','joined')) AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.owner_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=s.owner_id)))) ORDER BY s.created_at DESC,s.id LIMIT 20 OFFSET ?`,
      args: [viewer, viewer, viewer, viewer, offset],
    })
  ).rows;
}
async function seat(tx: Sql, s: Record<string, unknown>, actor: string) {
  if (Number(s.hidden) || Number(s.closed)) throw new Error("此雅集暂不可参与");
  const members = (
    await tx.execute({
      sql: "SELECT user_id,status FROM literary_members WHERE space_id=? AND status IN ('joined','invited')",
      args: [String(s.id)],
    })
  ).rows;
  for (const m of members)
    if (await blockedBetween(tx, actor, String(m.user_id)))
      throw new Error("暂时无法往来");
  if (await blockedBetween(tx, actor, String(s.owner_id)))
    throw new Error("暂时无法往来");
  const m = (
    await tx.execute({
      sql: "SELECT * FROM literary_members WHERE space_id=? AND user_id=?",
      args: [String(s.id), actor],
    })
  ).rows[0];
  if (m && !["invited", "joined"].includes(String(m.status)))
    throw new Error("此雅集暂不可参与");
  if (s.visibility === "private" && !m) throw new Error("此雅集须受邀方可参与");
  if (!m && members.length >= Number(s.capacity))
    throw new Error("此雅集已无余席");
  return m;
}
export async function gatheringMutation(
  client: Client,
  actor: string,
  op: string,
  data: Record<string, string>,
  timestamp?: number,
): Promise<{ id?: string }> {
  const tx = await client.transaction("write"),
    now = timestamp ?? Date.now();
  try {
    const me = await active(tx, actor);
    let result: { id?: string } = {};
    if (op === "create") {
      const key = plainText(data.send_key, 80, 16);
      const old = (
        await tx.execute({
          sql: "SELECT id,kind FROM literary_spaces WHERE owner_id=? AND send_key=?",
          args: [actor, key],
        })
      ).rows[0];
      if (old) {
        if (old.kind !== "gathering") throw new Error("请刷新后重试");
        result.id = String(old.id);
      } else {
        const title = plainText(data.title, 80, 1),
          intro = plainText(data.intro, 1000),
          start = gatheringTime(data.starts_at),
          end = gatheringTime(data.ends_at),
          capacity = Number(data.capacity || 12);
        if (
          start < now ||
          start > now + 366 * 86400000 ||
          end <= start ||
          end - start > 7 * 86400000
        )
          throw new Error("请选择未来一年内开始、持续不超过七日的雅集");
        if (!Number.isInteger(capacity) || capacity < 2 || capacity > 24)
          throw new Error("参与上限请设为二至二十四人");
        if (data.consent !== "on") throw new Error("请确认雅集的可见范围");
        const visibility = data.visibility === "public" ? "public" : "private";
        const names = [
          ...new Set(
            plainText(data.invitees, 500)
              .split(/[，,、\s]+/)
              .filter(Boolean),
          ),
        ];
        if (names.length >= capacity) throw new Error("请为主人留一席");
        const invited: string[] = [];
        for (const name of names) {
          const u = (
            await tx.execute({
              sql: "SELECT id FROM users WHERE literary_name=? AND banned=0",
              args: [name],
            })
          ).rows[0];
          if (
            !u ||
            u.id === actor ||
            (await blockedBetween(tx, actor, String(u.id)))
          )
            throw new Error("受邀书友未找到，或暂不可往来");
          const relation = (
            await tx.execute({
              sql: "SELECT 1 FROM friends WHERE status='accepted' AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)) UNION ALL SELECT 1 FROM letters WHERE author_id=? AND recipient_id=? AND deliver_at<=? LIMIT 1",
              args: [
                actor,
                String(u.id),
                String(u.id),
                actor,
                String(u.id),
                actor,
                now,
              ],
            })
          ).rows.length;
          if (!relation && me.role !== "admin")
            throw new Error("邀入雅集请先有尺牍往来");
          invited.push(String(u.id));
        }
        await allowance(tx, actor, "gathering-create", now, 3);
        const id = crypto.randomUUID();
        await tx.execute({
          sql: "INSERT INTO literary_spaces(id,owner_id,kind,title,intro,visibility,capacity,created_at,send_key,starts_at,ends_at,event_timezone) VALUES(?,?,'gathering',?,?,?,?,?,?,?,?,?)",
          args: [
            id,
            actor,
            title,
            intro,
            visibility,
            capacity,
            now,
            key,
            start,
            end,
            SITE_TIME_ZONE,
          ],
        });
        await tx.execute({
          sql: "INSERT INTO literary_members(space_id,user_id,status,created_at,archive_consent) VALUES(?,?,'joined',?,?)",
          args: [id, actor, now, data.archive === "on" ? 1 : 0],
        });
        for (const uid of invited)
          await tx.execute({
            sql: "INSERT INTO literary_members(space_id,user_id,status,created_at) VALUES(?,?,'invited',?)",
            args: [id, uid, now],
          });
        result.id = id;
      }
    } else if (
      ["withdraw", "unarchive", "report_post", "moderate_post"].includes(op)
    ) {
      const p = (
        await tx.execute({
          sql: "SELECT * FROM gathering_posts WHERE id=?",
          args: [data.id],
        })
      ).rows[0];
      if (!p) throw new Error("此篇不可处理");
      if (op === "withdraw" || op === "unarchive") {
        if (p.author_id !== actor) throw new Error("只能收回自己的文字");
        await tx.execute({
          sql: `UPDATE gathering_posts SET ${op === "withdraw" ? "withdrawn" : "archive_consent"}=? WHERE id=?`,
          args: [op === "withdraw" ? 1 : 0, data.id],
        });
      } else if (op === "moderate_post") {
        if (me.role !== "admin") throw new Error("无权处理");
        await tx.execute({
          sql: "UPDATE gathering_posts SET hidden=? WHERE id=?",
          args: [data.restore === "on" ? 0 : 1, data.id],
        });
        await tx.execute({
          sql: "INSERT INTO admin_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
          args: [
            crypto.randomUUID(),
            actor,
            `gathering_post_${data.restore === "on" ? "restore" : "hide"}`,
            data.id,
            now,
          ],
        });
      } else {
        const s = await readGathering(tx, String(p.space_id), actor);
        // Check this specific post without relying on which page it falls on.
        const joined = (
          await tx.execute({
            sql: "SELECT 1 FROM literary_members WHERE space_id=? AND user_id=? AND status='joined'",
            args: [String(p.space_id), actor],
          })
        ).rows.length;
        if (
          !s ||
          (!joined && s.visibility !== "public") ||
          Number(p.hidden) ||
          Number(p.withdrawn) ||
          (now >= Number(s.ends_at) && !Number(p.archive_consent))
        )
          throw new Error("此篇不可访问");
        await allowance(tx, actor, "gathering-report", now, 10);
        await tx.execute({
          sql: "INSERT OR IGNORE INTO gathering_reports(id,target_kind,target_id,reporter_id,reason,created_at) VALUES(?,'post',?,?,?,?)",
          args: [
            crypto.randomUUID(),
            data.id,
            actor,
            plainText(data.reason, 500, 1),
            now,
          ],
        });
      }
    } else {
      const id = plainText(data.id, 100, 1),
        s = (
          await tx.execute({
            sql: "SELECT * FROM literary_spaces WHERE id=? AND kind='gathering'",
            args: [id],
          })
        ).rows[0];
      if (!s) throw new Error("此雅集不可访问");
      const ended = now >= Number(s.ends_at),
        owner = s.owner_id === actor;
      const m = (
        await tx.execute({
          sql: "SELECT * FROM literary_members WHERE space_id=? AND user_id=?",
          args: [id, actor],
        })
      ).rows[0];
      if (op === "join") {
        if (ended) throw new Error("雅集已结束");
        if (data.consent !== "on") throw new Error("请确认雅号的展示范围");
        await seat(tx, s, actor);
        await tx.execute({
          sql: "INSERT INTO literary_members(space_id,user_id,status,created_at,archive_consent) VALUES(?,?,'joined',?,?) ON CONFLICT(space_id,user_id) DO UPDATE SET status='joined',archive_consent=excluded.archive_consent",
          args: [id, actor, now, data.archive === "on" ? 1 : 0],
        });
      } else if (op === "post") {
        if (ended || now < Number(s.starts_at))
          throw new Error("仅可在雅集进行期间留文");
        if (m?.status !== "joined") throw new Error("请先入席");
        await seat(tx, s, actor);
        if (data.consent !== "on") throw new Error("请确认文字的展示范围");
        const key = plainText(data.send_key, 80, 16);
        const old = (
          await tx.execute({
            sql: "SELECT id,space_id FROM gathering_posts WHERE author_id=? AND send_key=?",
            args: [actor, key],
          })
        ).rows[0];
        if (old && old.space_id !== id) throw new Error("请刷新后重试");
        if (!old) {
          await allowance(tx, actor, "gathering-post", now, 20);
          await tx.execute({
            sql: "INSERT INTO gathering_posts(id,space_id,author_id,body,created_at,archive_consent,send_key) VALUES(?,?,?,?,?,?,?)",
            args: [
              crypto.randomUUID(),
              id,
              actor,
              workBody(data.body),
              now,
              data.archive === "on" ? 1 : 0,
              key,
            ],
          });
        }
      } else if (op === "archive_identity") {
        if (m?.status !== "joined") throw new Error("请先入席");
        if (ended && data.archive === "on")
          throw new Error("集序已定，不能扩大归档范围");
        if (data.archive === "on") await seat(tx, s, actor);
        await tx.execute({
          sql: "UPDATE literary_members SET archive_consent=? WHERE space_id=? AND user_id=?",
          args: [data.archive === "on" ? 1 : 0, id, actor],
        });
      } else if (op === "leave" || op === "decline") {
        if (owner) throw new Error("主人可在结束前散席");
        await tx.execute({
          sql: "UPDATE literary_members SET status=?,archive_consent=0 WHERE space_id=? AND user_id=? AND status=?",
          args: [
            op === "leave" ? "left" : "declined",
            id,
            actor,
            op === "leave" ? "joined" : "invited",
          ],
        });
        await tx.execute({
          sql: "UPDATE gathering_posts SET archive_consent=0,withdrawn=1 WHERE space_id=? AND author_id=?",
          args: [id, actor],
        });
      } else if (op === "revoke" || op === "close") {
        if (!owner) throw new Error("只有主人可以管理雅集");
        if (ended) throw new Error("雅集已结束");
        if (op === "close")
          await tx.execute({
            sql: "UPDATE literary_spaces SET ends_at=?,closed=1 WHERE id=?",
            args: [now, id],
          });
        else {
          if (data.target === actor) throw new Error("不能撤回自己的席位");
          await tx.execute({
            sql: "UPDATE literary_members SET status='revoked',archive_consent=0 WHERE space_id=? AND user_id=?",
            args: [id, data.target],
          });
          await tx.execute({
            sql: "UPDATE gathering_posts SET withdrawn=1,archive_consent=0 WHERE space_id=? AND author_id=?",
            args: [id, data.target],
          });
        }
      } else if (op === "report") {
        if (!(await readGathering(tx, id, actor)))
          throw new Error("此雅集不可访问");
        await allowance(tx, actor, "gathering-report", now, 10);
        await tx.execute({
          sql: "INSERT OR IGNORE INTO gathering_reports(id,target_kind,target_id,reporter_id,reason,created_at) VALUES(?,'space',?,?,?,?)",
          args: [
            crypto.randomUUID(),
            id,
            actor,
            plainText(data.reason, 500, 1),
            now,
          ],
        });
      } else if (op === "moderate") {
        if (me.role !== "admin") throw new Error("无权处理");
        await tx.execute({
          sql: "UPDATE literary_spaces SET hidden=? WHERE id=?",
          args: [data.restore === "on" ? 0 : 1, id],
        });
        await tx.execute({
          sql: "INSERT INTO admin_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
          args: [
            crypto.randomUUID(),
            actor,
            `gathering_space_${data.restore === "on" ? "restore" : "hide"}`,
            id,
            now,
          ],
        });
      } else throw new Error("无法识别这项操作");
    }
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
