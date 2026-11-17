import Link from "next/link";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listGatherings } from "@/lib/gathering-service";
import { gatheringPhase } from "@/lib/gathering-policy";
import { formatSiteTime } from "@/lib/time";
import { UiText } from "@/components/UiText";
import LiteraryForm from "@/components/LiteraryForm";
export const dynamic = "force-dynamic";
export default async function Gatherings({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await waitDb();
  const s = await getSession(),
    uid = s?.uid || "",
    n = Number((await searchParams).page),
    page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
  const [events, mine, me] = await Promise.all([
    listGatherings(db, uid, (page - 1) * 20),
    uid
      ? db.execute({
          sql: "SELECT id,body,space_id,archive_consent,withdrawn FROM gathering_posts WHERE author_id=? ORDER BY created_at DESC,id LIMIT 20 OFFSET ?",
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
          <UiText text="同题闲叙，散席留序" />
        </p>
        <h1 className="text-3xl">
          <UiText text="雅集" />
        </h1>
        <p className="leading-loose text-ink-soft">
          <UiText text="一席主题，几段闲文。不必守候屏幕，闲时赴约即可。结束后仅经本人授权的文字与名录留入集序，原有范围不变。" />
        </p>
        <Link className="btn" href={s ? "/gatherings/new" : "/login"}>
          <UiText text="设一席雅集" />
        </Link>
      </header>
      <section className="space-y-4">
        {!events.length && (
          <p className="py-8 text-ink-soft">
            <UiText text="席间尚静，等一场从容的相聚。" />
          </p>
        )}
        {events.map((v) => (
          <article key={String(v.id)} className="card space-y-3 p-6">
            <p className="text-xs text-ink-soft">
              {String(v.pen_name)} ·{" "}
              <UiText text={v.visibility === "public" ? "公开席" : "私席"} /> ·{" "}
              <UiText
                text={
                  { upcoming: "尚未开席", open: "席间", ended: "已成集序" }[
                    gatheringPhase(Number(v.starts_at), Number(v.ends_at))
                  ]
                }
              />
              {v.status === "invited" && (
                <>
                  {" "}
                  · <UiText text="有邀帖" />
                </>
              )}
            </p>
            <h2 className="text-xl">
              <Link href={`/gatherings/${v.id}`}>{String(v.title)}</Link>
            </h2>
            <p className="line-clamp-3 whitespace-pre-wrap break-words leading-loose text-ink-soft">
              {String(v.intro)}
            </p>
            <p className="text-xs text-ink-soft">
              {formatSiteTime(Number(v.starts_at), String(v.event_timezone))} —{" "}
              {formatSiteTime(Number(v.ends_at), String(v.event_timezone))} ·{" "}
              {String(v.event_timezone)}
            </p>
          </article>
        ))}
      </section>
      {uid && (
        <section className="space-y-4 border-t border-[var(--paper-edge)] pt-6">
          <h2 className="text-xl">
            <UiText text="我的席间文字" />
          </h2>
          <p className="text-sm text-ink-soft">
            <UiText text="离席、撤权或集序隐藏后，仍能在这里找回自己的原文。撤回归档不会删除原文。" />
          </p>
          {mine.rows.map((p) => (
            <details key={String(p.id)} className="card p-5">
              <summary className="cursor-pointer break-words">
                {String(p.body).slice(0, 40)}
                {Number(p.withdrawn) > 0 && (
                  <>
                    {" "}
                    · <UiText text="已收回展示" />
                  </>
                )}
              </summary>
              <div className="mt-4 space-y-4">
                <p className="whitespace-pre-wrap break-words leading-loose">
                  {String(p.body)}
                </p>
                <p className="text-sm text-ink-soft">
                  <UiText
                    text={
                      Number(p.archive_consent)
                        ? "已授权集序归档"
                        : "未授权集序归档"
                    }
                  />
                </p>
                {Number(p.archive_consent) > 0 && (
                  <LiteraryForm
                    gathering
                    op="unarchive"
                    fields={{ id: String(p.id) }}
                    label="撤回归档授权"
                  />
                )}
                {!Number(p.withdrawn) && (
                  <LiteraryForm
                    gathering
                    op="withdraw"
                    fields={{ id: String(p.id) }}
                    label="收回此篇全部展示"
                  />
                )}
              </div>
            </details>
          ))}
        </section>
      )}
      <nav className="flex flex-wrap gap-5 text-sm">
        {page > 1 && (
          <Link href={`?page=${page - 1}`}>
            <UiText text="上一页" />
          </Link>
        )}
        {(events.length === 20 || mine.rows.length === 20) && (
          <Link href={`?page=${page + 1}`}>
            <UiText text="下一页" />
          </Link>
        )}
        {me.rows[0]?.role === "admin" && (
          <Link href="/gatherings/review">
            <UiText text="雅集治理" />
          </Link>
        )}
        <Link href="/literature">
          <UiText text="唱和卷" />
        </Link>
      </nav>
    </div>
  );
}
