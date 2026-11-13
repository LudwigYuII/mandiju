import type { Client, Transaction } from "@libsql/client";
import {
  GIFT_KINDS,
  HOLD_UNTIL,
  VISIT_COOLDOWN,
  plainText,
} from "./study-policy";
import { siteDateKey } from "./time";

type Sql = Pick<Client, "execute"> | Pick<Transaction, "execute">;
export async function blockedBetween(
  q: Sql,
  a: string,
  b: string,
): Promise<boolean> {
  return (
    (
      await q.execute({
        sql: "SELECT 1 FROM user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1",
        args: [a, b, b, a],
      })
    ).rows.length > 0
  );
}
async function active(q: Sql, id: string) {
  const u = (
    await q.execute({
      sql: "SELECT id,role,literary_name,retreat_until FROM users WHERE id=? AND banned=0",
      args: [id],
    })
  ).rows[0];
  if (!u?.literary_name) throw new Error("请先题定雅号，再继续往来");
  return u;
}
async function event(
  q: Sql,
  actor: string,
  target: string,
  kind: "visit" | "gift",
  now: number,
) {
  const day = siteDateKey(new Date(now));
  const rows = (
    await q.execute({
      sql: "SELECT target_id FROM study_events WHERE actor_id=? AND kind=? AND day_key=?",
      args: [actor, kind, day],
    })
  ).rows;
  if (
    rows.length >= 5 ||
    (kind === "gift" && rows.some((r) => String(r.target_id) === target))
  )
    throw new Error("今日先歇笔，改日再来");
  await q.execute({
    sql: "INSERT INTO study_events(id,actor_id,target_id,kind,day_key,created_at) VALUES(?,?,?,?,?,?)",
    args: [crypto.randomUUID(), actor, target, kind, day, now],
  });
  // Keep only a short, private anti-abuse ledger; never expose these counts.
  await q.execute({
    sql: "DELETE FROM study_events WHERE created_at<?",
    args: [now - 35 * 86400000],
  });
}
async function notice(q: Sql, uid: string, key: string, body: string) {
  await q.execute({
    sql: "INSERT OR IGNORE INTO notifications(id,user_id,type,body,link,created_at,event_key) VALUES(?,?,'friend',?,'/visits',?,?)",
    args: [crypto.randomUUID(), uid, body, Date.now(), key],
  });
}
export async function studyMutation(
  client: Client,
  actor: string,
  op: string,
  data: Record<string, string>,
  timestamp?: number,
) {
  const tx = await client.transaction("write");
  const now = timestamp ?? Date.now();
  try {
    await active(tx, actor);
    if (op === "profile") {
      const name = plainText(data.name, 20);
      if (name && Array.from(name).length < 2)
        throw new Error("书斋名请写二至二十字");
      const intro = plainText(data.public_intro, 500),
        note = plainText(data.inner_note, 5000);
      const revision = Number(data.revision);
      if (!Number.isSafeInteger(revision) || revision < 0)
        throw new Error("请刷新书斋再保存");
      await tx.execute({
        sql: "INSERT OR IGNORE INTO study_profiles(owner_id,updated_at) VALUES(?,?)",
        args: [actor, now],
      });
      const r = await tx.execute({
        sql: "UPDATE study_profiles SET name=?,public_intro=?,inner_note=?,visits_closed=?,gifts_closed=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?",
        args: [
          name,
          intro,
          note,
          data.visits_closed === "on" ? 1 : 0,
          data.gifts_closed === "on" ? 1 : 0,
          now,
          actor,
          revision,
        ],
      });
      if (!r.rowsAffected) throw new Error("另一处已修改书斋，请刷新后重试");
    } else {
      const target = plainText(data.target, 100, 1);
      if (target === actor) throw new Error("请选另一位书友");
      if (op === "unblock") {
        await tx.execute({
          sql: "DELETE FROM user_blocks WHERE blocker_id=? AND blocked_id=?",
          args: [actor, target],
        });
        if (!(await blockedBetween(tx, actor, target))) {
          await tx.execute({
            sql: `UPDATE letters SET deliver_at=MAX(COALESCE(original_deliver_at,blocked_deliver_at),COALESCE((SELECT retreat_until FROM users WHERE id=recipient_id),0)),blocked_deliver_at=NULL WHERE blocked_deliver_at IS NOT NULL AND ((author_id=? AND recipient_id=?) OR (author_id=? AND recipient_id=?))`,
            args: [actor, target, target, actor],
          });
        }
      } else if (op === "block") {
        const exists = (
          await tx.execute({
            sql: "SELECT id FROM users WHERE id=?",
            args: [target],
          })
        ).rows.length;
        if (!exists) throw new Error("未找到这位书友");
        await tx.execute({
          sql: "INSERT OR IGNORE INTO user_blocks(blocker_id,blocked_id,created_at) VALUES(?,?,?)",
          args: [actor, target, now],
        });
        await tx.execute({
          sql: "UPDATE study_visits SET status='revoked',retry_at=?,updated_at=?,revision=revision+1 WHERE ((owner_id=? AND visitor_id=?) OR (owner_id=? AND visitor_id=?)) AND status IN ('pending','accepted')",
          args: [now + VISIT_COOLDOWN, now, actor, target, target, actor],
        });
        await tx.execute({
          sql: "UPDATE letters SET blocked_deliver_at=deliver_at,deliver_at=? WHERE deliver_at>? AND blocked_deliver_at IS NULL AND ((author_id=? AND recipient_id=?) OR (author_id=? AND recipient_id=?))",
          args: [HOLD_UNTIL, now, actor, target, target, actor],
        });
      } else {
        // Owners must still be able to withdraw/revoke a grant to an inactive account.
        const managing = [
          "accept",
          "decline",
          "revoke",
          "reopen",
          "withdraw",
          "gift_accept",
          "gift_decline",
        ].includes(op);
        const peer =
          managing && op !== "accept" && op !== "reopen"
            ? (
                await tx.execute({
                  sql: "SELECT role,retreat_until FROM users WHERE id=?",
                  args: [target],
                })
              ).rows[0]
            : await active(tx, target);
        if (await blockedBetween(tx, actor, target))
          throw new Error("暂时无法往来");
        if (op === "visit") {
          const prefs = (
            await tx.execute({
              sql: "SELECT visits_closed FROM study_profiles WHERE owner_id=?",
              args: [target],
            })
          ).rows[0];
          if (Number(prefs?.visits_closed)) throw new Error("主人暂不收拜帖");
          const note = plainText(data.note, 100, 1);
          const old = (
            await tx.execute({
              sql: "SELECT status,retry_at FROM study_visits WHERE owner_id=? AND visitor_id=?",
              args: [target, actor],
            })
          ).rows[0];
          if (
            old &&
            (["pending", "accepted"].includes(String(old.status)) ||
              Number(old.retry_at) > now)
          )
            throw new Error("拜帖已在途中，或暂不宜重递");
          await event(tx, actor, target, "visit", now);
          await tx.execute({
            sql: "INSERT INTO study_visits(owner_id,visitor_id,note,status,created_at,updated_at) VALUES(?,?,?,'pending',?,?) ON CONFLICT(owner_id,visitor_id) DO UPDATE SET note=excluded.note,status='pending',created_at=excluded.created_at,updated_at=excluded.updated_at,retry_at=0,revision=study_visits.revision+1",
            args: [target, actor, note, now, now],
          });
          await notice(
            tx,
            target,
            `visit:${target}:${actor}:${now}`,
            "门前有一封拜帖，可在方便时阅看。",
          );
        } else if (
          ["accept", "decline", "revoke", "reopen", "withdraw"].includes(op)
        ) {
          const owner = op === "withdraw" ? target : actor,
            visitor = op === "withdraw" ? actor : target;
          const from =
            op === "revoke" ? "accepted" : op === "reopen" ? null : "pending";
          const status =
            op === "accept"
              ? "accepted"
              : op === "decline"
                ? "declined"
                : op === "withdraw"
                  ? "withdrawn"
                  : "revoked";
          if (!/^\d+$/.test(data.revision || ""))
            throw new Error("请刷新拜帖再处理");
          const r = await tx.execute({
            sql: `UPDATE study_visits SET status=?,updated_at=?,retry_at=?,revision=revision+1 WHERE owner_id=? AND visitor_id=? AND revision=? AND ${from ? "status=?" : "status IN ('declined','revoked','withdrawn')"}`,
            args: [
              status,
              now,
              op === "accept" || op === "reopen" ? 0 : now + VISIT_COOLDOWN,
              owner,
              visitor,
              Number(data.revision),
              ...(from ? [from] : []),
            ],
          });
          if (!r.rowsAffected) throw new Error("这封拜帖已处理，请刷新");
          if (op === "accept")
            await notice(
              tx,
              target,
              `visit-accepted:${actor}:${target}:${now}`,
              "拜帖已获接见，可择时入斋。",
            );
        } else if (op === "gift") {
          const key = plainText(data.send_key, 80, 16);
          const existing = (
            await tx.execute({
              sql: "SELECT id FROM gifts WHERE sender_id=? AND send_key=?",
              args: [actor, key],
            })
          ).rows[0];
          if (!existing) {
            if (!Object.hasOwn(GIFT_KINDS, data.kind))
              throw new Error("请选一种小物");
            const prefs = (
              await tx.execute({
                sql: "SELECT gifts_closed FROM study_profiles WHERE owner_id=?",
                args: [target],
              })
            ).rows[0];
            if (Number(prefs?.gifts_closed)) throw new Error("对方暂不收赠答");
            const me = (
              await tx.execute({
                sql: "SELECT role FROM users WHERE id=?",
                args: [actor],
              })
            ).rows[0];
            const permitted =
              me?.role === "admin" ||
              peer.role === "admin" ||
              (
                await tx.execute({
                  sql: "SELECT 1 FROM friends WHERE status='accepted' AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)) UNION ALL SELECT 1 FROM letters WHERE author_id=? AND recipient_id=? AND deliver_at<=? LIMIT 1",
                  args: [actor, target, target, actor, target, actor, now],
                })
              ).rows.length > 0;
            if (!permitted) throw new Error("先有尺牍往来，再赠一件小物");
            const note = plainText(data.note, 100);
            await event(tx, actor, target, "gift", now);
            await tx.execute({
              sql: "INSERT INTO gifts(id,sender_id,recipient_id,kind,note,created_at,available_at,send_key) VALUES(?,?,?,?,?,?,?,?)",
              args: [
                crypto.randomUUID(),
                actor,
                target,
                data.kind,
                note,
                now,
                Math.max(now, Number(peer.retreat_until || 0)),
                key,
              ],
            });
          }
        } else if (op === "gift_accept" || op === "gift_decline") {
          const r = await tx.execute({
            sql: "UPDATE gifts SET status=? WHERE id=? AND sender_id=? AND recipient_id=? AND status='pending' AND available_at<=?",
            args: [
              op === "gift_accept" ? "accepted" : "declined",
              data.id,
              target,
              actor,
              now,
            ],
          });
          if (!r.rowsAffected) throw new Error("这份赠答已处理，或尚未送达");
        } else throw new Error("无法识别这项操作");
      }
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}

/** One authorized query prevents revocation races from disclosing private text. */
export async function readStudyInner(q: Sql, owner: string, viewer: string) {
  return (
    await q.execute({
      sql: `SELECT inner_note FROM study_profiles p
    WHERE owner_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND banned=0)
    AND EXISTS(SELECT 1 FROM users WHERE id=p.owner_id AND banned=0)
    AND (?=owner_id OR (EXISTS(SELECT 1 FROM study_visits v WHERE v.owner_id=p.owner_id AND v.visitor_id=? AND v.status='accepted')
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=? AND b.blocked_id=owner_id) OR (b.blocker_id=owner_id AND b.blocked_id=?))))`,
      args: [owner, viewer, viewer, viewer, viewer, viewer],
    })
  ).rows[0];
}
