(async () => {
  /** Dry-run by default. Run only after an encrypted backup and restore verification. */
  const fs = require("node:fs/promises");
  const path = require("node:path");
  const sharp = require("sharp");
  const { createClient } = require("@libsql/client");
  const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
  const { upgradeSchema } = require("../lib/schema-upgrades.ts");
  const { storeImage } = require("../lib/storage.ts");
  const apply = process.argv.includes("--apply"),
    retire = process.argv.includes("--retire-public");
  if ((apply || retire) && !process.argv.includes("--backup-verified"))
    throw new Error(
      "Verify an encrypted backup and isolated restore before applying",
    );
  const raw = process.env.MDJ_DB;
  if (!raw) throw new Error("MDJ_DB required");
  const db = createClient({
    url: /^(file:|libsql:|https:)/.test(raw) ? raw : `file:${raw}`,
    authToken: process.env.MDJ_DB_AUTH_TOKEN,
  });
  const oldRefs = new Set();
  let changed = 0,
    unsupported = 0,
    retained = 0;
  try {
    if (apply) await upgradeSchema(db);
    for (const [table, owner] of [
      ["letters", "author_id"],
      ["drafts", "user_id"],
    ]) {
      const records = (
        await db.execute(
          `SELECT id,${owner} AS owner,image FROM ${table} WHERE image IS NOT NULL AND image<>'' AND image NOT LIKE 'api/media/%'`,
        )
      ).rows;
      if (!apply) {
        console.log(
          `${table}: ${records.length} legacy attachments need review`,
        );
        continue;
      }
      for (const row of records) {
        const ref = String(row.image);
        let bytes;
        const base = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
        if (/^uploads\/[a-zA-Z0-9_.-]+$/.test(ref))
          bytes = await fs.readFile(path.join(process.cwd(), "public", ref));
        else if (base && ref.startsWith(base + "/uploads/")) {
          const response = await fetch(ref, {
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok)
            throw new Error("Legacy attachment could not be read");
          bytes = Buffer.from(await response.arrayBuffer());
        } else {
          unsupported++;
          continue;
        }
        const buf = await sharp(bytes, { limitInputPixels: 20000000 })
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
        const id = crypto.randomUUID(),
          key = id + ".webp";
        await storeImage(key, buf, "image/webp", "letter");
        const tx = await db.transaction("write");
        try {
          const updated = await tx.execute({
            sql: `UPDATE ${table} SET image=? WHERE id=? AND image=?`,
            args: [`api/media/${id}`, String(row.id), ref],
          });
          if (!updated.rowsAffected) {
            await tx.rollback();
            continue;
          }
          await tx.execute({
            sql: "INSERT INTO media(id,owner_id,purpose,object_key,content_type,size,created_at,legacy_ref) VALUES(?,?,?,?,?,?,?,?)",
            args: [
              id,
              String(row.owner),
              "letter",
              key,
              "image/webp",
              buf.length,
              Date.now(),
              ref,
            ],
          });
          if (table === "letters")
            await tx.execute({
              sql: "INSERT INTO letter_media(letter_id,media_id) VALUES(?,?)",
              args: [String(row.id), id],
            });
          await tx.commit();
          changed++;
          oldRefs.add(ref);
        } catch (e) {
          await tx.rollback();
          throw e;
        } finally {
          tx.close();
        }
      }
    }
    if (retire && apply) {
      for (const row of (
        await db.execute(
          "SELECT DISTINCT legacy_ref FROM media WHERE legacy_ref IS NOT NULL AND legacy_retired=0",
        )
      ).rows)
        oldRefs.add(String(row.legacy_ref));
      for (const ref of oldRefs) {
        const links = await db.execute({
          sql: `SELECT 1 FROM letters WHERE image=? UNION ALL SELECT 1 FROM drafts WHERE image=? UNION ALL SELECT 1 FROM users WHERE avatar_id=? OR bg_id=? LIMIT 1`,
          args: [ref, ref, `upload:${ref}`, `upload:${ref}`],
        });
        if (links.rows.length) {
          retained++;
          continue;
        }
        if (ref.startsWith("uploads/"))
          await fs
            .unlink(path.join(process.cwd(), "public", ref))
            .catch((error) => {
              if (error.code !== "ENOENT") throw error;
            });
        else {
          const base = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
          const key = ref.slice(base.length + 1);
          const client = new S3Client({
            region: "auto",
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId: process.env.R2_ACCESS_KEY_ID,
              secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
          });
          await client.send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET,
              Key: key,
            }),
          );
        }
        await db.execute({
          sql: "UPDATE media SET legacy_retired=1 WHERE legacy_ref=?",
          args: [ref],
        });
      }
    }
    console.log({
      mode: apply ? "apply" : "dry-run",
      changed,
      unsupported,
      retainedSharedPublicFiles: retained,
    });
    if (changed && !retire)
      console.warn(
        "Old public copies still exist; verify access and retire them explicitly.",
      );
    if (unsupported || retained) process.exitCode = 2;
  } finally {
    db.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
