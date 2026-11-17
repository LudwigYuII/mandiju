const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mdj-gathering-"));
process.env.MDJ_DB = path.join(dir, "site.db");
process.env.MDJ_ADMIN_PASS = "isolated-gathering-admin-pass";
const { db, waitDb } = require("../lib/db.ts");
const {
  gatheringMutation,
  readGathering,
  readGatheringPosts,
  readGatheringMembers,
  listGatherings,
} = require("../lib/gathering-service.ts");
const { gatheringTime } = require("../lib/gathering-policy.ts");
const { literaryMutation, readSpace } = require("../lib/literary-service.ts");
const { studyMutation } = require("../lib/study-service.ts");
test("gathering dates use the declared zone and reject invalid or ambiguous local dates", () => {
  assert.equal(
    gatheringTime("2026-11-18T12:30"),
    Date.parse("2026-11-18T04:30:00Z"),
  );
  for (const v of [
    "2026-02-30T12:30",
    "2026-11-18",
    "2026-11-18T25:30",
    "2026-11-18T12:30Z",
  ])
    assert.throws(() => gatheringTime(v));
  const { spawnSync } = require("node:child_process");
  const r = spawnSync(
    process.execPath,
    [
      "--require",
      "tsx/cjs",
      "-e",
      `const a=require('node:assert/strict');const {gatheringTime:g}=require('./lib/gathering-policy.ts');a.throws(()=>g('2026-03-08T02:30'));a.throws(()=>g('2026-11-01T01:30'));a.equal(g('2026-11-01T03:30'),Date.parse('2026-11-01T08:30:00Z'))`,
    ],
    { env: { ...process.env, NEXT_PUBLIC_SITE_TIME_ZONE: "America/New_York" } },
  );
  assert.equal(r.status, 0, r.stderr.toString());
});
test("real gathering transactions enforce private invitations, time, explicit archive grants and immutable archives", async () => {
  try {
    await waitDb();
    const now = Date.parse("2026-11-17T00:00Z"),
      start = Date.parse("2026-11-18T00:00Z"),
      end = Date.parse("2026-11-18T02:00Z");
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
    await db.execute({
      sql: "INSERT INTO friends(requester_id,addressee_id,status,created_at) VALUES('a','b','accepted',?)",
      args: [now],
    });
    const run = (actor, op, data, t = now) =>
      gatheringMutation(db, actor, op, data, t);
    const data = {
      title: "PRIVATE_GATHERING",
      intro: "PRIVATE_INTRO",
      starts_at: "2026-11-18T08:00",
      ends_at: "2026-11-18T10:00",
      capacity: "2",
      invitees: "乙笺",
      consent: "on",
      send_key: "private-gathering-key1",
    };
    await assert.rejects(
      () => run("a", "create", { ...data, ends_at: data.starts_at }),
      /七日/,
    );
    const { id } = await run("a", "create", data);
    assert.equal((await run("a", "create", data)).id, id);
    assert.equal(await readGathering(db, id), undefined);
    assert.equal(await readGathering(db, id, "c"), undefined);
    assert.equal((await listGatherings(db)).length, 0);
    assert.equal(await readSpace(db, id, "a"), undefined);
    await assert.rejects(
      () => literaryMutation(db, "a", "close", { id }, now),
      /不可访问/,
    );
    assert.ok(await readGathering(db, id, "b"));
    assert.equal((await readGatheringPosts(db, id, "b", 0, start)).length, 0);
    await assert.rejects(() => run("c", "join", { id, consent: "on" }), /受邀/);
    await assert.rejects(() => run("b", "join", { id }), /确认/);
    await run("b", "join", { id, consent: "on", archive: "on" });
    const post = {
      id,
      body: "PRIVATE_ARCHIVE_BODY",
      consent: "on",
      archive: "on",
      send_key: "gathering-post-key01",
    };
    await assert.rejects(() => run("b", "post", post, start - 1), /进行期间/);
    await run("b", "post", post, start);
    await run("b", "post", post, start);
    await run(
      "a",
      "post",
      {
        ...post,
        body: "PRIVATE_TRANSIENT_BODY",
        archive: "",
        send_key: "gathering-post-key02",
      },
      start + 1,
    );
    assert.equal((await readGatheringPosts(db, id, "a", 0, end - 1)).length, 2);
    assert.equal((await readGatheringPosts(db, id, "b", 0, end)).length, 1);
    assert.equal((await readGatheringPosts(db, id, "c", 0, end)).length, 0);
    assert.equal(
      (await readGatheringPosts(db, id, "b", 0, end))[0].body,
      "PRIVATE_ARCHIVE_BODY",
    );
    assert.deepEqual(
      (await readGatheringMembers(db, id, "a", end)).map((m) => m.user_id),
      ["b"],
    );
    await assert.rejects(
      () =>
        run("a", "post", { ...post, send_key: "late-gathering-key01" }, end),
      /进行期间/,
    );
    await assert.rejects(
      () => run("a", "join", { id, consent: "on" }, end),
      /已结束/,
    );
    await assert.rejects(
      () => run("a", "archive_identity", { id, archive: "on" }, end),
      /不能扩大/,
    );
    await assert.rejects(() => run("a", "close", { id }, end), /已结束/);
    await assert.rejects(
      () => run("a", "revoke", { id, target: "b" }, end),
      /已结束/,
    );
    const p = (await readGatheringPosts(db, id, "b", 0, end))[0];
    await assert.rejects(
      () => run("c", "unarchive", { id: String(p.id) }, end),
      /自己的/,
    );
    await run("b", "unarchive", { id: String(p.id) }, end);
    assert.equal((await readGatheringPosts(db, id, "a", 0, end)).length, 0);
    assert.equal(
      (
        await db.execute({
          sql: "SELECT body FROM gathering_posts WHERE id=?",
          args: [String(p.id)],
        })
      ).rows[0].body,
      "PRIVATE_ARCHIVE_BODY",
    );
    await run("b", "archive_identity", { id }, end);
    assert.equal((await readGatheringMembers(db, id, "a", end)).length, 0);
    await run("b", "leave", { id }, end);
    assert.equal(await readGathering(db, id, "b"), undefined);
    const pub = (
      await run("c", "create", {
        ...data,
        title: "PUBLIC_GATHERING",
        invitees: "",
        visibility: "public",
        send_key: "public-gathering-key1",
      })
    ).id;
    const racing = await Promise.allSettled([
      run("a", "join", { id: pub, consent: "on" }),
      run("d", "join", { id: pub, consent: "on" }),
    ]);
    assert.equal(racing.filter((x) => x.status === "fulfilled").length, 1);
    const member = (
      await db.execute({
        sql: "SELECT user_id FROM literary_members WHERE space_id=? AND user_id<>'c' AND status='joined'",
        args: [pub],
      })
    ).rows[0];
    await run(
      "c",
      "post",
      {
        ...post,
        id: pub,
        body: "PUBLIC_ARCHIVE_BODY",
        send_key: "public-gathering-post1",
      },
      start,
    );
    const pp = (await readGatheringPosts(db, pub, "", 0, end))[0];
    assert.equal(pp.body, "PUBLIC_ARCHIVE_BODY");
    await run(
      "a",
      "report_post",
      { id: String(pp.id), reason: "匿名以外的反馈" },
      end,
    );
    await assert.rejects(
      () => run("a", "moderate_post", { id: String(pp.id) }, end),
      /无权/,
    );
    const admin = (
      await db.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    ).rows[0];
    await db.execute({
      sql: "UPDATE users SET literary_name='站主' WHERE id=?",
      args: [String(admin.id)],
    });
    await run(String(admin.id), "moderate_post", { id: String(pp.id) }, end);
    assert.equal((await readGatheringPosts(db, pub, "", 0, end)).length, 0);
    await run(
      String(admin.id),
      "moderate_post",
      { id: String(pp.id), restore: "on" },
      end,
    );
    assert.equal((await readGatheringPosts(db, pub, "", 0, end)).length, 1);
    assert.equal(
      Number(
        (
          await db.execute(
            "SELECT COUNT(*) n FROM admin_audit WHERE action LIKE 'gathering_post_%'",
          )
        ).rows[0].n,
      ),
      2,
    );
    await studyMutation(
      db,
      "c",
      "block",
      { target: String(member.user_id) },
      start,
    );
    await assert.rejects(
      () =>
        run(
          String(member.user_id),
          "post",
          { ...post, id: pub, send_key: "blocked-gathering-key1" },
          start,
        ),
      /无法往来/,
    );
    await run("c", "close", { id: pub }, start + 100);
    assert.equal(Number((await readGathering(db, pub)).ends_at), start + 100);
    await assert.rejects(
      () =>
        run(
          "c",
          "post",
          { ...post, id: pub, send_key: "closed-gathering-key1" },
          start + 100,
        ),
      /进行期间/,
    );
    // A later invite never gains access by calling a different literary endpoint.
    await assert.rejects(
      () => literaryMutation(db, "d", "join", { id: pub, consent: "on" }, now),
      /不可访问/,
    );
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
