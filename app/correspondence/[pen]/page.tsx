import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { gateOnboard } from "@/lib/onboard";
import { genreLabel, fmtTime } from "@/lib/delivery";
import Postmark from "@/components/Postmark";
import Seal, {
  sealToneOf,
  sealPatternOf,
  sealToneToRender,
  type LetterSealTone,
  type SealPattern,
} from "@/components/Seal";
import { paperKindOf, paperClass, type PaperKind } from "@/components/paper";
import PrintButton from "@/components/PrintButton";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

/** 与某位笔友的往来册：两人之间全部已送达私信（不含焚毁信），按送达时间升序装订成册 */
export default async function CorrespondencePage({
  params,
}: {
  params: Promise<{ pen: string }>;
}) {
  await waitDb();
  const sess = await gateOnboard();
  if (!sess) redirect("/login");

  const { pen } = await params;
  const peerPen = decodeURIComponent(pen);

  const [me, peer] = await Promise.all([
    db.execute({ sql: "SELECT * FROM users WHERE id=?", args: [sess.uid] }),
    db.execute({ sql: "SELECT * FROM users WHERE pen_name=?", args: [peerPen] }),
  ]);
  const meRow = me.rows[0] as any;
  const peerRow = peer.rows[0] as any;
  if (!peerRow) notFound();
  const peerId = String(peerRow.id);
  if (peerId === sess.uid) notFound(); // 自己与自己没有往来册（时光胶囊不在此列）

  const letters = await db.execute({
    sql: `SELECT l.*, u.pen_name, u.seal_text FROM letters l JOIN users u ON u.id = l.author_id
          WHERE ((l.author_id = ? AND l.recipient_id = ?) OR (l.author_id = ? AND l.recipient_id = ?))
            AND l.author_id != l.recipient_id
            AND l.deliver_at <= ?
            AND (l.burn_seconds IS NULL OR l.burn_seconds = 0)
          ORDER BY l.deliver_at ASC`,
    args: [sess.uid, peerId, peerId, sess.uid, Date.now()],
  });
  const rows = letters.rows as any[];
  const firstYear = rows.length > 0 ? new Date(Number(rows[0].deliver_at)).getFullYear() : null;
  const mePen = String(meRow.pen_name);

  return (
    <div>
      <div className="print:hidden">
        <div className="flex items-center justify-between">
          <Link href="/mail" className="text-sm text-ink-soft">
            ← 回往来信笺
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* 封面卡 */}
      <Reveal>
        <section className="card glass grain relative mt-4 overflow-hidden p-7 text-center">
          <p className="text-[11px] font-semibold tracking-[0.32em] text-ink-soft">慢递局 · 通信集</p>
          <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-7">
            <div className="flex flex-col items-center gap-2">
              <Seal char={String(meRow.seal_text || meRow.pen_name[0])} size={58} tone="vermilion" />
              <span className="text-sm font-semibold">{mePen}</span>
            </div>
            <span className="font-serif text-xl text-vermilion/70">×</span>
            <div className="flex flex-col items-center gap-2">
              <Seal char={String(peerRow.seal_text || peerRow.pen_name[0])} size={58} tone="blue" />
              <span className="text-sm font-semibold">{peerPen}</span>
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">与 {peerPen} 的往来册</h1>
          <p className="mt-1.5 text-xs text-ink-soft">
            往来 {rows.length} 封{firstYear ? ` · 始于 ${firstYear} 年` : ""}
          </p>
        </section>
      </Reveal>

      {rows.length === 0 ? (
        <Reveal delay={80}>
          <div className="card glass grain mt-6 p-8 text-center">
            <p className="text-sm leading-relaxed text-ink-soft">
              你们之间还没有已送达的信。
              <br />
              第一封信，往往是一段友谊的开始。
            </p>
            <Link href={`/write?to=${encodeURIComponent(peerPen)}`} className="btn mt-5">
              给 {peerPen} 写第一封信
            </Link>
          </div>
        </Reveal>
      ) : (
        <div className="mt-6 space-y-0">
          {rows.map((l: any) => {
            const sealColor: LetterSealTone = sealToneOf(l.seal_color);
            const sealPattern: SealPattern = sealPatternOf(l.seal_pattern);
            const paperKind: PaperKind = paperKindOf(l.paper);
            const vertical = Number(l.vertical) === 1;
            const fromMe = String(l.author_id) === sess.uid;
            return (
              <article key={l.id} className={`letter-sheet ${paperClass(paperKind)}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-ink-soft">
                    {String(l.pen_name)} · {genreLabel(String(l.genre))}
                    <span className="ml-1.5 text-xs">{fromMe ? "我寄出的" : "寄给我的"}</span>
                  </div>
                  <Postmark
                    city={l.city}
                    time={Number(l.deliver_at)}
                    size={88}
                    firstDay={Number(l.first_day) === 1}
                  />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{String(l.title)}</h2>
                <p
                  className={`mt-3 whitespace-pre-wrap text-[15px] leading-relaxed ${
                    l.genre === "poem" ? "text-center" : ""
                  } ${vertical ? "writing-vertical" : ""}`}
                >
                  {String(l.body)}
                </p>
                <div
                  className={`mt-4 flex items-end justify-between border-t pt-3 ${
                    paperKind === "night" ? "border-white/15" : "border-black/10"
                  }`}
                >
                  <span className="text-xs text-ink-soft">
                    {fmtTime(Number(l.sent_at))} 投递于 {l.city || "慢递局"}
                  </span>
                  <Seal
                    char={String(l.seal_text || l.pen_name[0])}
                    size={34}
                    tone={sealToneToRender(sealColor)}
                    pattern={sealPattern}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
