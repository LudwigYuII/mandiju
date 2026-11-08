import Link from "next/link";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { currentHost, getCurrentTopic, monthStamp, monthKey } from "@/lib/topics";
import { stampDefById } from "@/lib/assets";
import Stamp from "@/components/Stamp";
import Seal from "@/components/Seal";
import Reveal from "@/components/Reveal";
import TopicProposeForm from "@/components/TopicProposeForm";
import TopicCreateForm from "@/components/TopicCreateForm";
import TopicWithdrawButton from "@/components/TopicWithdrawButton";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  await waitDb();
  const sess = await getSession();
  const host = await currentHost();
  const topic = await getCurrentTopic();
  const stamp = monthStamp();
  const monthLabel = `${new Date().getMonth() + 1} 月`;

  const pool = await db.execute(`
    SELECT tp.id, tp.title, tp.proposer_id, u.pen_name FROM topic_pool tp
    JOIN users u ON u.id = tp.proposer_id
    WHERE tp.status = 'pending' ORDER BY tp.created_at DESC LIMIT 30`);

  let participants: { rows: any[] } = { rows: [] };
  let hostUser: any = null;
  if (topic) {
    participants = await db.execute({
      sql: `SELECT u.pen_name, u.avatar_id, u.bg_id, u.seal_text, l.id AS letter_id, l.title AS letter_title
            FROM topic_letters tl
            JOIN letters l ON l.id = tl.letter_id
            JOIN users u ON u.id = l.author_id
            WHERE tl.topic_id = ? AND l.deliver_at <= ?
            ORDER BY l.deliver_at ASC`,
      args: [String(topic.id), Date.now()],
    });
    hostUser = (
      await db.execute({ sql: "SELECT pen_name, seal_text FROM users WHERE id=?", args: [String(topic.host_id)] })
    ).rows[0] as any;
  }

  const me = sess ? (await db.execute({ sql: "SELECT role FROM users WHERE id=?", args: [sess.uid] })).rows[0] as any : null;
  const canHost = !!sess && !!host && (sess.uid === host.id || String(me?.role) === "admin");

  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">同题共写</h1>

      {/* 本月主题 */}
      <Reveal>
        <section className="card glass p-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-ink-soft">
            {monthLabel} · 轮值邮差 {host?.pen ?? "虚位以待"}
          </p>
          {topic ? (
            <>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{String(topic.title)}</h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                <Seal char={String(hostUser?.seal_text || hostUser?.pen_name?.[0] || "邮")} size={22} />
                由 {String(hostUser?.pen_name ?? "邮差")} 挂出
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-paper2/50 p-3">
                {stamp && <Stamp file={stamp.file} size={72} />}
                <div className="text-sm">
                  <div className="font-semibold">本月纪念票：{stamp?.name}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">就本月主题写信，即可解锁</div>
                </div>
              </div>
              {sess ? (
                <Link href={`/write?topic=${topic.id}`} className="btn mt-4 !px-6">
                  就这个主题写信
                </Link>
              ) : (
                <Link href="/login" className="btn mt-4 !px-6">
                  登录后参加
                </Link>
              )}

              <div className="mt-6 border-t border-black/5 pt-4 dark:border-white/10">
                <p className="mb-2 text-xs font-semibold text-ink-soft">
                  参与者（{participants.rows.length}）
                </p>
                {participants.rows.length === 0 ? (
                  <p className="text-sm text-ink-soft">还没有人来写，等你开头。</p>
                ) : (
                  <ul className="space-y-2">
                    {participants.rows.map((p: any) => (
                      <li key={p.letter_id}>
                        <Link href={`/letter/${p.letter_id}`} className="flex items-center gap-2 text-sm">
                          <Seal char={String(p.seal_text || p.pen_name[0])} size={18} />
                          <span className="font-semibold">{String(p.pen_name)}</span>
                          <span className="truncate text-ink-soft">《{String(p.letter_title)}》</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">本月主题尚未挂出</h2>
              {canHost ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-ink-soft">从题池选一道，或自己出：</p>
                  <TopicCreateForm
                    pool={pool.rows.map((r: any) => ({ id: String(r.id), title: String(r.title) }))}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">
                  等本月轮值邮差（{host?.pen ?? "…"}）挂出主题，或者先在题池投题。
                </p>
              )}
            </>
          )}
        </section>
      </Reveal>

      {/* 题池 */}
      <Reveal delay={80}>
        <section className="card glass p-6">
          <h2 className="text-sm font-semibold tracking-widest">题池</h2>
          <p className="mt-1 text-xs text-ink-soft">任何成员都能投题；轮值邮差每月从这里选题挂出。</p>
          <div className="mt-3">
            <TopicProposeForm signedIn={!!sess} />
          </div>
          {pool.rows.length > 0 && (
            <ul className="mt-4 space-y-2">
              {pool.rows.map((p: any) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2.5 text-sm dark:border-white/10"
                >
                  <span className="min-w-0 truncate">{String(p.title)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-ink-soft">{String(p.pen_name)} 投</span>
                    {sess && String(p.proposer_id) === sess.uid && (
                      <TopicWithdrawButton poolId={String(p.id)} />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>

      <Reveal delay={140}>
        <p className="text-center text-xs text-ink-soft">
          每月一枚限定纪念票，错过等明年 ·{" "}
          <Link href="/bureau" className="text-vermilion">
            邮务司发行历 →
          </Link>
        </p>
      </Reveal>
    </div>
  );
}
