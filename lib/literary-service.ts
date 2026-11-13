import type { Client, Transaction } from "@libsql/client";
import { blockedBetween } from "./study-service";
import { plainText,workBody } from "./literary-policy";
import { siteDateKey } from "./time";
type Sql = Pick<Client, "execute"> | Pick<Transaction, "execute">;
const audience = `(s.owner_id=? OR (s.hidden=0 AND (s.visibility='public' OR EXISTS(SELECT 1 FROM literary_members m WHERE m.space_id=s.id AND m.user_id=? AND m.status='joined') AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.owner_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=s.owner_id)))))`;
export async function readSpace(q: Sql, id: string, viewer = "") {
  return (
    await q.execute({
      sql: `SELECT s.*,u.pen_name,u.seal_text FROM literary_spaces s JOIN public_users u ON u.id=s.owner_id WHERE s.id=? AND ((${audience}) OR (s.hidden=0 AND EXISTS(SELECT 1 FROM literary_members m WHERE m.space_id=s.id AND m.user_id=? AND m.status='invited') AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.owner_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=s.owner_id))))`,
      args: [id, viewer, viewer, viewer, viewer, viewer, viewer, viewer],
    })
  ).rows[0];
}
export async function readEntries(q: Sql, id: string, viewer = "", offset = 0) {
  return (
    await q.execute({
      sql: `SELECT e.id,e.author_id,e.position,e.created_at,e.withdrawn,e.vertical,e.hidden,u.pen_name,u.seal_text,
    CASE WHEN e.withdrawn=1 AND e.author_id<>? THEN '（已收回）' ELSE e.title END AS title,
    CASE WHEN e.withdrawn=1 AND e.author_id<>? THEN '' ELSE e.body END AS body,
    CASE WHEN e.withdrawn=1 AND e.author_id<>? THEN '' ELSE e.rhyme END AS rhyme
    FROM literary_entries e JOIN literary_spaces s ON s.id=e.space_id JOIN public_users u ON u.id=e.author_id
    WHERE s.id=? AND ${audience} AND (e.hidden=0 OR e.author_id=?) ORDER BY e.position ASC LIMIT 24 OFFSET ?`,
      args: [
        viewer,
        viewer,
        viewer,
        id,
        viewer,
        viewer,
        viewer,
        viewer,
        viewer,
        offset,
      ],
    })
  ).rows;
}
export async function readEntry(q: Sql, id: string, viewer = "") {
  return (
    await q.execute({
      sql: `SELECT e.*,s.visibility,s.title AS space_title,u.pen_name,u.seal_text FROM literary_entries e JOIN literary_spaces s ON s.id=e.space_id JOIN public_users u ON u.id=e.author_id WHERE e.id=? AND (e.author_id=? OR (${audience} AND e.withdrawn=0 AND e.hidden=0))`,
      args: [id, viewer, viewer, viewer, viewer, viewer],
    })
  ).rows[0];
}
export async function readColophonTarget(
  q: Sql,
  kind: string,
  id: string,
  viewer = "",
) {
  if (kind === "entry") {
    const e = await readEntry(q, id, viewer);
    return e && !Number(e.withdrawn) && !Number(e.hidden) ? e : null;
  }
  if (kind === "letter")
    return (
      (
        await q.execute({
          sql: `SELECT author_id,title FROM letters WHERE id=? AND recipient_id IS NULL AND deliver_at<=? AND moderation_hidden=0 AND burned=0 AND COALESCE(burn_seconds,0)=0`,
          args: [id, Date.now()],
        })
      ).rows[0] || null
    );
  return null;
}
export async function readColophons(
  q: Sql,
  kind: string,
  id: string,
  viewer = "",
  offset = 0,
) {
  const target = await readColophonTarget(q, kind, id, viewer);
  if (!target) return [];
  return (
    await q.execute({
      sql: `SELECT c.*,u.pen_name FROM literary_colophons c JOIN public_users u ON u.id=c.author_id WHERE c.target_kind=? AND c.target_id=? AND (c.status='accepted' OR c.author_id=? OR (c.status IN ('pending','declined') AND ?=?)) ORDER BY CASE WHEN c.status='pending' AND ?=? THEN 0 ELSE 1 END,c.created_at ASC,c.id LIMIT 30 OFFSET ?`,
      args: [
        kind,
        id,
        viewer,
        String(target.author_id),
        viewer,
        String(target.author_id),
        viewer,
        offset,
      ],
    })
  ).rows;
}
async function active(q: Sql, id: string) {
  const u = (
    await q.execute({
      sql: "SELECT id,literary_name,role FROM users WHERE id=? AND banned=0",
      args: [id],
    })
  ).rows[0];
  if (!u?.literary_name) throw new Error("请先题定雅号");
  return u;
}
async function allowance(
  q: Sql,
  actor: string,
  kind: string,
  now: number,
  limit: number,
) {
  await q.execute({
    sql: "DELETE FROM rate_limits WHERE key LIKE 'literary:%' AND reset_at<?",
    args: [now],
  });
  const key = `literary:${kind}:${actor}:${siteDateKey(new Date(now))}`;
  const r = (
    await q.execute({
      sql: `INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`,
      args: [key, now + 2 * 86400000],
    })
  ).rows[0];
  if (Number(r.count) > limit) throw new Error("今日先歇笔，改日再来");
}
async function canJoin(q: Sql, space: Record<string, unknown>, actor: string) {
  if (Number(space.hidden) || Number(space.closed))
    throw new Error("此卷暂不接续");
  const host = String(space.owner_id);
  if (await blockedBetween(q, host, actor)) throw new Error("暂时无法往来");
  const m = (
    await q.execute({
      sql: "SELECT status FROM literary_members WHERE space_id=? AND user_id=?",
      args: [String(space.id), actor],
    })
  ).rows[0];
  if (
    m?.status === "revoked" ||
    m?.status === "left" ||
    m?.status === "declined"
  )
    throw new Error("此卷暂不可参与");
  if (
    space.visibility === "private" &&
    !["invited", "joined"].includes(String(m?.status))
  )
    throw new Error("此卷须受邀方可参与");
  const blocked = (
    await q.execute({
      sql: `SELECT 1 FROM literary_members m JOIN user_blocks b ON ((b.blocker_id=m.user_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=m.user_id)) WHERE m.space_id=? AND m.status IN ('joined','invited') LIMIT 1`,
      args: [actor, actor, String(space.id)],
    })
  ).rows.length;
  if (blocked) throw new Error("暂时无法往来");
  if (!m) {
    const n = (
      await q.execute({
        sql: "SELECT COUNT(*) n FROM literary_members WHERE space_id=? AND status IN ('joined','invited')",
        args: [String(space.id)],
      })
    ).rows[0];
    if (Number(n.n) >= Number(space.capacity)) throw new Error("此卷已无余席");
  }
  return m;
}
export async function literaryMutation(
  client: Client,
  actor: string,
  op: string,
  data: Record<string, string>,
  timestamp?: number,
): Promise<{ id?: string }> {
  const tx = await client.transaction("write");
  const now = timestamp ?? Date.now();
  try {
    const me = await active(tx, actor);
    let result: { id?: string } = {};
    if (op === "create") {
      const key = plainText(data.send_key, 80, 16);
      const existing = (
        await tx.execute({
          sql: "SELECT id FROM literary_spaces WHERE owner_id=? AND send_key=?",
          args: [actor, key],
        })
      ).rows[0];
      if (existing) result.id = String(existing.id);
      else {
        const title = plainText(data.title, 80, 1),
          body = workBody(data.body),
          intro = plainText(data.intro, 1000),
          rhyme = plainText(data.rhyme, 100);
        const capacity = Number(data.capacity || 12);
        if (!Number.isInteger(capacity) || capacity < 2 || capacity > 24)
          throw new Error("参与上限请设为二至二十四人");
        const visibility = data.visibility === "public" ? "public" : "private";
        if (data.consent !== "on") throw new Error("请确认本卷的可见范围");
        const names = [
          ...new Set(
            plainText(data.invitees, 500)
              .split(/[，,、\s]+/)
              .filter(Boolean),
          ),
        ];
        if (names.length >= capacity) throw new Error("请为起首者留一席");
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
            String(u.id) === actor ||
            (await blockedBetween(tx, actor, String(u.id)))
          )
            throw new Error("受邀书友未找到，或暂不可往来");
          const friend = (
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
          if (!friend && me.role !== "admin")
            throw new Error("邀入私卷请先有尺牍往来");
          invited.push(String(u.id));
        }
        await allowance(tx, actor, "create", now, 3);
        const id = crypto.randomUUID();
        await tx.execute({
          sql: "INSERT INTO literary_spaces(id,owner_id,title,intro,rhyme,visibility,capacity,created_at,send_key) VALUES(?,?,?,?,?,?,?,?,?)",
          args: [
            id,
            actor,
            title,
            intro,
            rhyme,
            visibility,
            capacity,
            now,
            key,
          ],
        });
        await tx.execute({
          sql: "INSERT INTO literary_members(space_id,user_id,status,created_at) VALUES(?,?,'joined',?)",
          args: [id, actor, now],
        });
        for (const uid of invited)
          await tx.execute({
            sql: "INSERT INTO literary_members(space_id,user_id,status,created_at) VALUES(?,?,'invited',?)",
            args: [id, uid, now],
          });
        await tx.execute({
          sql: "INSERT INTO literary_entries(id,space_id,author_id,position,title,body,rhyme,vertical,created_at,send_key) VALUES(?,?,?,1,?,?,?,?,?,?)",
          args: [
            crypto.randomUUID(),
            id,
            actor,
            plainText(data.work_title, 80) || title,
            body,
            rhyme,
            data.vertical === "on" ? 1 : 0,
            now,
            key,
          ],
        });
        result.id = id;
      }
    } else if (
      [
        "join",
        "decline_invite",
        "leave",
        "close",
        "revoke_member",
        "append",
      ].includes(op)
    ) {
      const id = plainText(data.id, 100, 1);
      const space = (
        await tx.execute({
          sql: "SELECT * FROM literary_spaces WHERE id=?",
          args: [id],
        })
      ).rows[0];
      if (!space) throw new Error("此卷不可访问");
      if (op === "close" || op === "revoke_member") {
        if (String(space.owner_id) !== actor)
          throw new Error("此卷只能由起首者管理");
        if (op === "close")
          await tx.execute({
            sql: "UPDATE literary_spaces SET closed=1 WHERE id=?",
            args: [id],
          });
        else {
          if (data.target === actor) throw new Error("不能撤回自己的席位");
          await tx.execute({
            sql: "UPDATE literary_members SET status='revoked' WHERE space_id=? AND user_id=?",
            args: [id, data.target],
          });
        }
      } else if (op === "leave" || op === "decline_invite") {
        if (String(space.owner_id) === actor) throw new Error("起首者可以封卷");
        await tx.execute({
          sql: "UPDATE literary_members SET status=? WHERE space_id=? AND user_id=? AND status=?",
          args: [
            op === "leave" ? "left" : "declined",
            id,
            actor,
            op === "leave" ? "joined" : "invited",
          ],
        });
      } else {
        const old =
          op === "append"
            ? (
                await tx.execute({
                  sql: "SELECT id FROM literary_entries WHERE author_id=? AND send_key=? AND space_id=?",
                  args: [actor, data.send_key || "", id],
                })
              ).rows[0]
            : null;
        if (!old) {
          if (op === "join" && data.consent !== "on")
            throw new Error("请确认入卷后雅号随卷展示");
          const m = await canJoin(tx, space, actor);
          if (op === "append" && m?.status !== "joined")
            throw new Error("请先入卷，再接续和作");
          await tx.execute({
            sql: "INSERT INTO literary_members(space_id,user_id,status,created_at) VALUES(?,?,'joined',?) ON CONFLICT(space_id,user_id) DO UPDATE SET status='joined'",
            args: [id, actor, now],
          });
          if (op === "append") {
            if (data.consent !== "on")
              throw new Error("请确认作品将按本卷范围展示");
            const done = (
              await tx.execute({
                sql: "SELECT 1 FROM literary_entries WHERE space_id=? AND author_id=?",
                args: [id, actor],
              })
            ).rows.length;
            if (done) throw new Error("本卷每位书友留一篇和作");
            await allowance(tx, actor, "append", now, 5);
            const position = Number(
              (
                await tx.execute({
                  sql: "SELECT COALESCE(MAX(position),0)+1 n FROM literary_entries WHERE space_id=?",
                  args: [id],
                })
              ).rows[0].n,
            );
            await tx.execute({
              sql: "INSERT INTO literary_entries(id,space_id,author_id,position,title,body,rhyme,vertical,created_at,send_key) VALUES(?,?,?,?,?,?,?,?,?,?)",
              args: [
                crypto.randomUUID(),
                id,
                actor,
                position,
                plainText(data.title, 80, 1),
                workBody(data.body),
                plainText(data.rhyme, 100),
                data.vertical === "on" ? 1 : 0,
                now,
                plainText(data.send_key, 80, 16),
              ],
            });
          }
        }
      }
    } else if (op === "withdraw") {
      const r = await tx.execute({
        sql: "UPDATE literary_entries SET withdrawn=1 WHERE id=? AND author_id=?",
        args: [data.id, actor],
      });
      if (!r.rowsAffected) throw new Error("只能收回自己的作品");
    } else if (op === "colophon") {
      const target = await readColophonTarget(tx, data.kind, data.id, actor);
      if (!target) throw new Error("此作品不可题跋");
      if (String(target.author_id) === actor)
        throw new Error("自己的说明可写在自注中");
      if (await blockedBetween(tx, actor, String(target.author_id)))
        throw new Error("暂时无法往来");
      if (data.consent !== "on") throw new Error("请确认题跋的展示范围");
      await allowance(tx, actor, "colophon", now, 10);
      const found = (
        await tx.execute({
          sql: "SELECT id FROM literary_colophons WHERE target_kind=? AND target_id=? AND author_id=?",
          args: [data.kind, data.id, actor],
        })
      ).rows.length;
      if (found) throw new Error("已为此篇留过题跋");
      await tx.execute({
        sql: "INSERT INTO literary_colophons(id,target_kind,target_id,author_id,body,created_at) VALUES(?,?,?,?,?,?)",
        args: [
          crypto.randomUUID(),
          data.kind,
          data.id,
          actor,
          plainText(data.body, 100, 1),
          now,
        ],
      });
    } else if (["collect", "decline_note", "withdraw_note"].includes(op)) {
      const note = (
        await tx.execute({
          sql: "SELECT * FROM literary_colophons WHERE id=?",
          args: [data.id],
        })
      ).rows[0];
      if (!note) throw new Error("此题跋不可处理");
      if (op === "withdraw_note") {
        const r = await tx.execute({
          sql: "UPDATE literary_colophons SET status='withdrawn',revision=revision+1 WHERE id=? AND author_id=?",
          args: [data.id, actor],
        });
        if (!r.rowsAffected) throw new Error("只能收回自己的题跋");
      } else {
        const target = await readColophonTarget(
          tx,
          String(note.target_kind),
          String(note.target_id),
          actor,
        );
        if (!target || String(target.author_id) !== actor)
          throw new Error("只有作品作者可以收录");
        if (await blockedBetween(tx, actor, String(note.author_id)))
          throw new Error("暂时无法往来");
        if (!/^\d+$/.test(data.revision || "")) throw new Error("请刷新后处理");
        const r = await tx.execute({
          sql: "UPDATE literary_colophons SET status=?,revision=revision+1 WHERE id=? AND status='pending' AND revision=?",
          args: [
            op === "collect" ? "accepted" : "declined",
            data.id,
            Number(data.revision),
          ],
        });
        if (!r.rowsAffected) throw new Error("此题跋已处理");
      }
    } else if (op === "report") {
      const target =
        data.kind === "entry"
          ? await readEntry(tx, data.id, actor)
          : data.kind === "space"
            ? await readSpace(tx, data.id, actor)
            : null;
      if (!target) throw new Error("此内容不可访问");
      await allowance(tx, actor, "report", now, 10);
      await tx.execute({
        sql: "INSERT OR IGNORE INTO literary_reports(id,target_kind,target_id,reporter_id,reason,created_at) VALUES(?,?,?,?,?,?)",
        args: [
          crypto.randomUUID(),
          data.kind,
          data.id,
          actor,
          plainText(data.reason, 500, 1),
          now,
        ],
      });
    } else if (op === "moderate") {
      if (me.role !== "admin") throw new Error("无权处理");
      const table =
        data.kind === "entry"
          ? "literary_entries"
          : data.kind === "space"
            ? "literary_spaces"
            : null;
      if (!table) throw new Error("目标无效");
      const r = await tx.execute({
        sql: `UPDATE ${table} SET hidden=? WHERE id=?`,
        args: [data.restore === "on" ? 0 : 1, data.id],
      });
      if (!r.rowsAffected) throw new Error("目标未找到");
      await tx.execute({
        sql: "INSERT INTO admin_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
        args: [
          crypto.randomUUID(),
          actor,
          `literary_${data.kind}_${data.restore === "on" ? "restore" : "hide"}`,
          data.id,
          now,
        ],
      });
    } else throw new Error("无法识别这项操作");
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
