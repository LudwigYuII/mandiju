import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import StudyForm from "@/components/StudyForm";
import { UiText } from "@/components/UiText";
import { GIFT_KINDS } from "@/lib/study-policy";
import { formatSiteTime } from "@/lib/time";
export const dynamic = "force-dynamic";
const statuses: Record<string, string> = {
  pending: "待主人阅看",
  accepted: "已接见",
  declined: "已婉谢",
  withdrawn: "已收回",
  revoked: "访问已撤回",
};
export default async function Visits({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await waitDb();
  const s = await getSession();
  if (!s) redirect("/login");
  const raw = Number((await searchParams).page);
  const page = Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 10000) : 1;
  const offset = (page - 1) * 30,
    now = Date.now();
  const [visits, gifts, blocks] = await Promise.all([
    db.execute({
      sql: `SELECT v.*,p.pen_name AS owner_name,q.pen_name AS visitor_name FROM study_visits v JOIN public_users p ON p.id=v.owner_id JOIN public_users q ON q.id=v.visitor_id WHERE (v.owner_id=? OR v.visitor_id=?) AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=v.owner_id AND b.blocked_id=v.visitor_id) OR (b.blocker_id=v.visitor_id AND b.blocked_id=v.owner_id)) ORDER BY v.updated_at DESC,v.owner_id,v.visitor_id LIMIT 30 OFFSET ?`,
      args: [s.uid, s.uid, offset],
    }),
    db.execute({
      sql: `SELECT g.*,a.pen_name AS sender_name,b.pen_name AS recipient_name FROM gifts g JOIN public_users a ON a.id=g.sender_id JOIN public_users b ON b.id=g.recipient_id WHERE (g.sender_id=? OR (g.recipient_id=? AND g.available_at<=?)) AND NOT EXISTS(SELECT 1 FROM user_blocks x WHERE (x.blocker_id=g.sender_id AND x.blocked_id=g.recipient_id) OR (x.blocker_id=g.recipient_id AND x.blocked_id=g.sender_id)) ORDER BY g.created_at DESC,g.id LIMIT 30 OFFSET ?`,
      args: [s.uid, s.uid, now, offset],
    }),
    db.execute({
      sql: "SELECT b.blocked_id,u.pen_name FROM user_blocks b JOIN public_users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC,b.blocked_id LIMIT 30 OFFSET ?",
      args: [s.uid, offset],
    }),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-9">
      <header className="space-y-3">
        <p className="text-sm text-ink-soft">
          <UiText text="有来有往，亦可不答" />
        </p>
        <h1 className="text-3xl">
          <UiText text="拜帖与赠答" />
        </h1>
        <p className="leading-loose text-ink-soft">
          <UiText text="接见只开放内斋，不会新增笔友关系；可以随时撤回访问。" />
        </p>
        <Link
          href="/study/edit"
          className="text-sm underline underline-offset-4"
        >
          <UiText text="布置书斋" />
        </Link>
      </header>
      <section className="space-y-4">
        <h2 className="text-xl">
          <UiText text="门前拜帖" />
        </h2>
        {!visits.rows.length && (
          <p className="text-ink-soft">
            <UiText text="门前清静，暂无拜帖。" />
          </p>
        )}
        {visits.rows.map((v) => {
          const incoming = String(v.owner_id) === s.uid;
          const peer = String(incoming ? v.visitor_id : v.owner_id),
            name = String(incoming ? v.visitor_name : v.owner_name);
          const fields = { target: peer, revision: String(v.revision) };
          return (
            <article
              key={`${v.owner_id}:${v.visitor_id}`}
              className="card space-y-4 p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <Link
                  href={`/study/${encodeURIComponent(name)}`}
                  className="underline underline-offset-4"
                >
                  {name}
                </Link>
                <span className="text-sm text-ink-soft">
                  <UiText text={incoming ? "来访" : "我的拜帖"} /> ·{" "}
                  <UiText text={statuses[String(v.status)] || "待处理"} />
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words leading-loose">
                {String(v.note)}
              </p>
              <p className="text-xs text-ink-soft">
                {formatSiteTime(Number(v.updated_at))}
              </p>
              <div className="flex flex-wrap gap-4">
                {v.status === "pending" &&
                  (incoming ? (
                    <>
                      <StudyForm op="accept" fields={fields} label="接见" />
                      <StudyForm
                        op="decline"
                        fields={fields}
                        label="婉谢"
                        caution
                      />
                    </>
                  ) : (
                    <StudyForm
                      op="withdraw"
                      fields={fields}
                      label="收回拜帖"
                      caution
                    />
                  ))}
                {incoming && v.status === "accepted" && (
                  <StudyForm
                    op="revoke"
                    fields={fields}
                    label="撤回内斋访问"
                    caution
                  />
                )}
                {incoming &&
                  ["declined", "withdrawn", "revoked"].includes(
                    String(v.status),
                  ) &&
                  Number(v.retry_at) > now && (
                    <StudyForm
                      op="reopen"
                      fields={fields}
                      label="允许重新递帖"
                      caution
                    />
                  )}
              </div>
            </article>
          );
        })}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl">
          <UiText text="往来小物" />
        </h2>
        <p className="text-sm text-ink-soft">
          <UiText text="赠答仅双方可见。无需回赠，也可婉谢；闭关中的赠答暂存至出关。" />
        </p>
        {!gifts.rows.length && (
          <p className="text-ink-soft">
            <UiText text="案上尚无赠答。" />
          </p>
        )}
        {gifts.rows.map((g) => {
          const incoming = String(g.recipient_id) === s.uid,
            name = String(incoming ? g.sender_name : g.recipient_name);
          return (
            <article key={String(g.id)} className="card space-y-3 p-5">
              <p className="text-sm text-ink-soft">
                <UiText text={incoming ? "来自" : "赠予"} />{" "}
                <Link
                  href={`/study/${encodeURIComponent(name)}`}
                  className="underline"
                >
                  {name}
                </Link>
              </p>
              <h3 className="text-xl">
                <UiText
                  text={GIFT_KINDS[String(g.kind) as keyof typeof GIFT_KINDS]}
                />
              </h3>
              {g.note && (
                <p className="whitespace-pre-wrap break-words leading-loose">
                  {String(g.note)}
                </p>
              )}
              <p className="text-xs text-ink-soft">
                <UiText
                  text={
                    incoming
                      ? g.status === "pending"
                        ? "可收下，亦可婉谢"
                        : g.status === "accepted"
                          ? "已收下"
                          : "已婉谢"
                      : Number(g.available_at) > now
                        ? "暂存中"
                        : "已赠出"
                  }
                />
              </p>
              {incoming && g.status === "pending" && (
                <div className="flex gap-4">
                  <StudyForm
                    op="gift_accept"
                    fields={{ target: String(g.sender_id), id: String(g.id) }}
                    label="收下"
                  />
                  <StudyForm
                    op="gift_decline"
                    fields={{ target: String(g.sender_id), id: String(g.id) }}
                    label="婉谢"
                    caution
                  />
                </div>
              )}
            </article>
          );
        })}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl">
          <UiText text="往来边界" />
        </h2>
        <p className="text-sm leading-loose text-ink-soft">
          <UiText text="屏蔽后暂停双方新的拜帖、赠答与寄信，并撤回内斋访问。尚在途的信暂存，已送达的旧信保留。解除屏蔽不会自动恢复访客权限。" />
        </p>
        {!blocks.rows.length && (
          <p className="text-sm text-ink-soft">
            <UiText text="暂无屏蔽记录。" />
          </p>
        )}
        {blocks.rows.map((b) => (
          <div
            className="card flex flex-wrap items-start justify-between gap-3 p-5"
            key={String(b.blocked_id)}
          >
            <span>{String(b.pen_name)}</span>
            <StudyForm
              op="unblock"
              fields={{ target: String(b.blocked_id) }}
              label="解除屏蔽"
              caution
            />
          </div>
        ))}
      </section>
      <nav className="flex gap-5 text-sm" aria-label="分页">
        {page > 1 && (
          <Link href={`/visits?page=${page - 1}`}>
            <UiText text="上一页" />
          </Link>
        )}
        {[visits, gifts, blocks].some((r) => r.rows.length === 30) && (
          <Link href={`/visits?page=${page + 1}`}>
            <UiText text="下一页" />
          </Link>
        )}
      </nav>
    </div>
  );
}
