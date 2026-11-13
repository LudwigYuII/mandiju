const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createClient } = require("@libsql/client");
const { upgradeSchema } = require("../lib/schema-upgrades.ts");
const actions = fs.readFileSync(
  require("node:path").join(__dirname, "../lib/actions.ts"),
  "utf8",
);
async function fixture() {
  const db = createClient({ url: ":memory:" });
  const source = fs.readFileSync(
    require("node:path").join(__dirname, "../lib/db.ts"),
    "utf8",
  );
  for (const [, sql] of source.matchAll(/`(CREATE TABLE[\s\S]*?)`/g))
    await db.execute(sql);
  for (const [, table, column, ddl] of source.matchAll(
    /ensureColumn\("(\w+)", "(\w+)", "([^"]+)"\)/g,
  )) {
    const cols = (await db.execute(`PRAGMA table_info(${table})`)).rows;
    if (!cols.some((c) => c.name === column))
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
  await upgradeSchema(db);
  return db;
}
test("additive migration is repeatable and preserves historical account and collection values", async () => {
  const db = await fixture();
  try {
    await db.execute(
      "INSERT INTO users(id,email,pen_name,password_hash,created_at) VALUES('u','u@example.test','旧笺','hash',1)",
    );
    await db.execute("INSERT INTO user_stamps VALUES('u','B05',1,'old')");
    await upgradeSchema(db);
    assert.equal(
      (await db.execute("SELECT pen_name FROM users")).rows[0].pen_name,
      "旧笺",
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM user_stamps")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM schema_migrations")).rows[0]
        .n,
      3,
    );
  } finally {
    db.close();
  }
});
test("actual draft upsert rejects another user and an outdated tab", async () => {
  const db = await fixture();
  try {
    const sql = actions.match(
      /sql: `(INSERT INTO drafts[\s\S]*?RETURNING revision)`/,
    )[1];
    const columns = sql
      .match(/INSERT INTO drafts\(([^)]+)\)/)[1]
      .split(",")
      .map((s) => s.trim());
    const args = columns.map(
      (c) =>
        ({
          id: "draft",
          user_id: "a",
          genre: "letter",
          body: "first",
          updated_at: 1,
        })[c] ?? null,
    );
    args.push(0);
    let result = await db.execute({ sql, args });
    assert.equal(Number(result.rows[0].revision), 0);
    const update = [...args];
    update[columns.indexOf("body")] = "second";
    result = await db.execute({ sql, args: update });
    assert.equal(Number(result.rows[0].revision), 1);
    const stale = await db.execute({ sql, args: update });
    assert.equal(stale.rows.length, 0);
    const foreign = [...update];
    foreign[1] = "b";
    foreign[columns.indexOf("body")] = "intrusion";
    foreign[foreign.length - 1] = 1;
    assert.equal((await db.execute({ sql, args: foreign })).rows.length, 0);
    assert.equal(
      (await db.execute("SELECT body FROM drafts")).rows[0].body,
      "second",
    );
  } finally {
    db.close();
  }
});
test("the real conditional invitation claim can succeed only once", async () => {
  const db = await fixture();
  try {
    await db.execute(
      "INSERT INTO invites(id,code,created_at) VALUES('i','CODE',1)",
    );
    const sql = actions.match(
      /sql:\s*"(UPDATE invites SET used_by=\?,used_at=\? WHERE code=\? AND used_by IS NULL)"/,
    )[1];
    assert.equal(
      (await db.execute({ sql, args: ["a", 1, "CODE"] })).rowsAffected,
      1,
    );
    assert.equal(
      (await db.execute({ sql, args: ["b", 2, "CODE"] })).rowsAffected,
      0,
    );
    assert.equal(
      (await db.execute("SELECT used_by FROM invites")).rows[0].used_by,
      "a",
    );
  } finally {
    db.close();
  }
});
test("one author request key produces at most one historical letter record", async () => {
  const db = await fixture();
  try {
    const sql = `INSERT INTO letters(id,author_id,genre,title,body,postage,stamp_id,sent_at,deliver_at,send_key) VALUES(?,?,?,?,?,?,?,?,?,?)`;
    const args = [
      "one",
      "a",
      "letter",
      "title",
      "body",
      "surface",
      "B01",
      1,
      100,
      "key",
    ];
    await db.execute({ sql, args });
    await assert.rejects(db.execute({ sql, args: ["two", ...args.slice(1)] }));
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM letters")).rows[0].n,
      1,
    );
  } finally {
    db.close();
  }
});
