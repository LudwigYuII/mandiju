import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import manifest from "@/data/manifest.json";

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

const rawDb = process.env.MDJ_DB;
const isRemote =
  !!rawDb && (rawDb.startsWith("libsql://") || rawDb.startsWith("https://") || rawDb.startsWith("wss://"));

const localPath = rawDb || path.join(process.cwd(), "data", "local.db");

if (!isRemote && !isBuild) {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
}

export const db = isBuild
  ? // 构建阶段：使用本地临时库，绝不连接远程（Next 构建会评估 route handler 模块）
    createClient({ url: `file:${path.join(process.cwd(), "data", "build-phase.db")}` })
  : createClient({
      url: isRemote ? rawDb! : `file:${localPath}`,
      authToken: process.env.MDJ_DB_AUTH_TOKEN || undefined,
    });

let ready: Promise<void> | null = null;

export function waitDb(): Promise<void> {
  // 构建阶段绝不碰数据库（Next 构建时可能评估 route handler）
  if (process.env.NEXT_PHASE === "phase-production-build") return Promise.resolve();
  if (!ready) ready = init();
  return ready;
}

async function ensureColumn(table: string, col: string, ddl: string) {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const names = info.rows.map((r: any) => String(r.name));
  if (!names.includes(col)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

async function init() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      pen_name TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      birthday TEXT,
      avatar_id TEXT NOT NULL DEFAULT 'C01',
      bg_id TEXT NOT NULL DEFAULT 'D01',
      role TEXT NOT NULL DEFAULT 'member',
      letters_sent INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT,
      used_by TEXT,
      created_at INTEGER NOT NULL,
      used_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      recipient_id TEXT,
      genre TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      postage TEXT NOT NULL,
      stamp_id TEXT NOT NULL,
      weather TEXT,
      city TEXT,
      temp REAL,
      sent_at INTEGER NOT NULL,
      deliver_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY,
      letter_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      parent_id TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS likes (
      letter_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (letter_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS stamp_defs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      acquire TEXT NOT NULL,
      file TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS user_stamps (
      user_id TEXT NOT NULL,
      stamp_id TEXT NOT NULL,
      acquired_at INTEGER NOT NULL,
      source TEXT,
      PRIMARY KEY (user_id, stamp_id)
    )`,
    `CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      title TEXT NOT NULL,
      stamp_id TEXT NOT NULL,
      host_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS topic_pool (
      id TEXT PRIMARY KEY,
      proposer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS topic_letters (
      letter_id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      genre TEXT NOT NULL,
      title TEXT,
      body TEXT,
      postage TEXT,
      stamp_id TEXT,
      recipient TEXT,
      city TEXT,
      weather TEXT,
      image TEXT,
      capsule_date TEXT,
      topic_id TEXT,
      reply_to TEXT,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS friends (
      requester_id TEXT NOT NULL,
      addressee_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      accepted_at INTEGER,
      PRIMARY KEY (requester_id, addressee_id)
    )`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS push_subs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_letters_deliver ON letters(deliver_at)`,
    `CREATE INDEX IF NOT EXISTS idx_letters_author ON letters(author_id)`,
    `CREATE INDEX IF NOT EXISTS idx_letters_recipient ON letters(recipient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_replies_letter ON replies(letter_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)`,
    `CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friends(addressee_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subs(user_id)`,
  ];
  for (const s of stmts) {
    await db.execute(s);
  }

  // 迁移：为已有表补列
  await ensureColumn("users", "seal_text", "seal_text TEXT NOT NULL DEFAULT ''");
  await ensureColumn("users", "coins", "coins INTEGER NOT NULL DEFAULT 500");
  await ensureColumn("users", "last_coin_at", "last_coin_at INTEGER");
  await ensureColumn("users", "banned", "banned INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("users", "onboarded_at", "onboarded_at INTEGER");
  await ensureColumn("letters", "cost", "cost INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("letters", "image", "image TEXT");
  await ensureColumn("letters", "first_day", "first_day INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("letters", "notified", "notified INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("letters", "reply_to", "reply_to TEXT");
  await ensureColumn("letters", "read_at", "read_at INTEGER");
  await ensureColumn("letters", "burn_seconds", "burn_seconds INTEGER");
  await ensureColumn("letters", "burned_at", "burned_at INTEGER");
  await ensureColumn("letters", "burned", "burned INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("letters", "seal_color", "seal_color TEXT NOT NULL DEFAULT 'vermilion'");
  await ensureColumn("letters", "seal_pattern", "seal_pattern TEXT NOT NULL DEFAULT 'plain'");
  await ensureColumn("letters", "paper", "paper TEXT NOT NULL DEFAULT 'plain'");
  await ensureColumn("letters", "vertical", "vertical INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("drafts", "burn_seconds", "burn_seconds INTEGER");
  await ensureColumn("drafts", "seal_color", "seal_color TEXT");
  await ensureColumn("drafts", "seal_pattern", "seal_pattern TEXT");
  await ensureColumn("drafts", "paper", "paper TEXT");
  await ensureColumn("drafts", "vertical", "vertical INTEGER");

  // 老账号：私印默认取笔名首字
  await db.execute("UPDATE users SET seal_text = substr(pen_name, 1, 1) WHERE seal_text = ''");

  // 邮票图鉴种子
  for (const s of (manifest.stamps as any[])) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO stamp_defs(id, name, category, acquire, file) VALUES(?,?,?,?,?)",
      args: [s.id, s.name, s.category, JSON.stringify(s.acquire), s.file],
    });
  }

  // 管理员种子
  const adminRow = await db.execute("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (adminRow.rows.length === 0) {
    const pass = process.env.MDJ_ADMIN_PASS || "kaizhang-2026";
    const hash = await bcrypt.hash(pass, 10);
    await db.execute({
      sql: "INSERT INTO users(id, email, pen_name, password_hash, role, seal_text, coins, last_coin_at, created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      args: [crypto.randomUUID(), "admin@mandiju.dev", "站长", hash, "admin", "站", 500, Date.now(), Date.now()],
    });
  }

  // 开张邀请码
  const anyInvite = await db.execute("SELECT id FROM invites LIMIT 1");
  if (anyInvite.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO invites(id, code, created_by, created_at) VALUES(?,?,?,?)",
      args: [crypto.randomUUID(), "KAIZHANG", null, Date.now()],
    });
  }
}
