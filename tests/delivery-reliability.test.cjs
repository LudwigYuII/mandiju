const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "yaji-delivery-"));
process.env.MDJ_DB = path.join(directory, "site.db");
process.env.MDJ_ADMIN_PASS = "test-only-admin-passphrase";
// Keep external channels disabled in this isolated test process.
delete process.env.RESEND_API_KEY;
delete process.env.MDJ_VAPID_PRIVATE;
const { db, waitDb } = require("../lib/db.ts");
const { sweepDelivered } = require("../lib/mail.ts");
const { rateLimit } = require("../lib/rate-limit.ts");
test.after(() => {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
test("concurrent delivery sweeps create a single inbox event and leave future letters untouched", async () => {
  await waitDb();
  await db.execute(
    "INSERT INTO users(id,email,pen_name,password_hash,created_at) VALUES('a','a@example.test','甲','hash',1),('b','b@example.test','乙','hash',1)",
  );
  for (const [id, time] of [
    ["ready", Date.now() - 1],
    ["future", Date.now() + 100000],
  ])
    await db.execute({
      sql: "INSERT INTO letters(id,author_id,recipient_id,genre,title,body,postage,stamp_id,sent_at,deliver_at) VALUES(?,'a','b','letter','title','body','surface','B01',1,?)",
      args: [id, time],
    });
  await Promise.all([sweepDelivered(), sweepDelivered()]);
  await sweepDelivered();
  assert.equal(
    (
      await db.execute(
        "SELECT COUNT(*) AS n FROM notifications WHERE event_key='letter_in:ready'",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await db.execute("SELECT notified FROM letters WHERE id='ready'")).rows[0]
      .notified,
    1,
  );
  assert.equal(
    (await db.execute("SELECT notified FROM letters WHERE id='future'")).rows[0]
      .notified,
    0,
  );
});
test("database rate limiter is atomic under parallel requests", async () => {
  await waitDb();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => rateLimit("parallel-test", 3, 60000)),
  );
  assert.equal(results.filter((x) => x.ok).length, 3);
});
