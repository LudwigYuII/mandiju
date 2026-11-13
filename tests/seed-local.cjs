if (
  process.env.MDJ_TEST_FIXTURE !== "1" ||
  !process.env.MDJ_DB?.includes("yaji-test-")
)
  throw new Error("This fixture only runs against an isolated test database");
const { db, waitDb } = require("../lib/db.ts");
const { SignJWT } = require("jose");
const fs = require("node:fs");
(async () => {
  await waitDb();
  const now = Date.now();
  for (const [id, pen] of [
    ["fixture-a", "甲笺"],
    ["fixture-b", "乙笺"],
    ["fixture-c", "丙笺"],
  ]) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO users(id,email,pen_name,password_hash,onboarded_at,created_at) VALUES(?,?,?,?,?,?)",
      args: [id, id + "@example.test", pen, "unused", now, now],
    });
  }
  const letter = (
    id,
    author,
    recipient,
    title,
    body,
    at,
    postage = "surface",
    reply = null,
  ) =>
    db.execute({
      sql: "INSERT OR IGNORE INTO letters(id,author_id,recipient_id,genre,title,body,postage,stamp_id,city,sent_at,deliver_at,reply_to) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        id,
        author,
        recipient,
        "letter",
        title,
        body,
        postage,
        "B01",
        "PENDING_CITY",
        now,
        at,
        reply,
      ],
    });
  await letter(
    "fixture-pending",
    "fixture-a",
    "fixture-b",
    "PENDING_PRIVATE_TITLE",
    "PENDING_PRIVATE_BODY",
    now + 86400000,
  );
  await letter(
    "fixture-delivered",
    "fixture-a",
    "fixture-b",
    "DELIVERED_PRIVATE_TITLE",
    "DELIVERED_PRIVATE_BODY",
    now - 1000,
  );
  await letter(
    "fixture-capsule",
    "fixture-b",
    "fixture-b",
    "CAPSULE_TITLE",
    "CAPSULE_HIDDEN_BODY",
    now + 86400000,
    "capsule",
  );
  await letter(
    "fixture-public",
    "fixture-a",
    null,
    "PUBLIC_TITLE",
    "PUBLIC_BODY",
    now - 1000,
    "surface",
    "fixture-pending",
  );
  await db.execute("UPDATE users SET literary_name=pen_name WHERE id LIKE 'fixture-%'");
  await db.execute({sql:"INSERT INTO study_profiles(owner_id,name,public_intro,inner_note,updated_at) VALUES('fixture-a','测试书斋','PUBLIC_STUDY_INTRO','PRIVATE_STUDY_NOTE',?)",args:[now]});
  await db.execute({sql:"INSERT INTO study_visits(owner_id,visitor_id,note,status,created_at,updated_at) VALUES('fixture-a','fixture-b','问安','accepted',?,?)",args:[now,now]});
  await db.execute({sql:"INSERT INTO literary_spaces(id,owner_id,title,intro,visibility,capacity,created_at,send_key) VALUES('fixture-private-scroll','fixture-a','PRIVATE_SCROLL_TITLE','PRIVATE_SCROLL_INTRO','private',2,?,'fixture-scroll-private-key'),('fixture-public-scroll','fixture-a','PUBLIC_SCROLL_TITLE','PUBLIC_SCROLL_INTRO','public',12,?,'fixture-scroll-public-key')",args:[now,now]});
  for(const id of ['fixture-private-scroll','fixture-public-scroll'])await db.execute({sql:"INSERT INTO literary_members(space_id,user_id,status,created_at) VALUES(?,'fixture-a','joined',?)",args:[id,now]});
  await db.execute({sql:"INSERT INTO literary_members(space_id,user_id,status,created_at) VALUES('fixture-private-scroll','fixture-b','invited',?)",args:[now]});
  await db.execute({sql:"INSERT INTO literary_entries(id,space_id,author_id,position,title,body,created_at,send_key) VALUES('fixture-private-work','fixture-private-scroll','fixture-a',1,'PRIVATE_WORK_TITLE','PRIVATE_WORK_BODY',?,'private-work-key'),('fixture-public-work','fixture-public-scroll','fixture-a',1,'PUBLIC_WORK_TITLE','春[[江|引文出处]]水',?,'public-work-key')",args:[now,now]});
  const tokens = {};
  for (const id of ["fixture-a", "fixture-b", "fixture-c"])
    tokens[id] = await new SignJWT({ uid: id, av: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.MDJ_SECRET));
  fs.writeFileSync(process.env.MDJ_TEST_COOKIES, JSON.stringify(tokens), {
    mode: 0o600,
  });
  db.close();
  console.log("Anonymous local fixture ready.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
