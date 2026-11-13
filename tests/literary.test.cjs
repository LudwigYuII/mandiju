const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdj-literary-"));
process.env.MDJ_DB = path.join(dir, "site.db");
process.env.MDJ_ADMIN_PASS = "isolated-literary-admin-pass";
const { db, waitDb } = require("../lib/db.ts");
const {
  literaryMutation,
  readSpace,
  readEntry,
  readEntries,
  readColophons,
} = require("../lib/literary-service.ts");
const { annotationParts,workBody } = require("../lib/literary-policy.ts");
const { studyMutation } = require("../lib/study-service.ts");
test("annotations preserve literal input and never interpret malformed syntax", () => {
  assert.equal(workBody("  诗行\n\n"),"  诗行\n\n");
  assert.deepEqual(annotationParts("春[[江|引文出处]]水"), [
    { text: "春" },
    { text: "江", note: "引文出处" },
    { text: "水" },
  ]);
  assert.deepEqual(annotationParts("[[未完|注释"), [{ text: "[[未完|注释" }]);
  assert.equal(
    annotationParts("[[江|<script>alert(1)</script>]]")[0].note,
    "<script>alert(1)</script>",
  );
});
test("real scroll transactions protect membership, capacity, ordering, colophon consent and withdrawal", async () => {
  try {
    await waitDb();
    const now = Date.now();
    for (const [id, name] of [
      ["a", "甲笺"],
      ["b", "乙笺"],
      ["c", "丙笺"],
      ["d", "丁笺"],
    ])
      await db.execute({
        sql: "INSERT INTO users(id,email,pen_name,password_hash,literary_name,created_at) VALUES(?,?,?,?,?,?)",
        args: [id, id + "@example.test", name, "not-a-login", name, now],
      });
    const run = (a, op, data) => literaryMutation(db, a, op, data, now);
    const start = {
      title: "私卷题",
      body: "PRIVATE_SCROLL_BODY",
      capacity: "3",
      visibility: "private",
      consent: "on",
      send_key: "private-start-key-001",
      invitees: "乙笺",
    };
    await assert.rejects(() => run("a", "create", start), /尺牍往来/);
    await db.execute({
      sql: "INSERT INTO friends(requester_id,addressee_id,status,created_at) VALUES('a','b','accepted',?)",
      args: [now],
    });
    const { id } = await run("a", "create", start);
    assert.equal((await run("a", "create", start)).id, id);
    assert.equal(await readSpace(db, id, "c"), undefined);
    assert.equal(await readSpace(db, id), undefined);
    assert.equal(
      (await readEntries(db, id, "b")).length,
      0,
      "invite is metadata-only before joining",
    );
    assert.equal((await readSpace(db, id, "b")).title, "私卷题");
    await assert.rejects(() => run("c", "join", { id, consent: "on" }), /受邀/);
    await assert.rejects(() => run("b", "join", { id }), /确认/);
    await run("b", "join", { id, consent: "on" });
    assert.equal(
      (await readEntries(db, id, "b"))[0].body,
      "PRIVATE_SCROLL_BODY",
    );
    const first = (await readEntries(db, id, "a"))[0];
    assert.equal(await readEntry(db, String(first.id), "c"), undefined);
    const add = {
      id,
      title: "和作",
      body: "PRIVATE_REPLY_BODY",
      consent: "on",
      send_key: "append-key-0000001",
    };
    await run("b", "append", add);
    await run("b", "append", add);
    assert.equal((await readEntries(db, id, "a")).length, 2);
    assert.deepEqual(
      (await readEntries(db, id, "a")).map((x) => Number(x.position)),
      [1, 2],
    );
    await assert.rejects(
      () => run("b", "append", { ...add, send_key: "append-key-0000002" }),
      /每位书友/,
    );
    await assert.rejects(
      () =>
        run("c", "colophon", {
          kind: "entry",
          id: String(first.id),
          body: "窥视",
          consent: "on",
        }),
      /不可题跋/,
    );
    await run("b", "colophon", {
      kind: "entry",
      id: String(first.id),
      body: "好一江春水",
      consent: "on",
    });
    const note = (await readColophons(db, "entry", String(first.id), "a"))[0];
    assert.equal(
      (await readColophons(db, "entry", String(first.id), "c")).length,
      0,
    );
    await assert.rejects(
      () => run("c", "collect", { id: String(note.id), revision: "0" }),
      /只有作品作者/,
    );
    await run("a", "collect", { id: String(note.id), revision: "0" });
    assert.equal(
      (await readColophons(db, "entry", String(first.id), "b"))[0].status,
      "accepted",
    );
    await run("b", "withdraw_note", { id: String(note.id) });
    assert.equal(
      (await readColophons(db, "entry", String(first.id), "a")).length,
      0,
      "withdrawal removes text from the original work author too",
    );
    await run("a", "revoke_member", { id, target: "b" });
    assert.equal(await readSpace(db, id, "b"), undefined);
    const mine = (
      await db.execute("SELECT id FROM literary_entries WHERE author_id='b'")
    ).rows[0];
    assert.equal(
      (await readEntry(db, String(mine.id), "b")).body,
      "PRIVATE_REPLY_BODY",
      "revoked author retains only their own work",
    );
    await run("b", "withdraw", { id: String(mine.id) });
    const removed = (await readEntries(db, id, "a")).find(
      (e) => e.author_id === "b",
    );
    assert.equal(removed.body, "");
    assert.equal(removed.title, "（已收回）");
    assert.equal(
      (await readEntry(db, String(mine.id), "b")).body,
      "PRIVATE_REPLY_BODY",
    );
    const pub = (
      await run("c", "create", {
        title: "公卷",
        body: "PUBLIC_SCROLL_BODY",
        visibility: "public",
        capacity: "2",
        consent: "on",
        send_key: "public-start-key-001",
      })
    ).id;
    assert.equal((await readEntries(db, pub))[0].body, "PUBLIC_SCROLL_BODY");
    const results = await Promise.allSettled([
      run("a", "join", { id: pub, consent: "on" }),
      run("d", "join", { id: pub, consent: "on" }),
    ]);
    assert.equal(
      results.filter((x) => x.status === "fulfilled").length,
      1,
      "capacity cannot overbook",
    );
    const member = (
      await db.execute({
        sql: "SELECT user_id FROM literary_members WHERE space_id=? AND user_id<>'c'",
        args: [pub],
      })
    ).rows[0];
    await studyMutation(
      db,
      "c",
      "block",
      { target: String(member.user_id) },
      now,
    );
    await assert.rejects(
      () =>
        run(String(member.user_id), "append", {
          id: pub,
          title: "绕过",
          body: "blocked",
          consent: "on",
          send_key: "blocked-append-key1",
        }),
      /无法往来/,
    );
    await run("c", "close", { id: pub });
    await assert.rejects(
      () => run("b", "join", { id: pub, consent: "on" }),
      /暂不接续/,
    );
    // Only already public and delivered historical letters can receive literary colophons.
    for (const [lid, recipient, due] of [
      ["old-private", "b", now - 1],
      ["old-pending", null, now + 86400000],
      ["old-public", null, now - 1],
    ])
      await db.execute({
        sql: "INSERT INTO letters(id,author_id,recipient_id,genre,title,body,postage,stamp_id,sent_at,deliver_at) VALUES(?,'a',?,'poem','旧诗','旧文','surface','X',1,?)",
        args: [lid, recipient, due],
      });
    for (const lid of ["old-private", "old-pending"])
      await assert.rejects(
        () =>
          run("b", "colophon", {
            kind: "letter",
            id: lid,
            body: "不应进入",
            consent: "on",
          }),
        /不可题跋/,
      );
    await run("b", "colophon", {
      kind: "letter",
      id: "old-public",
      body: "旧笺新读",
      consent: "on",
    });
    assert.equal(
      (await readColophons(db, "letter", "old-public", "c")).length,
      0,
    );
    const pending = (await readColophons(db, "letter", "old-public", "a"))[0];
    await run("a", "collect", { id: String(pending.id), revision: "0" });
    assert.equal((await readColophons(db, "letter", "old-public")).length, 1);
    await assert.rejects(
      () => run("c", "moderate", { kind: "space", id: pub }),
      /无权/,
    );
    const admin = (
      await db.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    ).rows[0];
    await db.execute({
      sql: "UPDATE users SET literary_name='站主' WHERE id=?",
      args: [String(admin.id)],
    });
    await run("c", "report", { kind: "space", id: pub, reason: "测试反馈" });
    await run(String(admin.id), "moderate", { kind: "space", id: pub });
    assert.equal(await readSpace(db, pub), undefined);
    assert.equal(
      Number(
        (
          await db.execute(
            "SELECT COUNT(*) n FROM admin_audit WHERE action='literary_space_hide'",
          )
        ).rows[0].n,
      ),
      1,
    );
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
