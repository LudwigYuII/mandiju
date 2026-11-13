import { NextRequest, NextResponse } from "next/server";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canReadLetter } from "@/lib/letter-policy";
import { readImage } from "@/lib/storage";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await waitDb();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id))
    return new NextResponse(null, { status: 404 });
  const sess = await getSession();
  const media = (
    await db.execute({ sql: "SELECT * FROM media WHERE id=?", args: [id] })
  ).rows[0];
  if (!media) return new NextResponse(null, { status: 404 });
  const ref = `api/media/${id}`;
  let allowed = false;
  if (media.purpose === "profile") {
    const linked =
      (
        await db.execute({
          sql: "SELECT 1 FROM users WHERE avatar_id=? OR bg_id=? LIMIT 1",
          args: [`upload:${ref}`, `upload:${ref}`],
        })
      ).rows.length > 0;
    allowed = sess?.uid === String(media.owner_id) || linked;
  } else {
    const letters = await db.execute({
      sql: "SELECT l.* FROM letters l JOIN letter_media lm ON lm.letter_id=l.id WHERE lm.media_id=?",
      args: [id],
    });
    if (!letters.rows.length) allowed = sess?.uid === String(media.owner_id);
    else
      allowed = letters.rows.some(
        (l) =>
          canReadLetter(l as any, sess?.uid) &&
          (!Number(l.burn_seconds) || String(l.recipient_id) === sess?.uid) &&
          !Number(l.burned) &&
          !(
            Number(l.burn_seconds) > 0 &&
            (!Number(l.burned_at) || Number(l.burned_at) <= Date.now())
          ),
      );
  }
  if (!allowed) return new NextResponse(null, { status: 404 });
  try {
    const data = await readImage(
      String(media.object_key),
      String(media.purpose),
    );
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
