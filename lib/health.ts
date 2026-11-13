// 系统健康报告：/api/health（公开）与站长后台「系统状态」卡片共用同一份数据。
//
// 安全约定（务必保持）：
//   · 只输出「是否配置」的布尔值、表计数与耗时；绝不输出任何密钥 / 令牌 / 连接串的值。
//   · 计数只给总量，不含任何用户可识别信息（邮箱、笔名、正文等一律不出现）。
import { db, waitDb } from "./db";
import { r2Configured } from "./storage";

/** 各表关键计数（只有总量，无隐私数据） */
export type HealthCounts = {
  users: number;
  letters: number;
  notifications: number;
  replies: number;
  pushSubs: number;
};

/** 配置状态：一律为布尔，不含任何配置值 */
export type HealthConfig = {
  /** RESEND_API_KEY 是否配置（邮件通道） */
  mail: boolean;
  /** MAIL_FROM 是否配置（自定义发件人；未配置时用默认地址） */
  mailFrom: boolean;
  /** Web Push 是否可用（VAPID 公私钥都在） */
  push: boolean;
  /** VAPID 两把钥匙各自是否配置 */
  vapid: { public: boolean; private: boolean };
  /** Cloudflare R2 是否配置（未配置时图片落本地磁盘） */
  r2: boolean;
  /** MDJ_ADMIN_PASS 是否配置（未配置时使用代码内置默认密码） */
  adminPass: boolean;
  /** MDJ_SECRET 是否配置（会话签名 / cron 手动触发鉴权） */
  secret: boolean;
  /** MDJ_DB_AUTH_TOKEN 是否配置（远程 Turso 令牌） */
  dbAuthToken: boolean;
};

export type HealthCron = {
  /** vercel.json 里的 cron 表达式（UTC） */
  schedule: string;
  /** 给运营看的人话描述 */
  scheduleBeijing: string;
  /** 定时任务是否把「最近一次执行时间」落库 */
  recorded: boolean;
  /** 最近一次执行时间（ISO 8601），未记录时为 null */
  lastRunAt: string | null;
  note: string;
};

export type HealthReport = {
  ok: boolean;
  service: "慢递局";
  /** 服务器时间（ISO 8601，UTC） */
  time: string;
  /** 服务器时间（北京时间，便于肉眼比对） */
  timeBeijing: string;
  db: {
    ok: boolean;
    /** 一次读查询的往返耗时（毫秒）；失败时为 null */
    ms: number | null;
    /** 是否连接远程 Turso（false = 本地文件库） */
    remote: boolean;
    counts: HealthCounts | null;
  };
  config: HealthConfig;
  cron: HealthCron;
  build: { commit: string | null; region: string | null };
};

function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** 与 lib/db.ts 相同的判定：MDJ_DB 指向远程 libsql 还是本地文件 */
function isRemoteDb(): boolean {
  const raw = process.env.MDJ_DB;
  if (!raw) return false;
  return (
    raw.startsWith("libsql://") ||
    raw.startsWith("https://") ||
    raw.startsWith("wss://") ||
    raw.startsWith("http://")
  );
}

function beijingNow(d: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * 采集一次健康快照。
 * DB 异常时不抛错：返回 ok:false 且 db.ok:false，由调用方决定 HTTP 状态码（503）。
 */
export async function getHealthReport(): Promise<HealthReport> {
  const now = new Date();
  let dbOk = false;
  let dbMs: number | null = null;
  let counts: HealthCounts | null = null;

  try {
    // waitDb() 内含建表 / 补列迁移，是其余所有页面与接口的前置（幂等，同进程内只跑一次）
    await waitDb();
    const t0 = Date.now();
    // 计数走一次 batch（远程库只需一个来回），读数不会写库
    const results = await db.batch(
      [
        "SELECT COUNT(*) AS n FROM users",
        "SELECT COUNT(*) AS n FROM letters",
        "SELECT COUNT(*) AS n FROM notifications",
        "SELECT COUNT(*) AS n FROM replies",
        "SELECT COUNT(*) AS n FROM push_subs",
      ],
      "read",
    );
    dbMs = Date.now() - t0;
    const n = (i: number) =>
      Number((results[i]?.rows[0] as { n?: unknown } | undefined)?.n ?? 0);
    counts = {
      users: n(0),
      letters: n(1),
      notifications: n(2),
      replies: n(3),
      pushSubs: n(4),
    };
    dbOk = true;
  } catch (e) {
    // 详细错误只进服务器日志，不写进对外 JSON（避免泄露连接信息）
    console.error("[health] 数据库健康检查失败：", e);
  }

  const publicKey = hasEnv("MDJ_VAPID_PUBLIC");
  const privateKey = hasEnv("MDJ_VAPID_PRIVATE");

  return {
    ok: dbOk,
    service: "慢递局",
    time: now.toISOString(),
    timeBeijing: beijingNow(now),
    db: {
      ok: dbOk,
      ms: dbMs,
      remote: isRemoteDb(),
      counts,
    },
    config: {
      mail: hasEnv("RESEND_API_KEY"),
      mailFrom: hasEnv("MAIL_FROM"),
      push: publicKey && privateKey,
      vapid: { public: publicKey, private: privateKey },
      r2: r2Configured(),
      adminPass: hasEnv("MDJ_ADMIN_PASS"),
      secret: hasEnv("MDJ_SECRET"),
      dbAuthToken: hasEnv("MDJ_DB_AUTH_TOKEN"),
    },
    cron: {
      schedule: "0 0 * * *",
      scheduleBeijing: "每日 08:00（北京时间）",
      // app/api/cron 目前只把副作用写进业务表，没有把「执行时间」落库；
      // 按约定不改表结构，这里如实报「未记录」，需要时去 Vercel 后台看 Cron 日志。
      recorded: false,
      lastRunAt: null,
      note: "定时任务未把执行时间落库，故只报「未记录」；可在 Vercel → 项目 → Logs 里筛 /api/cron 核对。",
    },
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA
        ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
        : null,
      region: process.env.VERCEL_REGION || null,
    },
  };
}
