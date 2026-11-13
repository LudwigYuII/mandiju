const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { readImage } = require("../lib/storage.ts");
(async () => {
  const root = path.resolve(process.argv[2] || "backups");
  const entries = await fs.readdir(root);
  const directory = path.join(root, entries.sort().at(-1));
  const manifest = JSON.parse(
    await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  const readTable = async (table) => {
    try {
      return JSON.parse(
        await fs.readFile(
          path.join(directory, "tables", table + ".json"),
          "utf8",
        ),
      ).rows;
    } catch {
      return [];
    }
  };
  const index = [];
  await fs.mkdir(path.join(directory, "attachments"), { recursive: true });
  for (const media of await readTable("media")) {
    const bytes = await readImage(media.object_key, media.purpose);
    const file = `attachments/${media.id}.webp`;
    await fs.writeFile(path.join(directory, file), bytes, { mode: 0o600 });
    index.push({
      id: media.id,
      object_key: media.object_key,
      purpose: media.purpose,
      file,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const refs = new Set(
    [...(await readTable("letters")), ...(await readTable("drafts"))]
      .map((row) => row.image)
      .filter((ref) => ref && !ref.startsWith("api/media/")),
  );
  for (const ref of refs) {
    let bytes;
    const base = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
    if (/^uploads\/[a-zA-Z0-9_.-]+$/.test(ref))
      bytes = await fs.readFile(path.join(process.cwd(), "public", ref));
    else if (base && ref.startsWith(base + "/uploads/")) {
      const response = await fetch(ref, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Legacy attachment unavailable");
      bytes = Buffer.from(await response.arrayBuffer());
    } else
      throw new Error(
        "Unsupported legacy attachment reference " + JSON.stringify({ absoluteHttps: /^https:\/\//.test(ref), rootRelative: ref.startsWith("/"), inlineImage: ref.startsWith("data:image/"), hasUploadsPath: ref.includes("/uploads/"), configuredBaseMatches: !!base && ref.startsWith(base + "/"), surroundingWhitespace: ref !== ref.trim(), baseSurroundingWhitespace: base !== base.trim(), baseHasUploadsSuffix: base.endsWith("/uploads"), refLength: ref.length }),
      );
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    const file = `attachments/legacy-${digest}`;
    await fs.writeFile(path.join(directory, file), bytes, { mode: 0o600 });
    index.push({ legacy_ref: ref, file, sha256: digest });
  }
  await fs.writeFile(
    path.join(directory, "attachments.json"),
    JSON.stringify(index, null, 2),
    { mode: 0o600 },
  );
  manifest.attachments = { count: index.length, index: "attachments.json" };
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`Verified and exported ${index.length} attachment objects.`);
})().catch((e) => {
  console.error("Attachment backup failed:", e.message);
  process.exit(1);
});
