import fs from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
export function r2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}
function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
function bucket(purpose: string) {
  const name =
    purpose === "letter"
      ? process.env.R2_PRIVATE_BUCKET
      : process.env.R2_BUCKET;
  if (!name || (purpose === "letter" && name === process.env.R2_BUCKET))
    throw new Error(
      "Private attachments require a separate non-public R2_PRIVATE_BUCKET",
    );
  return name;
}
const root = () =>
  path.resolve(
    process.env.MDJ_PRIVATE_STORAGE ||
      path.join(process.cwd(), "data", "private-media"),
  );
export async function storeImage(
  key: string,
  buf: Buffer,
  contentType: string,
  purpose = "letter",
): Promise<string> {
  if (!/^[a-z0-9-]+\.webp$/.test(key)) throw new Error("Invalid object key");
  if (r2Configured()) {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket(purpose),
        Key: `media/${key}`,
        Body: buf,
        ContentType: contentType,
        CacheControl: "private, no-store",
      }),
    );
    return key;
  }
  if (process.env.NODE_ENV === "production" && !process.env.MDJ_PRIVATE_STORAGE)
    throw new Error(
      "Configure private object storage or persistent MDJ_PRIVATE_STORAGE",
    );
  await fs.mkdir(root(), { recursive: true });
  await fs.writeFile(path.join(root(), key), buf, { mode: 0o600 });
  return key;
}
export async function readImage(key: string, purpose: string) {
  if (!/^[a-z0-9-]+\.webp$/.test(key)) throw new Error("Invalid object key");
  if (r2Configured()) {
    const response = await client().send(
      new GetObjectCommand({ Bucket: bucket(purpose), Key: `media/${key}` }),
    );
    return Buffer.from(await response.Body!.transformToByteArray());
  }
  return fs.readFile(path.join(root(), key));
}
