import Link from "next/link";
import { notFound } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { friendshipBetween } from "@/lib/friends";
import Seal from "@/components/Seal";
import FriendButton from "@/components/FriendButton";
import LetterCard, { type LetterRow } from "@/components/LetterCard";
import { avatarFile, bgFile, imgUrl } from "@/lib/assets";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ pen: string }> }) {
  await waitDb();
  const { pen } = await params;
  const sess = await getSession();

  const u = (
    await db.execute({ sql: "SELECT * FROM users WHERE pen_name=?", args: [decodeURIComponent(pen)] })
  ).rows[0] as any;
  if (!u) notFound();

  const letters = await db.execute({
    sql: `
      SELECT l.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text,
        (SELECT COUNT(*) FROM likes k WHERE k.letter_id = l.id) AS likes,
        (SELECT COUNT(*) FROM replies r WHERE r.letter_id = l.id) AS replies
      FROM letters l JOIN users u ON u.id = l.author_id
      WHERE l.author_id = ? AND l.recipient_id IS NULL AND l.deliver_at <= ?
      ORDER BY l.deliver_at DESC LIMIT 50`,
    args: [String(u.id), Date.now()],
  });

  const isMe = !!sess && String(u.id) === sess.uid;
  const rel = !isMe && sess ? await friendshipBetween(sess.uid, String(u.id)) : "none";
  const avatarSrc = String(u.avatar_id).startsWith("upload:")
    ? imgUrl(String(u.avatar_id).slice(7))
    : avatarFile(String(u.avatar_id));
  const bgRaw = String(u.bg_id);
  const bgUploaded = bgRaw.startsWith("upload:");
  const bgSrc = bgUploaded ? imgUrl(bgRaw.slice(7)) : bgFile(bgRaw);

  // 是否笔友或曾往来：满足任一即可进入「往来册」
  let exchanged = false;
  if (sess && !isMe) {
    const c = await db.execute({
      sql: `SELECT 1 FROM letters
            WHERE ((author_id = ? AND recipient_id = ?) OR (author_id = ? AND recipient_id = ?))
              AND author_id != recipient_id
            LIMIT 1`,
      args: [sess.uid, String(u.id), String(u.id), sess.uid],
    });
    exchanged = c.rows.length > 0;
  }
  const showCorrespondence = !!sess && !isMe && (rel === "friends" || exchanged);

  return (
    <div className="space-y-5">
      {/* 题签 */}
      <div className="card glass relative overflow-hidden">
        {bgUploaded ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bgSrc}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-md"
            />
            <div className="absolute inset-0 bg-black/20" />
          </>
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgSrc})` }}
          />
        )}
        <div className="relative flex items-end justify-between bg-black/25 p-5 pt-16 backdrop-blur-[2px]">
          <div className="flex items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc} alt="" loading="lazy" decoding="async" className="h-24" />
            <div className="pb-1 text-white">
              <div className="text-lg font-bold drop-shadow">{String(u.pen_name)} 的书房</div>
              <div className="text-xs opacity-90">寄出 {Number(u.letters_sent)} 封信</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 pb-1">
            <Seal char={String(u.seal_text || u.pen_name[0])} size={48} tone="vermilion" />
            {showCorrespondence && (
              <Link
                href={`/correspondence/${encodeURIComponent(String(u.pen_name))}`}
                className="btn !px-4 !py-1.5 !text-sm"
              >
                往来册
              </Link>
            )}
            {sess && !isMe && (
              <FriendButton targetId={String(u.id)} pen={String(u.pen_name)} rel={rel} />
            )}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        {letters.rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft">书房还空着，他还没有寄出过信。</p>
        ) : (
          letters.rows.map((l: any) => <LetterCard key={l.id} l={l as LetterRow} />)
        )}
      </section>
    </div>
  );
}
