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
