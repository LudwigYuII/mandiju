import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { waitDb } from "@/lib/db";
import { storeImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await waitDb();
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "没有文件" }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "仅支持 JPG/PNG/WebP" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "文件不能超过 5MB" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `${sess.uid}-${Date.now()}.${ext}`;
  const url = await storeImage(name, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ url });
}
