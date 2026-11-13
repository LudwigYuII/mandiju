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
    const second = (
      await tx.execute("SELECT version FROM schema_migrations WHERE version=2")
    ).rows.length;
    if (!second) {
      for (const [table, col, ddl] of [
        ["users", "literary_name", "TEXT"],
        ["users", "literary_key", "TEXT"],
        ["users", "seal_style", "TEXT NOT NULL DEFAULT 'yang'"],
        ["users", "retreat_until", "INTEGER NOT NULL DEFAULT 0"],
        ["users", "show_referrer", "INTEGER NOT NULL DEFAULT 0"],
        ["letters", "original_deliver_at", "INTEGER"],
        ["drafts", "recipient_id", "TEXT"],
      ]) {
        const cols = (await tx.execute(`PRAGMA table_info(${table})`)).rows;
        if (!cols.some((c) => String(c.name) === col))
          await tx.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
      }
      await tx.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_literary_key ON users(literary_key)",
      );
      const draftCols = (await tx.execute("PRAGMA table_info(drafts)")).rows;
      if (draftCols.some((c) => String(c.name) === "recipient"))
        await tx.execute(
          "UPDATE drafts SET recipient_id=(SELECT id FROM users WHERE users.pen_name=drafts.recipient) WHERE recipient_id IS NULL AND recipient IS NOT NULL",
        );
      await tx.execute({
        sql: "INSERT INTO schema_migrations(version,applied_at) VALUES(2,?)",
        args: [Date.now()],
      });
    }
    const third = (
      await tx.execute("SELECT version FROM schema_migrations WHERE version=3")
    ).rows.length;
    if (!third) {
      await tx.execute(`CREATE TABLE IF NOT EXISTS study_profiles (
        owner_id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', public_intro TEXT NOT NULL DEFAULT '',
        inner_note TEXT NOT NULL DEFAULT '', visits_closed INTEGER NOT NULL DEFAULT 0,
        gifts_closed INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS study_visits (
        owner_id TEXT NOT NULL, visitor_id TEXT NOT NULL, note TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','withdrawn','revoked')),
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, retry_at INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,visitor_id), CHECK(owner_id<>visitor_id))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS user_blocks (
        blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at INTEGER NOT NULL,
        PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS study_events (
        id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, target_id TEXT NOT NULL,
        kind TEXT NOT NULL, day_key TEXT NOT NULL, created_at INTEGER NOT NULL)`);
      await tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_study_events_day ON study_events(actor_id,kind,day_key)",
      );
      await tx.execute(`CREATE TABLE IF NOT EXISTS gifts (
        id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('plum','tea','snow','leaf')), note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
        created_at INTEGER NOT NULL, available_at INTEGER NOT NULL, send_key TEXT NOT NULL,
        UNIQUE(sender_id,send_key), CHECK(sender_id<>recipient_id))`);
      await tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_gifts_inbox ON gifts(recipient_id,available_at)",
      );
      const letterCols = (await tx.execute("PRAGMA table_info(letters)")).rows;
      if (!letterCols.some((c) => String(c.name) === "blocked_deliver_at"))
        await tx.execute(
          "ALTER TABLE letters ADD COLUMN blocked_deliver_at INTEGER",
        );
      await tx.execute({
        sql: "INSERT INTO schema_migrations(version,applied_at) VALUES(3,?)",
        args: [Date.now()],
      });
    }
    const fourth = (
      await tx.execute("SELECT version FROM schema_migrations WHERE version=4")
    ).rows.length;
    if (!fourth) {
      await tx.execute(`CREATE TABLE IF NOT EXISTS literary_spaces (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'scroll', title TEXT NOT NULL,
        intro TEXT NOT NULL DEFAULT '', rhyme TEXT NOT NULL DEFAULT '', visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
        capacity INTEGER NOT NULL DEFAULT 12 CHECK(capacity BETWEEN 2 AND 24), closed INTEGER NOT NULL DEFAULT 0,
        hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, send_key TEXT NOT NULL, UNIQUE(owner_id,send_key))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS literary_members (
        space_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('invited','joined','declined','left','revoked')),
        created_at INTEGER NOT NULL, PRIMARY KEY(space_id,user_id))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS literary_entries (
        id TEXT PRIMARY KEY, space_id TEXT NOT NULL, author_id TEXT NOT NULL, position INTEGER NOT NULL,
        title TEXT NOT NULL, body TEXT NOT NULL, rhyme TEXT NOT NULL DEFAULT '', vertical INTEGER NOT NULL DEFAULT 0,
        withdrawn INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
        send_key TEXT NOT NULL, UNIQUE(space_id,position), UNIQUE(space_id,author_id), UNIQUE(author_id,send_key))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS literary_colophons (
        id TEXT PRIMARY KEY, target_kind TEXT NOT NULL CHECK(target_kind IN ('entry','letter')), target_id TEXT NOT NULL,
        author_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','withdrawn')),
        created_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0, UNIQUE(target_kind,target_id,author_id))`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS literary_reports (
        id TEXT PRIMARY KEY, target_kind TEXT NOT NULL CHECK(target_kind IN ('entry','space')), target_id TEXT NOT NULL,
        reporter_id TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(target_kind,target_id,reporter_id))`);
      await tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_literary_members_user ON literary_members(user_id,status)",
      );
      await tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_colophons_target ON literary_colophons(target_kind,target_id,status)",
      );
      await tx.execute({
        sql: "INSERT INTO schema_migrations(version,applied_at) VALUES(4,?)",
        args: [Date.now()],
      });
    }
    const cols = (await tx.execute("PRAGMA table_info(users)")).rows.map((c) =>
      String(c.name),
    );
    const select = cols
      .map((c) =>
        c === "pen_name"
          ? "COALESCE(literary_name, '未题书友·' || rowid) AS pen_name"
          : c === "seal_text"
            ? "CASE WHEN literary_name IS NULL THEN '印' WHEN seal_style='yin' THEN 'yin:' || literary_name ELSE literary_name END AS seal_text"
            : '"' + c + '"',
      )
      .join(",");
    await tx.execute(
      `CREATE VIEW IF NOT EXISTS public_users AS SELECT ${select} FROM users`,
    );
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
