#!/usr/bin/env node
/**
 * 线上数据库快照导出（Turso / libSQL → JSON + schema.sql）
 *
 * 用途：给 .github/workflows/backup.yml 每天打一份整库快照，作为 Actions artifact 保留 30 天。
 *
 * 用法：
 *   MDJ_DB=libsql://xxx.turso.io MDJ_DB_AUTH_TOKEN=... node tools/export-backup.mjs [输出目录]
 *   输出目录默认 ./backups，最终产物在 <输出目录>/<UTC 时间戳>/
 *
 * 产物结构：
 *   <stamp>/manifest.json       元信息：导出时间、来源、表清单与行数、文件列表
 *   <stamp>/schema.sql          全部 CREATE TABLE / CREATE INDEX 语句（先建结构）
 *   <stamp>/tables/<表名>.json  每张表的全量数据（{ table, columns, rowCount, rows: [...] }）
 *   <stamp>/README.md           恢复步骤说明
 *
 * 安全提醒：快照含用户邮箱与密码哈希，属于敏感数据。
 *   · 不要提交进仓库（本脚本只在 CI 或本机临时目录里跑）；
 *   · GitHub Actions artifact 默认只有本仓库可见，保留 30 天后自动删除。
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const TOOL_VERSION = "1.0.0";
const startedAt = Date.now();

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ---------------- 连接参数 ----------------
const rawUrl = (process.env.MDJ_DB || "").trim();
if (!rawUrl) fail("缺少环境变量 MDJ_DB（应为 Turso 的 libsql://... 地址）");
const authToken = (process.env.MDJ_DB_AUTH_TOKEN || "").trim() || undefined;

const isRemote = /^(libsql|https?|wss?):\/\//.test(rawUrl);
const url = isRemote ? rawUrl : rawUrl.startsWith("file:") ? rawUrl : `file:${rawUrl}`;

function sourceLabel() {
  if (!isRemote) return "本地文件库（离线导出）";
  try {
    return `Turso ${new URL(rawUrl).host}`;
  } catch {
    return "远程库（地址无法解析）";
  }
}

if (isRemote && !authToken) {
  fail("远程库需要 MDJ_DB_AUTH_TOKEN（Turso 数据库令牌，turso db tokens create <db> 生成）");
}

// ---------------- 输出目录 ----------------
// 时间戳用 UTC，避免 CI runner 时区不一致：2026-11-10-04-23-10
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const outRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("backups");
const outDir = path.join(outRoot, stamp);
const tablesDir = path.join(outDir, "tables");
fs.mkdirSync(tablesDir, { recursive: true });

// ---------------- 序列化辅助 ----------------
/** libSQL 的 Row 值可能是 bigint / ArrayBuffer / Uint8Array，统一转成可 JSON 化的值 */
function toJsonSafe(v) {
  if (typeof v === "bigint") {
    // 时间戳、计数都在 Number 安全范围内；超出时转字符串保真
    return v <= Number.MAX_SAFE_INTEGER && v >= Number.MIN_SAFE_INTEGER ? Number(v) : v.toString();
  }
  if (v instanceof ArrayBuffer) {
    return { __blob_base64: Buffer.from(v).toString("base64") };
  }
  if (ArrayBuffer.isView(v)) {
    return { __blob_base64: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64") };
  }
  return v;
}

/** 表名安全化：sqlite 标识符允许的字符之外一律替换（导出文件名用） */
function safeFileName(name) {
  return name.replace(/[^\w.-]/g, "_");
}

function sqlIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

// ---------------- 主流程 ----------------
async function main() {
  const db = createClient({ url, authToken });
  try {
    // 1) 读结构：表与索引的 DDL
    const master = await db.execute(
      `SELECT name, type, sql FROM sqlite_master
        WHERE type IN ('table','index')
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '__libsql%'
        ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`
    );
    const tables = [];
    const indexSqls = [];
    for (const row of master.rows) {
      const name = String(row.name);
      const type = String(row.type);
      const sql = row.sql == null ? "" : String(row.sql);
      if (type === "table") tables.push({ name, sql });
      else if (sql) indexSqls.push(sql);
    }
    if (tables.length === 0) {
      fail("数据库里没有任何业务表 —— 请确认 MDJ_DB 指向的是慢递局的线上库，而不是空库");
    }

    // 2) 导出每张表的全量数据（小站数据量小，单次 SELECT 更简单也更一致）
    const tableStats = {};
    let totalRows = 0;
    for (const t of tables) {
      const res = await db.execute(`SELECT * FROM ${sqlIdent(t.name)}`);
      const columns = res.columns.map((c) => String(c));
      const rows = res.rows.map((row) => {
        const obj = {};
        for (const c of columns) obj[c] = toJsonSafe(row[c]);
        return obj;
      });
      const file = path.join(tablesDir, `${safeFileName(t.name)}.json`);
      const payload = {
        table: t.name,
        exportedAt: new Date().toISOString(),
        columns,
        rowCount: rows.length,
        rows,
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
      tableStats[t.name] = {
        rowCount: rows.length,
        columns,
        file: `tables/${safeFileName(t.name)}.json`,
        bytes: fs.statSync(file).size,
      };
      totalRows += rows.length;
      process.stdout.write(`  + ${t.name}: ${rows.length} 行\n`);
    }

    // 3) 结构快照
    const schemaHeader = [
      `-- 慢递局数据库结构快照`,
      `-- 导出时间：${new Date().toISOString()}`,
      `-- 来源：${sourceLabel()}`,
      `-- 恢复顺序：先在空库里执行本文件建表，再按 tables/*.json 逐表导入数据。`,
      ``,
    ].join("\n");
    const schemaBody = [...tables.map((t) => t.sql).filter(Boolean), ...indexSqls]
      .map((s) => (s.trim().endsWith(";") ? s.trim() : `${s.trim()};`))
      .join("\n\n");
    fs.writeFileSync(path.join(outDir, "schema.sql"), `${schemaHeader}\n${schemaBody}\n`, "utf8");

    // 4) 清单
    const manifest = {
      tool: "mandiju-export-backup",
      version: TOOL_VERSION,
      stamp,
      exportedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      source: { kind: isRemote ? "turso" : "local", label: sourceLabel() },
      tableCount: tables.length,
      totalRows,
      tables: tableStats,
      files: { schema: "schema.sql", tables: "tables/" },
      // 备份不含任何密钥：数据库令牌只用于连接，绝不写进产物
      secretsIncluded: false,
    };
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    // 5) 恢复说明
    const readme = [
      `# 慢递局数据库快照 ${stamp}`,
      ``,
      `- 导出时间（UTC）：${manifest.exportedAt}`,
      `- 来源：${sourceLabel()}`,
      `- 表数量：${tables.length} · 总行数：${totalRows}`,
      `- 耗时：${manifest.durationMs} ms`,
      ``,
      `## 恢复步骤`,
      ``,
      "```bash",
      "# 1) 建空库并重建结构",
      "sqlite3 restore.db < schema.sql",
      "",
      "# 2) 把每张表的 rows 逐行 INSERT（脚本可按 tables/*.json 自行生成 INSERT 语句）",
      "#    注意 users.password_hash / users.email 属于敏感数据，恢复后请限制访问。",
      "```",
      ``,
      `> 本快照含用户邮箱与密码哈希，请勿外发或提交进仓库。`,
      ``,
    ].join("\n");
    fs.writeFileSync(path.join(outDir, "README.md"), readme, "utf8");

    // 6) 自检：users 表必须有数据（空库或连错库时最典型的信号）
    const userRows = Number(tableStats.users?.rowCount ?? 0);
    if (userRows === 0) {
      fail(`users 表为空（0 行）—— 备份可疑，确认 MDJ_DB 指向线上库。产物目录：${outDir}`);
    }

    // 7) 摘要
    const top = Object.entries(tableStats)
      .sort((a, b) => b[1].rowCount - a[1].rowCount)
      .slice(0, 8)
      .map(([name, s]) => `${name}=${s.rowCount}`)
      .join(" ");
    console.log(
      `\n✓ 数据库快照已导出：${path.relative(process.cwd(), outDir) || outDir}\n` +
        `  来源：${sourceLabel()} · ${tables.length} 张表 · 共 ${totalRows} 行 · 用时 ${manifest.durationMs}ms\n` +
        `  行数最多的表：${top}\n`
    );
  } finally {
    // libsql 客户端会持有连接，显式关闭避免 CI 进程挂住
    try {
      await db.close();
    } catch {
      /* 忽略关闭异常 */
    }
  }
}

main().catch((e) => {
  console.error(`✗ 导出失败：${e?.stack ?? e}`);
  process.exit(1);
});
