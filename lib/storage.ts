// 图片存储：R2（S3 兼容）优先，未配置时回退本地 public/uploads
import fs from "fs";
import path from "path";

export function r2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

export async function storeImage(
  name: string,
  buf: Buffer,
  contentType: string
): Promise<string> {
  if (r2Configured()) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: `uploads/${name}`,
        Body: buf,
        ContentType: contentType,
      })
    );
    const base = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
    return `${base}/uploads/${name}`;
  }
  // 本地回退（开发环境）
  const dir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return `uploads/${name}`;
}
