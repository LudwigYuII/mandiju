const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { createClient } = require("@libsql/client");
const { storeImage } = require("../lib/storage.ts");
const { upgradeSchema } = require("../lib/schema-upgrades.ts");
(async () => {
  if (!process.argv[2] || !process.env.MDJ_DB)
    throw new Error(
      "Snapshot directory and isolated MDJ_DB destination required",
    );
  const directory = path.resolve(process.argv[2]);
  const index = JSON.parse(
    await fs.readFile(path.join(directory, "attachments.json"), "utf8"),
  );
  const raw = process.env.MDJ_DB;
  const db = createClient({
    url: /^(file:|libsql:|https:)/.test(raw) ? raw : `file:${raw}`,
    authToken: process.env.MDJ_DB_AUTH_TOKEN,
  });
  try {
    await upgradeSchema(db);
    for (const entry of index) {
      const file = path.resolve(directory, entry.file);
      if (!file.startsWith(directory + path.sep))
        throw new Error("Invalid attachment path");
      const bytes = await fs.readFile(file);
      if (
        crypto.createHash("sha256").update(bytes).digest("hex") !== entry.sha256
      )
        throw new Error("Attachment digest mismatch");
      if (entry.id) {
        await storeImage(entry.object_key, bytes, "image/webp", entry.purpose);
        continue;
      }
      // Legacy attachments restore into PRIVATE objects, never back into public/uploads.
      for (const [table, owner] of [
        ["letters", "author_id"],
        ["drafts", "user_id"],
      ]) {
        const rows = (
          await db.execute({
            sql: `SELECT id,${owner} AS owner FROM ${table} WHERE image=?`,
            args: [entry.legacy_ref],
          })
        ).rows;
        for (const row of rows) {
          const id = crypto.randomUUID(),
            key = id + ".webp";
          const normalized = await sharp(bytes, { limitInputPixels: 20000000 })
            .rotate()
            .webp({ quality: 82 })
            .toBuffer();
          await storeImage(key, normalized, "image/webp", "letter");
          const tx = await db.transaction("write");
          try {
            await tx.execute({
              sql: "INSERT INTO media(id,owner_id,purpose,object_key,content_type,size,created_at) VALUES(?,?,?,?,?,?,?)",
              args: [
                id,
                String(row.owner),
                "letter",
                key,
                "image/webp",
                normalized.length,
                Date.now(),
              ],
            });
            await tx.execute({
              sql: `UPDATE ${table} SET image=? WHERE id=?`,
              args: [`api/media/${id}`, String(row.id)],
            });
            if (table === "letters")
              await tx.execute({
                sql: "INSERT INTO letter_media(letter_id,media_id) VALUES(?,?)",
                args: [String(row.id), id],
              });
            await tx.commit();
          } catch (e) {
            await tx.rollback();
            throw e;
          } finally {
            tx.close();
          }
        }
      }
    }
    console.log(
      `Restored and verified ${index.length} attachment objects into the isolated destination.`,
    );
  } finally {
    db.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
