import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { genreLabel, fmtTime } from "@/lib/delivery";
import Postmark from "@/components/Postmark";
import Seal from "@/components/Seal";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; with?: string }>;
}) {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");
  const { scope = "mine", with: withPen } = await searchParams;

  let letters: { rows: any[] } = { rows: [] };
  let heading = "我的书信集";
  if (scope === "all") {
    heading = "慢递局 · 公开书信集";
    letters = await db.execute(`
      SELECT l.*, u.pen_name, u.seal_text FROM letters l JOIN users u ON u.id = l.author_id
      WHERE l.recipient_id IS NULL AND l.deliver_at <= ? ORDER BY l.deliver_at ASC`, [Date.now()]);
  } else if (scope === "with" && withPen) {
    const peer = await db.execute({ sql: "SELECT id, pen_name FROM users WHERE pen_name=?", args: [withPen] });
    if (peer.rows.length === 0) redirect("/print?scope=mine");
    heading = `与 ${withPen} 的往来书信集`;
    letters = await db.execute({
      sql: `SELECT l.*, u.pen_name, u.seal_text FROM letters l JOIN users u ON u.id = l.author_id
            WHERE ((l.author_id = ? AND l.recipient_id = ?) OR (l.author_id = ? AND l.recipient_id = ?))
            ORDER BY l.deliver_at ASC`,
      args: [sess.uid, String((peer.rows[0] as any).id), String((peer.rows[0] as any).id), sess.uid],
    });
  } else {
    letters = await db.execute({
      sql: `SELECT l.*, u.pen_name, u.seal_text FROM letters l JOIN users u ON u.id = l.author_id
            WHERE l.author_id = ? ORDER BY l.deliver_at ASC`,
      args: [sess.uid],
    });
  }

  return (
    <div>
      <div className="print:hidden">
        <div className="flex items-center justify-between">
          <Link href="/settings" className="text-sm text-ink-soft">
            ← 返回
          </Link>
          <PrintButton />
        </div>
        <div className="mt-4 flex gap-2">
          <Link href="/print?scope=mine" className={`btn-ghost ${scope === "mine" ? "!border-vermilion !text-vermilion" : ""}`}>
            我的信
          </Link>
          <Link href="/print?scope=all" className={`btn-ghost ${scope === "all" ? "!border-vermilion !text-vermilion" : ""}`}>
            全站公开信
          </Link>
        </div>
      </div>

      <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-1 text-center text-xs text-ink-soft">共 {letters.rows.length} 封 · 慢递局印制</p>

      <div className="mt-6 space-y-0">
        {letters.rows.map((l: any) => (
          <article key={l.id} className="letter-sheet">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-ink-soft">
                {String(l.pen_name)} · {genreLabel(String(l.genre))}
                {l.recipient_id ? " · 私信" : ""}
              </div>
              <Postmark city={l.city} time={Number(l.deliver_at)} size={88} firstDay={Number(l.first_day) === 1} />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">{String(l.title)}</h2>
            <p className={`mt-3 whitespace-pre-wrap text-[15px] leading-relaxed ${l.genre === "poem" ? "text-center" : ""}`}>
              {String(l.body)}
            </p>
            <div className="mt-4 flex items-end justify-between border-t border-black/10 pt-3">
              <span className="text-xs text-ink-soft">{fmtTime(Number(l.sent_at))} 投递于 {l.city || "慢递局"}</span>
              <Seal char={String(l.seal_text || l.pen_name[0])} size={34} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
