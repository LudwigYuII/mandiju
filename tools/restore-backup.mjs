// Restore only into an empty, separately configured database; never overwrite the live source.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
const directory = path.resolve(process.argv[2] || "");
const url = process.env.MDJ_RESTORE_DB;
if (!process.argv[2] || !url)
  throw new Error(
    "Usage: MDJ_RESTORE_DB=file:/new/empty.db node tools/restore-backup.mjs /decrypted/snapshot",
  );
if (url === process.env.MDJ_DB)
  throw new Error("Restore destination must differ from MDJ_DB");
const client = createClient({
  url:
    url.startsWith("file:") || /^(libsql|https):/.test(url)
      ? url
      : `file:${url}`,
  authToken: process.env.MDJ_RESTORE_AUTH_TOKEN,
});
const identifier = (v) => '"' + v.replaceAll('"', '""') + '"';
try {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__libsql%'",
  );
  if (tables.rows.length)
    throw new Error("Refusing to restore into a non-empty database");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, "manifest.json"), "utf8"),
  );
  const tx = await client.transaction("write");
  try {
    // Exported schema contains only CREATE TABLE/INDEX statements from our own SQLite schema.
    const schema = fs.readFileSync(path.join(directory, "schema.sql"), "utf8");
    for (const statement of schema
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!/^CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s/i.test(statement))
        throw new Error("Unexpected schema statement");
      await tx.execute(statement);
    }
    let count = 0;
    for (const [table, info] of Object.entries(manifest.tables)) {
      const file = path.resolve(directory, info.file);
      if (!file.startsWith(directory + path.sep))
        throw new Error("Invalid table path");
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data.table !== table || data.rows.length !== info.rowCount)
        throw new Error("Backup manifest mismatch");
      for (const row of data.rows) {
        const args = data.columns.map((c) =>
          row[c]?.__blob_base64
            ? Buffer.from(row[c].__blob_base64, "base64")
            : row[c],
        );
        await tx.execute({
          sql: `INSERT INTO ${identifier(table)} (${data.columns.map(identifier).join(",")}) VALUES(${args.map(() => "?").join(",")})`,
          args,
        });
        count++;
      }
      const actual = await tx.execute(
        `SELECT COUNT(*) AS n FROM ${identifier(table)}`,
      );
      if (Number(actual.rows[0].n) !== info.rowCount)
        throw new Error("Restored row count mismatch");
    }
    await tx.commit();
    console.log(
      `Restored ${count} rows into the isolated destination; verify attachments separately.`,
    );
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
} finally {
  client.close();
}
