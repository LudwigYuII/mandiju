const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdj-study-"));
process.env.MDJ_DB = path.join(dir, "test.db");
process.env.MDJ_ADMIN_PASS = "isolated-test-admin-only";
const { db, waitDb } = require("../lib/db.ts");
const { upgradeSchema } = require("../lib/schema-upgrades.ts");
const {
  studyMutation,
  readStudyInner,
  blockedBetween,
} = require("../lib/study-service.ts");
const { HOLD_UNTIL, canEnterStudy } = require("../lib/study-policy.ts");
const { canReadLetter } = require("../lib/letter-policy.ts");

test("study authorization, visit lifecycle, gifts and blocked delivery use real isolated transactions", async () => {
  try {
    await waitDb();
    await upgradeSchema(db); // Repeated migration must retain data and grants.
    const now = Date.parse("2026-11-13T12:00:00Z");
    for (const [id, name] of [
      ["a", "甲斋"],
      ["b", "乙斋"],
      ["c", "丙斋"],
      ["d", "丁斋"],
      ["e", "戊斋"],
      ["f", "己斋"],
      ["g", "庚斋"],
    ])
      await db.execute({
        sql: "INSERT INTO users(id,email,pen_name,password_hash,literary_name,created_at) VALUES(?,?,?,?,?,?)",
        args: [id, id + "@example.test", name, "not-a-login", name, now],
      });
    const run = (a, op, d, t = now) => studyMutation(db, a, op, d, t);
    await run("a", "profile", {
      name: "小窗书斋",
      public_intro: "公开序",
      inner_note: "PRIVATE INK",
      revision: "0",
    });
    await assert.rejects(
      () => run("a", "profile", { name: "覆盖", revision: "0" }),
      /另一处/,
    );
    assert.equal(await readStudyInner(db, "a", "b"), undefined);
    assert.equal(await readStudyInner(db, "a", "missing"), undefined);
    assert.equal(
      (await readStudyInner(db, "a", "a")).inner_note,
      "PRIVATE INK",
    );
    await db.execute({
      sql: "INSERT INTO friends(requester_id,addressee_id,status,created_at) VALUES('b','a','accepted',?)",
      args: [now],
    });
    assert.equal(
      await readStudyInner(db, "a", "b"),
      undefined,
      "existing penpal is not an inner-study grant",
    );
    await run("b", "visit", { target: "a", note: "问安" });
    await assert.rejects(
      () => run("b", "visit", { target: "a", note: "重复" }),
      /拜帖/,
    );
    await assert.rejects(
      () => run("c", "accept", { target: "b", revision: "0" }),
      /已处理/,
    );
    await run("a", "accept", { target: "b", revision: "0" });
    assert.equal(
      (await readStudyInner(db, "a", "b")).inner_note,
      "PRIVATE INK",
    );
    assert.equal(
      await readStudyInner(db, "b", "a"),
      undefined,
      "grant is one way",
    );
    await assert.rejects(
      () => run("a", "decline", { target: "b", revision: "0" }),
      /已处理/,
    );
    await run("a", "revoke", { target: "b", revision: "1" });
    assert.equal(await readStudyInner(db, "a", "b"), undefined);
    await assert.rejects(
      () => run("b", "visit", { target: "a", note: "再访" }),
      /暂不宜/,
    );
    await run("a", "reopen", { target: "b", revision: "2" });
    await run("b", "visit", { target: "a", note: "再访" }, now + 1);
    await run("a", "accept", { target: "b", revision: "4" }, now + 2);
    await assert.rejects(
      () =>
        run("c", "gift", {
          target: "a",
          kind: "tea",
          note: "无授权",
          send_key: "unauthorized-key-0001",
        }),
      /尺牍往来/,
    );
    await db.execute({
      sql: "UPDATE users SET retreat_until=? WHERE id=?",
      args: [now + 100000, "a"],
    });
    const gift = {
      target: "a",
      kind: "tea",
      note: "请茶",
      send_key: "duplicate-key-00001",
    };
    await run("b", "gift", gift);
    await run("b", "gift", gift);
    assert.equal(
      Number((await db.execute("SELECT COUNT(*) n FROM gifts")).rows[0].n),
      1,
    );
    const g = (await db.execute("SELECT * FROM gifts")).rows[0];
    await assert.rejects(
      () => run("a", "gift_accept", { target: "b", id: g.id }),
      /尚未送达/,
    );
    await assert.rejects(
      () => run("c", "gift_decline", { target: "b", id: g.id }, now + 100001),
      /已处理/,
    );
    await run("a", "gift_decline", { target: "b", id: g.id }, now + 100001);
    await assert.rejects(
      () => run("b", "gift", { ...gift, send_key: "second-key-000001" }),
      /改日/,
    );
    await assert.rejects(
      () =>
        run("b", "gift", {
          ...gift,
          kind: "coin",
          send_key: "invalid-key-00001",
        }),
      /小物/,
    );
    for (const [id, due] of [
      ["old", now - 1],
      ["pending", now + 50000],
    ])
      await db.execute({
        sql: "INSERT INTO letters(id,author_id,recipient_id,genre,title,body,postage,stamp_id,sent_at,deliver_at,original_deliver_at) VALUES(?,'b','a','letter','title','body','surface','X',?,?,?)",
        args: [id, now - 100, due, due],
      });
    await run("a", "block", { target: "b" });
    assert.equal(await blockedBetween(db, "a", "b"), true);
    assert.equal(await readStudyInner(db, "a", "b"), undefined);
    assert.equal(
      (await db.execute("SELECT deliver_at FROM letters WHERE id='old'"))
        .rows[0].deliver_at,
      now - 1,
    );
    const held = (await db.execute("SELECT * FROM letters WHERE id='pending'"))
      .rows[0];
    assert.equal(Number(held.deliver_at), HOLD_UNTIL);
    assert.equal(canReadLetter(held, "a", now + 1000000), false);
    await assert.rejects(
      () => run("b", "visit", { target: "a", note: "绕过" }),
      /暂时无法往来/,
    );
    await assert.rejects(
      () => run("b", "gift", { ...gift, send_key: "blocked-key-00001" }),
      /暂时无法往来/,
    );
    await run("b", "block", { target: "a" });
    await run("a", "unblock", { target: "b" });
    assert.equal(
      (await db.execute("SELECT deliver_at FROM letters WHERE id='pending'"))
        .rows[0].deliver_at,
      HOLD_UNTIL,
      "other side block still holds",
    );
    await run("b", "unblock", { target: "a" });
    assert.equal(
      (await db.execute("SELECT deliver_at FROM letters WHERE id='pending'"))
        .rows[0].deliver_at,
      now + 100000,
    );
    assert.equal(
      await readStudyInner(db, "a", "b"),
      undefined,
      "unblock does not restore inner-study permission",
    );
    assert.equal(canEnterStudy("a", "b", "accepted", true), false);
    // All event counting and mutation checks serialize within one write transaction.
    for (const id of ["a", "b", "d", "e", "f"])
      await run("c", "visit", { target: id, note: "问安" }, now + 1000);
    await assert.rejects(
      () => run("c", "visit", { target: "g", note: "过量" }, now + 1000),
      /改日/,
    );
    await run("a", "profile", {
      revision: "1",
      visits_closed: "on",
      gifts_closed: "on",
      inner_note: "PRIVATE INK",
    });
    await assert.rejects(
      () => run("d", "visit", { target: "a", note: "关门后" }),
      /暂不收拜帖/,
    );
    await assert.rejects(
      () =>
        run(
          "b",
          "gift",
          { ...gift, send_key: "closed-gift-00001" },
          now + 86400000,
        ),
      /暂不收赠答/,
    );
    await upgradeSchema(db);
    assert.equal(
      (await readStudyInner(db, "a", "a")).inner_note,
      "PRIVATE INK",
    );
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
