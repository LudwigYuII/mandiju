import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import { waitDb, db } from "@/lib/db";
import { storeImage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  await waitDb();
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin)
    return NextResponse.json({ error: "来源无效" }, { status: 403 });
  if (!(await rateLimit(`upload:${sess.uid}`, 20, 3600000)).ok)
    return NextResponse.json({ error: "上传过于频繁" }, { status: 429 });
  const length = Number(req.headers.get("content-length"));
  if (length > 6 * 1024 * 1024)
    return NextResponse.json({ error: "文件过大" }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return NextResponse.json(
        { error: "请上传不超过5MB的JPG/PNG/WebP图片" },
        { status: 400 },
      );
    const purpose = form.get("purpose") === "profile" ? "profile" : "letter";
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, {
      limitInputPixels: 20000000,
      failOn: "error",
      animated: false,
    });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format || ""))
      throw new Error("Unsupported format");
    // Decode, normalize orientation, resize, and re-encode. No EXIF/GPS is retained.
    const buf = await image
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    const id = crypto.randomUUID();
    const key = `${id}.webp`;
    await storeImage(key, buf, "image/webp", purpose);
    await db.execute({
      sql: "INSERT INTO media(id,owner_id,purpose,object_key,content_type,size,created_at) VALUES(?,?,?,?,?,?,?)",
      args: [id, sess.uid, purpose, key, "image/webp", buf.length, Date.now()],
    });
    return NextResponse.json(
      { url: `api/media/${id}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "上传未完成，请检查图片或联系站长核对存储配置" },
      { status: 400 },
    );
  }
}
