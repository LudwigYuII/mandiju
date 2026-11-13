const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const sharp = require("sharp");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "yaji-migration-"));
process.env.MDJ_DB = path.join(directory, "site.db");
process.env.MDJ_ADMIN_PASS = "test-migration-admin-passphrase";
process.env.MDJ_PRIVATE_STORAGE = path.join(directory, "private");
for (const key of [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PRIVATE_BUCKET",
])
  delete process.env[key];
const { db, waitDb } = require("../lib/db.ts");
const name = crypto.randomUUID() + ".jpg";
const ref = "uploads/" + name;
const publicFile = path.join(process.cwd(), "public", ref);
test.after(() => {
  db.close();
  fs.rmSync(publicFile, { force: true });
  fs.rmSync(directory, { recursive: true, force: true });
});
test("legacy attachment migration is dry-run first and later retirement is resumable", async () => {
  await waitDb();
  fs.mkdirSync(path.dirname(publicFile), { recursive: true });
  fs.writeFileSync(
    publicFile,
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#758171" },
    })
      .jpeg()
      .toBuffer(),
  );
  await db.execute(
    "INSERT INTO users(id,email,pen_name,password_hash,created_at) VALUES('owner','migration@example.test','旧信主','hash',1)",
  );
  await db.execute({
    sql: "INSERT INTO letters(id,author_id,recipient_id,genre,title,body,postage,stamp_id,sent_at,deliver_at,image) VALUES('old','owner','owner','letter','title','body','capsule','B01',1,9999999999999,?)",
    args: [ref],
  });
  const run = (...args) =>
    spawnSync(
      process.execPath,
      ["--require", "tsx/cjs", "tools/migrate-private-media.cjs", ...args],
      { env: process.env, encoding: "utf8" },
    );
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    (await db.execute("SELECT image FROM letters WHERE id='old'")).rows[0]
      .image,
    ref,
  );
  result = run("--apply", "--backup-verified");
  assert.equal(result.status, 0, result.stderr);
  const row = (
    await db.execute("SELECT image,deliver_at FROM letters WHERE id='old'")
  ).rows[0];
  assert.match(String(row.image), /^api\/media\//);
  assert.equal(Number(row.deliver_at), 9999999999999);
  assert.equal(fs.existsSync(publicFile), true);
  result = run("--apply", "--backup-verified", "--retire-public");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(publicFile), false);
  const media = (
    await db.execute("SELECT object_key,legacy_retired FROM media")
  ).rows[0];
  assert.equal(Number(media.legacy_retired), 1);
  assert.ok(
    fs.existsSync(
      path.join(process.env.MDJ_PRIVATE_STORAGE, String(media.object_key)),
    ),
  );
  result = run("--apply", "--backup-verified", "--retire-public");
  assert.equal(result.status, 0, result.stderr);
});
