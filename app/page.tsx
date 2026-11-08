import Link from "next/link";
import quotes from "@/data/quotes.json";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sweepDelivered } from "@/lib/mail";
import { todayFirstDay } from "@/lib/calendar";
import { fmtTime } from "@/lib/delivery";
import LetterCard, { type LetterRow } from "@/components/LetterCard";
import NoteForm from "@/components/NoteForm";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function Home() {
  await waitDb();
  const sess = await getSession();
  await sweepDelivered(); // 送达通知（懒扫描）
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  const notes = await db.execute(`
    SELECT n.body, n.created_at, u.pen_name
    FROM notes n JOIN users u ON u.id = n.author_id
    WHERE n.archived = 0 ORDER BY n.created_at DESC LIMIT 30`);

  const timeline = await db.execute({
    sql: `
      SELECT l.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text,
        (SELECT COUNT(*) FROM likes k WHERE k.letter_id = l.id) AS likes,
        (SELECT COUNT(*) FROM replies r WHERE r.letter_id = l.id) AS replies
      FROM letters l JOIN users u ON u.id = l.author_id
      WHERE l.recipient_id IS NULL AND l.deliver_at <= ?
      ORDER BY l.deliver_at DESC LIMIT 50`,
    args: [Date.now()],
  });

  let transit: { rows: any[] } = { rows: [] };
  if (sess) {
    transit = await db.execute({
      sql: `
        SELECT l.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text, 0 AS likes, 0 AS replies
        FROM letters l JOIN users u ON u.id = l.author_id
        WHERE l.author_id = ? AND l.deliver_at > ?
        ORDER BY l.deliver_at ASC LIMIT 10`,
      args: [sess.uid, Date.now()],
    });
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rise py-12 text-center md:py-16">
        <p className="text-xs tracking-[0.35em] text-ink-soft">给彼此的信，不着急</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-6xl">慢递局</h1>
        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-ink-soft">
          一个小圈子的笔友邮局。写信，贴邮票，盖邮戳，然后等它慢慢送达。
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={sess ? "/write" : "/login"} className="btn !px-8 !py-3 !text-lg">
            {sess ? "写一封信" : "回局里"}
          </Link>
          {sess && (
            <Link href="/stamps" className="btn-ghost !px-6 !py-3 !text-base">
              邮票册
            </Link>
          )}
        </div>
      </section>

      {/* 笺语 */}
      <Link
        href="/quotes"
        className="rise block select-none text-center text-xs leading-relaxed text-ink-soft/80 transition hover:text-ink-soft"
        style={{ animationDelay: "90ms" }}
      >
        {quote}
      </Link>

      {/* 局内钟 */}
      <div className="rise flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "120ms" }}>
        {(() => {
          const fd = todayFirstDay();
          if (fd) {
            return (
              <span className="rounded-full border border-vermilion/30 bg-vermilion/5 px-3 py-1 text-xs text-vermilion">
                🏮 今日{fd.kind === "term" ? "节气" : ""} {fd.name} · 发行首日
              </span>
            );
          }
          return null;
        })()}
        {(() => {
          const rows = transit.rows as any[];
          if (rows.length === 0) return null;
          const next = Math.min(...rows.map((r: any) => Number(r.deliver_at)));
          const diff = next - Date.now();
          const label =
            diff < 60_000
              ? "马上到"
              : diff < 3_600_000
                ? `约 ${Math.ceil(diff / 60_000)} 分钟后到`
                : diff < 86_400_000
                  ? `约 ${Math.ceil(diff / 3_600_000)} 小时后到`
                  : `${fmtTime(next)} 到`;
          return (
            <span className="rounded-full border border-postblue/30 bg-postblue/5 px-3 py-1 text-xs text-postblue">
              📬 在途 {rows.length} 封 · 下一封 {label}
            </span>
          );
        })()}
      </div>

      {sess && (
        <div className="flex justify-end">
          <Link href="/mail" className="text-xs text-ink-soft hover:text-ink">
            我的来信 →
          </Link>
        </div>
      )}

      {/* 站内搜索 */}
      <form action="/search" method="get" className="rise" style={{ animationDelay: "150ms" }}>
        <input
          name="q"
          className="input"
          placeholder="🔍 搜一封公开信（标题、正文、笔名）…"
          maxLength={40}
        />
      </form>

      {/* 留言墙 */}
      <section className="card glass rise p-5" style={{ animationDelay: "180ms" }}>
        <h2 className="text-sm font-semibold tracking-widest">留言墙</h2>
        {notes.rows.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">墙上还空着，贴第一张便签吧。</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {notes.rows.map((n: any, i: number) => (
              <span
                key={i}
                className="rounded-lg bg-paper2/70 px-2.5 py-1.5 text-[13px]"
                title={`${n.pen_name} 贴`}
              >
                {n.body}
              </span>
            ))}
          </div>
        )}
        <NoteForm signedIn={!!sess} />
      </section>

      {/* 运输中 */}
      {transit.rows.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs tracking-widest text-ink-soft">你的信正在路上</h2>
          {transit.rows.map((l: any) => (
            <LetterCard key={l.id} l={l as LetterRow} ghost />
          ))}
        </section>
      )}

      {/* 时间线 */}
      <section className="space-y-4">
        {timeline.rows.length === 0 ? (
          <div className="py-14 text-center text-ink-soft">
            <p className="text-2xl">📮</p>
            <p className="mt-3 text-sm">邮筒还空着，要不要写一封？</p>
            {sess ? (
              <Link href="/write" className="btn mt-5">
                写信
              </Link>
            ) : (
              <Link href="/login" className="btn mt-5">
                登录
              </Link>
            )}
          </div>
        ) : (
          timeline.rows.map((l: any, i: number) => (
            <Reveal key={l.id} delay={Math.min(i, 6) * 60}>
              <LetterCard l={l as LetterRow} />
            </Reveal>
          ))
        )}
      </section>
    </div>
  );
}
