import type { Client } from "@libsql/client";
/** Additive, serialized upgrade. No historical letter, invite or collection is removed. */
export async function upgradeSchema(db: Client) {
  const tx = await db.transaction("write");
  try {
    await tx.execute(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
    );
    const done = (
      await tx.execute("SELECT version FROM schema_migrations WHERE version=1")
    ).rows.length;
    if (!done) {
      for (const [table, col, ddl] of [
        ["users", "auth_version", "INTEGER NOT NULL DEFAULT 0"],
        ["users", "mail_notices", "INTEGER NOT NULL DEFAULT 0"],
        ["letters", "send_key", "TEXT"],
        ["letters", "moderation_hidden", "INTEGER NOT NULL DEFAULT 0"],
        ["drafts", "revision", "INTEGER NOT NULL DEFAULT 0"],
        ["notifications", "event_key", "TEXT"],
      ]) {
        const cols = (await tx.execute(`PRAGMA table_info(${table})`)).rows;
        if (!cols.some((c) => String(c.name) === col))
          await tx.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
      }
      await tx.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_letter_send_key ON letters(author_id, send_key)",
      );
      await tx.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_event ON notifications(event_key)",
      );
      await tx.execute(`CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, purpose TEXT NOT NULL,
        object_key TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL,
        created_at INTEGER NOT NULL, legacy_ref TEXT, legacy_retired INTEGER NOT NULL DEFAULT 0)`);
      await tx.execute(
        `CREATE TABLE IF NOT EXISTS letter_media (letter_id TEXT NOT NULL,media_id TEXT NOT NULL,PRIMARY KEY(letter_id,media_id))`,
      );
      await tx.execute(`CREATE TABLE IF NOT EXISTS delivery_jobs (
        letter_id TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
        lease_until INTEGER NOT NULL DEFAULT 0, claim_token TEXT, last_error TEXT,
        PRIMARY KEY(letter_id,channel))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS admin_audit (
        id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL,
        target_id TEXT NOT NULL, created_at INTEGER NOT NULL)`);
      await tx.execute({
        sql: "INSERT INTO schema_migrations(version,applied_at) VALUES(1,?)",
        args: [Date.now()],
      });
    }
    const second = (await tx.execute("SELECT version FROM schema_migrations WHERE version=2")).rows.length;
    if (!second) {
      for (const [table,col,ddl] of [
        ["users","literary_name","TEXT"], ["users","literary_key","TEXT"],
        ["users","seal_style","TEXT NOT NULL DEFAULT 'yang'"],
        ["users","retreat_until","INTEGER NOT NULL DEFAULT 0"],
        ["users","show_referrer","INTEGER NOT NULL DEFAULT 0"],
        ["letters","original_deliver_at","INTEGER"], ["drafts","recipient_id","TEXT"]
      ]) {
        const cols = (await tx.execute(`PRAGMA table_info(${table})`)).rows;
        if (!cols.some(c => String(c.name) === col)) await tx.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
      }
      await tx.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_literary_key ON users(literary_key)");
      const draftCols = (await tx.execute('PRAGMA table_info(drafts)')).rows;
      if (draftCols.some(c=>String(c.name)==='recipient')) await tx.execute("UPDATE drafts SET recipient_id=(SELECT id FROM users WHERE users.pen_name=drafts.recipient) WHERE recipient_id IS NULL AND recipient IS NOT NULL");
      await tx.execute({sql:"INSERT INTO schema_migrations(version,applied_at) VALUES(2,?)",args:[Date.now()]});
    }
      const cols = (await tx.execute("PRAGMA table_info(users)")).rows.map(c => String(c.name));
      const select = cols.map(c => c === 'pen_name'
        ? "COALESCE(literary_name, '未题书友·' || rowid) AS pen_name"
        : c === 'seal_text' ? "CASE WHEN literary_name IS NULL THEN '印' WHEN seal_style='yin' THEN 'yin:' || literary_name ELSE literary_name END AS seal_text" : '"' + c + '"').join(',');
      await tx.execute(`CREATE VIEW IF NOT EXISTS public_users AS SELECT ${select} FROM users`);
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
