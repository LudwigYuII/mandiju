(async () => {
  /** Dry-run by default. Run only after an encrypted backup and restore verification. */
  const fs = require("node:fs/promises");
  const path = require("node:path");
  const sharp = require("sharp");
  const { createClient } = require("@libsql/client");
  const { S3Client, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
  const { upgradeSchema } = require("../lib/schema-upgrades.ts");
  const { storeImage, readImage } = require("../lib/storage.ts");
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
    retained = 0,
    retired = 0;
  try {
    if (apply) await upgradeSchema(db);
    for (const [table, owner] of [
      ["letters", "author_id"],
      ["drafts", "user_id"],
    ]) {
      if (retire) continue; // Retirement must never migrate additional attachments.
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
    else if (process.env.R2_BUCKET && /^https:\/\//.test(ref)) {
      const url = new URL(ref);
      if (!/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(url.pathname) || url.search || url.hash)
        throw new Error("Unsupported legacy object key");
      const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
      });
      const response = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: url.pathname.slice(1) }));
      bytes = Buffer.from(await response.Body.transformToByteArray());
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
      // The same public object may be referenced through different hostnames.
      const publicKey = (value) => {
        const ref = String(value || "").replace(/^upload:/, "");
        if (/^uploads\/[a-zA-Z0-9_.-]+$/.test(ref)) return ref;
        try {
          const url = new URL(ref);
          return url.protocol === "https:" && !url.search && !url.hash &&
            /^\/uploads\/[a-zA-Z0-9_.-]+$/.test(url.pathname)
            ? url.pathname.slice(1) : null;
        } catch { return null; }
      };
      const liveRefs = (await db.execute(
        "SELECT image AS ref FROM letters UNION ALL SELECT image AS ref FROM drafts UNION ALL SELECT avatar_id AS ref FROM users UNION ALL SELECT bg_id AS ref FROM users"
      )).rows;
      const candidates = (await db.execute(
        "SELECT legacy_ref, MAX(created_at) AS created_at FROM media WHERE legacy_ref IS NOT NULL AND legacy_retired=0 GROUP BY legacy_ref"
      )).rows;
      if (candidates.length !== 1 ||
          Number(candidates[0].created_at) > Date.parse("2026-11-13T11:20:00Z"))
        throw new Error("Retirement is authorized for exactly one pre-existing migrated attachment; no objects deleted");
      oldRefs.add(String(candidates[0].legacy_ref));
      for (const ref of oldRefs) {
        const key = publicKey(ref);
        if (!key) throw new Error("Unsupported retirement reference");
        if (liveRefs.some((row) => publicKey(row.ref) === key)) {
          retained++;
          continue;
        }
        const copies = (await db.execute({
          sql: "SELECT object_key,purpose FROM media WHERE legacy_ref=?",
          args: [ref],
        })).rows;
        if (!copies.length) throw new Error("Missing private replacement");
        for (const copy of copies) {
          const bytes = await readImage(String(copy.object_key), String(copy.purpose));
          if (!bytes.length) throw new Error("Empty private replacement");
        }
        if (ref.startsWith("uploads/"))
          await fs
            .unlink(path.join(process.cwd(), "public", ref))
            .catch((error) => {
              if (error.code !== "ENOENT") throw error;
            });
        else {
          const base = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
          const key = new URL(ref).pathname.slice(1);
          if (!new RegExp("^uploads/[a-zA-Z0-9_.-]+$").test(key)) throw new Error("Invalid retirement key");
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
          let absent = false;
          try {
            await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
          } catch (error) {
            if (error.$metadata?.httpStatusCode !== 404) throw error;
            absent = true;
          }
          if (!absent) throw new Error("Public source still exists after deletion");
        }
        retired++;
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
      retiredPublicFiles: retired,
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
