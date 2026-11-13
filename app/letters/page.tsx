import { UiText, UiInput } from "@/components/UiText";

import { siteDateParts } from "@/lib/time";
import Link from "next/link";
import quotes from "@/data/quotes.json";
import { db, waitDb } from "@/lib/db";
import { gateOnboard } from "@/lib/onboard";
import { sweepDelivered } from "@/lib/mail";
import { todayFirstDay, upcomingFirstDays } from "@/lib/calendar";
import { fmtTime } from "@/lib/delivery";
import LetterCard, { type LetterRow } from "@/components/LetterCard";
import NoteForm from "@/components/NoteForm";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await waitDb();
  const sess = await gateOnboard();
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  const now = Date.now();
  const [, notes, timeline, transit, announcements, me] = await Promise.all([
    sweepDelivered(), // 送达通知（懒扫描，cron 兜底）
    db.execute(`
      SELECT n.body, n.created_at, u.pen_name
      FROM notes n JOIN users u ON u.id = n.author_id
      WHERE n.archived = 0 ORDER BY n.created_at DESC LIMIT 30`),
    db.execute({
      sql: `
        SELECT l.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text,
          (SELECT COUNT(*) FROM likes k WHERE k.letter_id = l.id) AS likes,
          (SELECT COUNT(*) FROM replies r WHERE r.letter_id = l.id) AS replies
        FROM letters l JOIN users u ON u.id = l.author_id
        WHERE l.recipient_id IS NULL AND l.moderation_hidden=0 AND l.deliver_at <= ?
        ORDER BY l.deliver_at DESC LIMIT ? OFFSET ?`,
      args: [now, PAGE_SIZE + 1, offset],
    }),
    sess
      ? db.execute({
          sql: `
            SELECT l.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text, 0 AS likes, 0 AS replies
            FROM letters l JOIN users u ON u.id = l.author_id
            WHERE l.author_id = ? AND l.deliver_at > ?
            ORDER BY l.deliver_at ASC LIMIT 10`,
          args: [sess.uid, now],
        })
      : Promise.resolve({ rows: [] }),
    db.execute(
      "SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 3",
    ),
    sess
      ? db.execute({
          sql: "SELECT birthday FROM users WHERE id=?",
          args: [sess.uid],
        })
      : Promise.resolve({ rows: [] }),
  ]);

  const hasMore = timeline.rows.length > PAGE_SIZE;
  const pageRows = hasMore ? timeline.rows.slice(0, PAGE_SIZE) : timeline.rows;

  // 今日生辰
  const bday = String(me.rows[0]?.birthday ?? "");
  const bdayToday =
    sess &&
    /^\d{4}-\d{2}-\d{2}$/.test(bday) &&
    Number(bday.slice(5, 7)) === siteDateParts().month &&
    Number(bday.slice(8, 10)) === siteDateParts().day;

  // 节气提醒
  const fd = todayFirstDay();
  const upcoming = upcomingFirstDays(7)
    .filter((u) => u.days > 0)
    .slice(0, 2);

  const noteWall = (
    <section className="card glass p-5">
      <h2 className="text-sm font-semibold tracking-widest">
        <UiText text={"留言墙"} />
      </h2>
      {notes.rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">
          <UiText text={"墙上还空着，贴第一张便签吧。"} />
        </p>
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
  );

  const searchBox = (
    <form action="/search" method="get">
      <UiInput
        name="q"
        className="input"
        placeholder="🔍 搜一封公开信（标题、正文、笔名）…"
        maxLength={40}
      />
    </form>
  );

  const announceList =
    announcements.rows.length > 0 ? (
      <section className="space-y-2">
        {announcements.rows.map((a: any) => (
          <div
            key={a.id}
            className="card glass flex items-start gap-2 p-3.5 text-sm"
          >
            <span className="shrink-0">
              <UiText text={Number(a.pinned) === 1 ? "📌" : "📢"} />
            </span>
            <span className="min-w-0">{String(a.body)}</span>
          </div>
        ))}
      </section>
    ) : null;

  return (
    <div className="page-wide space-y-8 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-8">
      <div className="space-y-8">
        {/* Hero */}
        <section className="rise py-12 text-center md:py-16">
          <p className="text-xs tracking-[0.35em] text-ink-soft">
            <UiText text={"给彼此的信，不着急"} />
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-6xl">
            <UiText text={"慢递局"} />
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-ink-soft">
            <UiText
              text={
                "一个小圈子的笔友邮局。写信，贴邮票，盖邮戳，然后等它慢慢送达。"
              }
            />
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href={sess ? "/write" : "/login"}
              className="btn !px-8 !py-3 !text-lg"
            >
              <UiText text={sess ? "写一封信" : "回局里"} />
            </Link>
            {sess && (
              <Link
                href="/friends"
                className="btn-ghost !px-6 !py-3 !text-base"
              >
                <UiText text={"笔友"} />
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
        <div
          className="rise flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: "120ms" }}
        >
          {fd && (
            <span className="rounded-full border border-vermilion/30 bg-vermilion/5 px-3 py-1 text-xs text-vermilion">
              <UiText text={"🏮 今日"} />
              <UiText text={fd.kind === "term" ? "节气" : ""} /> {fd.name}
            </span>
          )}
          {!fd &&
            upcoming.map((u) => (
              <span
                key={u.name}
                className="rounded-full border border-vermilion/20 bg-vermilion/5 px-3 py-1 text-xs text-vermilion/90"
              >
                🏮 {u.days}
                <UiText text={"天后 ·"} />
                {u.name}
              </span>
            ))}
          {(() => {
            const rows = transit.rows as any[];
            if (rows.length === 0) return null;
            const next = Math.min(
              ...rows.map((r: any) => Number(r.deliver_at)),
            );
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
                <UiText text={"📬 在途"} />
                {rows.length}
                <UiText text={"封 · 下一封"} />
                {label}
              </span>
            );
          })()}
        </div>

        {/* 公告 + 搜索 + 留言墙（移动端） */}
        <div className="space-y-6 xl:hidden">
          {announceList}
          {searchBox}
          {noteWall}
        </div>

        {sess && (
          <div className="flex justify-end">
            <Link href="/mail" className="text-xs text-ink-soft hover:text-ink">
              <UiText text={"我的来信 →"} />
            </Link>
          </div>
        )}

        {/* 运输中 */}
        {transit.rows.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-xs tracking-widest text-ink-soft">
              <UiText text={"你的信正在路上"} />
            </h2>
            {transit.rows.map((l: any) => (
              <LetterCard key={l.id} l={l as LetterRow} ghost />
            ))}
          </section>
        )}

        {/* 时间线 */}
        <section className="space-y-4">
          {pageRows.length === 0 ? (
            <div className="py-14 text-center text-ink-soft">
              <p className="text-2xl">📮</p>
              <p className="mt-3 text-sm">
                <UiText text={"邮筒还空着，要不要写一封？"} />
              </p>
              {sess ? (
                <Link href="/write" className="btn mt-5">
                  <UiText text={"写信"} />
                </Link>
              ) : (
                <Link href="/login" className="btn mt-5">
                  <UiText text={"登录"} />
                </Link>
              )}
            </div>
          ) : (
            pageRows.map((l: any, i: number) => (
              <Reveal key={l.id} delay={Math.min(i, 6) * 60}>
                <LetterCard l={l as LetterRow} />
              </Reveal>
            ))
          )}
        </section>

        {/* 分页 */}
        <div className="flex items-center justify-between px-1 text-sm">
          {page > 1 ? (
            <Link
              href={page === 2 ? "/" : `/letters?page=${page - 1}`}
              className="text-ink-soft hover:text-ink"
            >
              <UiText text={"← 更新的信"} />
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link
              href={`/letters?page=${page + 1}`}
              className="text-ink-soft hover:text-ink"
            >
              <UiText text={"更早的信 →"} />
            </Link>
          )}
        </div>
      </div>

      {/* 侧栏（桌面宽屏） */}
      <aside className="hidden space-y-6 xl:block">
        <div className="xl-aside space-y-6">
          {announceList}
          {searchBox}
          {noteWall}
        </div>
      </aside>
    </div>
  );
}
