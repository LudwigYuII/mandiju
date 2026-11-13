import Link from "next/link";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UiText } from "@/components/UiText";
import { formatSiteTime } from "@/lib/time";
export const dynamic = "force-dynamic";
export default async function Literature({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await waitDb();
  const s = await getSession(),
    uid = s?.uid || "";
  const n = Number((await searchParams).page),
    page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
  const [spaces, own, me] = await Promise.all([
    db.execute({
      sql: `SELECT s.id,s.title,s.intro,s.visibility,s.created_at,s.closed,u.pen_name,m.status FROM literary_spaces s JOIN public_users u ON u.id=s.owner_id LEFT JOIN literary_members m ON m.space_id=s.id AND m.user_id=? WHERE s.owner_id=? OR (s.hidden=0 AND (s.visibility='public' OR (m.status IN ('joined','invited') AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.owner_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=s.owner_id))))) ORDER BY s.created_at DESC,s.id LIMIT 20 OFFSET ?`,
      args: [uid, uid, uid, uid, (page - 1) * 20],
    }),
    uid
      ? db.execute({
          sql: "SELECT id,title,withdrawn FROM literary_entries WHERE author_id=? ORDER BY created_at DESC,id LIMIT 20 OFFSET ?",
          args: [uid, (page - 1) * 20],
        })
      : Promise.resolve({ rows: [] }),
    uid
      ? db.execute({ sql: "SELECT role FROM users WHERE id=?", args: [uid] })
      : Promise.resolve({ rows: [] }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-4">
        <p className="text-sm text-ink-soft">
          <UiText text="不计高下，且听回声" />
        </p>
        <h1 className="text-3xl">
          <UiText text="唱和卷" />
        </h1>
        <p className="leading-loose text-ink-soft">
          <UiText text="从一首诗开始，诸友依序相和。公开卷可自由展读，私卷留给题定的受邀书友。" />
        </p>
        <Link className="btn" href={s ? "/literature/new" : "/login"}>
          <UiText text="起一卷唱和" />
        </Link>
      </header>
      <section className="space-y-4">
        {!spaces.rows.length && (
          <p className="py-8 text-ink-soft">
            <UiText text="卷轴尚空，等一首起首之作。" />
          </p>
        )}
        {spaces.rows.map((v) => (
          <article key={String(v.id)} className="card space-y-3 p-6">
            <p className="text-xs text-ink-soft">
              {String(v.pen_name)} ·{" "}
              <UiText text={v.visibility === "public" ? "公开卷" : "私卷"} />{" "}
              {v.status === "invited" && <UiText text="· 有卷邀" />}{" "}
              {Number(v.closed) > 0 && <UiText text="· 已封卷" />}
            </p>
            <h2 className="text-xl">
              <Link href={`/literature/${v.id}`}>{String(v.title)}</Link>
            </h2>
            {v.intro && (
              <p className="line-clamp-3 whitespace-pre-wrap break-words leading-loose text-ink-soft">
                {String(v.intro)}
              </p>
            )}
            <time className="text-xs text-ink-soft">
              {formatSiteTime(Number(v.created_at))}
            </time>
          </article>
        ))}
      </section>
      {uid && (
        <section className="space-y-3 border-t border-[var(--paper-edge)] pt-6">
          <h2 className="text-xl">
            <UiText text="我的篇章" />
          </h2>
          <p className="text-sm text-ink-soft">
            <UiText text="离卷后仍可从这里找回自己的作品，或收回展示。" />
          </p>
          {own.rows.map((w) => (
            <p key={String(w.id)}>
              <Link
                className="underline underline-offset-4"
                href={`/works/${w.id}`}
              >
                {String(w.title)}
              </Link>
              {Number(w.withdrawn) > 0 && (
                <span className="text-sm text-ink-soft">
                  {" "}
                  · <UiText text="已收回" />
                </span>
              )}
            </p>
          ))}
        </section>
      )}
      <nav className="flex flex-wrap gap-5 text-sm">
        {page > 1 && (
          <Link href={`/literature?page=${page - 1}`}>
            <UiText text="上一页" />
          </Link>
        )}
        {spaces.rows.length === 20 || own.rows.length === 20 ? (
          <Link href={`/literature?page=${page + 1}`}>
            <UiText text="下一页" />
          </Link>
        ) : null}
        {me.rows[0]?.role === "admin" && (
          <Link href="/literature/review">
            <UiText text="作品治理" />
          </Link>
        )}
      </nav>
    </div>
  );
}
