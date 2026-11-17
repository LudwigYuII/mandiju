import Link from "next/link";
import { notFound } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  readGathering,
  readGatheringPosts,
  readGatheringMembers,
} from "@/lib/gathering-service";
import { gatheringPhase } from "@/lib/gathering-policy";
import { formatSiteTime } from "@/lib/time";
import { UiText, UiInput, UiTextarea } from "@/components/UiText";
import LiteraryForm from "@/components/LiteraryForm";
import AnnotatedText from "@/components/AnnotatedText";
export const dynamic = "force-dynamic";
export default async function Gathering({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await waitDb();
  const { id } = await params,
    s = await getSession(),
    uid = s?.uid || "",
    v = await readGathering(db, id, uid);
  if (!v) notFound();
  const now = Date.now(),
    phase = gatheringPhase(Number(v.starts_at), Number(v.ends_at), now),
    ended = phase === "ended",
    owner = v.owner_id === uid;
  const n = Number((await searchParams).page),
    page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
  const [posts, members, mine, management] = await Promise.all([
    readGatheringPosts(db, id, uid, (page - 1) * 20, now),
    readGatheringMembers(db, id, uid, now),
    uid
      ? db.execute({
          sql: "SELECT status,archive_consent FROM literary_members WHERE space_id=? AND user_id=?",
          args: [id, uid],
        })
      : Promise.resolve({ rows: [] }),
    owner && !ended
      ? db.execute({
          sql: "SELECT m.user_id,m.status,u.pen_name FROM literary_members m JOIN public_users u ON u.id=m.user_id WHERE m.space_id=? AND m.status IN ('joined','invited')",
          args: [id],
        })
      : Promise.resolve({ rows: [] }),
  ]);
  const membership = mine.rows[0],
    joined = membership?.status === "joined";
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-4 border-b border-[var(--paper-edge)] pb-6">
        <p className="text-sm text-ink-soft">
          <UiText
            text={ended ? "集序" : phase === "open" ? "席间" : "雅集邀约"}
          />{" "}
          · <UiText text={v.visibility === "public" ? "公开席" : "私席"} />
        </p>
        <h1 className="break-words text-3xl leading-relaxed">
          {String(v.title)}
        </h1>
        <p className="whitespace-pre-wrap break-words leading-loose">
          {String(v.intro)}
        </p>
        <p className="text-sm text-ink-soft">
          <UiText text="主人：" />
          {String(v.pen_name)} · <UiText text="席位上限：" />
          {Number(v.capacity)}
        </p>
        <p className="text-sm leading-loose text-ink-soft">
          {formatSiteTime(Number(v.starts_at), String(v.event_timezone))} —{" "}
          {formatSiteTime(Number(v.ends_at), String(v.event_timezone))}
          <br />
          <UiText text="公共活动时区：" />
          {String(v.event_timezone)}
        </p>
        <p className="text-sm leading-loose text-ink-soft">
          <UiText
            text={
              ended
                ? "雅集已散席。以下仅保留获准归档的文字与名录；可见范围沿用原席。作者仍可撤回，站长可依站规处理内容。"
                : "席间文字按时间顺序留存，不自动刷新。不必即时回复；到结束时自动转为集序，仅展示本人授权的内容。"
            }
          />
        </p>
        <Link
          className="text-sm underline underline-offset-4"
          href="/gatherings"
        >
          <UiText text="回到雅集" />
        </Link>
      </header>
      {!ended &&
        s &&
        (membership?.status === "invited" ||
          (!membership && v.visibility === "public")) && (
          <section className="card space-y-4 p-6">
            <h2 className="text-xl">
              <UiText
                text={
                  membership?.status === "invited"
                    ? "有一封雅集邀帖"
                    : "从容入席"
                }
              />
            </h2>
            <LiteraryForm gathering op="join" fields={{ id }} label="入席">
              <label className="flex items-start gap-3">
                <UiInput name="consent" type="checkbox" required />
                <UiText text="同意在雅集进行期间按本席范围展示我的雅号；每篇文字另行确认展示与归档。" />
              </label>
              <label className="flex items-start gap-3">
                <UiInput name="archive" type="checkbox" />
                <UiText text="另同意将雅号列入集序出席名录（选填，可撤回）。" />
              </label>
            </LiteraryForm>
            {membership?.status === "invited" && (
              <LiteraryForm
                gathering
                op="decline"
                fields={{ id }}
                label="婉谢邀帖"
              />
            )}
          </section>
        )}
      {!s && !ended && v.visibility === "public" && (
        <Link className="btn" href="/login">
          <UiText text="登录后入席" />
        </Link>
      )}
      {members.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">
            <UiText text={ended ? "获准留名的出席者" : "在席书友"} />
          </h2>
          <p className="break-words leading-loose">
            {members.map((m) => String(m.pen_name)).join("、")}
          </p>
        </section>
      )}
      <section aria-label="依时间展读席间文字" className="space-y-6">
        {!posts.length && (
          <p className="py-6 text-ink-soft">
            <UiText
              text={
                ended
                  ? "这一页没有获准归档的文字。"
                  : "席间尚无文字，留待闲时。"
              }
            />
          </p>
        )}
        {posts.map((p) => (
          <article key={String(p.id)} className="card space-y-5 p-6 sm:p-8">
            <p className="text-sm text-ink-soft">
              {String(p.pen_name)} ·{" "}
              {formatSiteTime(Number(p.created_at), String(v.event_timezone))}
            </p>
            <div className="leading-loose">
              <AnnotatedText text={String(p.body)} />
            </div>
            {s && (
              <details className="text-sm">
                <summary className="cursor-pointer">
                  <UiText
                    text={p.author_id === uid ? "管理此篇" : "反馈此篇"}
                  />
                </summary>
                <div className="mt-4 space-y-4">
                  {p.author_id === uid ? (
                    <>
                      <p className="text-ink-soft">
                        <UiText
                          text={
                            Number(p.archive_consent)
                              ? "此篇已授权按本席范围留入集序；含署名。"
                              : "此篇未授权留入集序，结束后不再向他人展示。"
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
                      <LiteraryForm
                        gathering
                        op="withdraw"
                        fields={{ id: String(p.id) }}
                        label="收回此篇全部展示"
                      />
                    </>
                  ) : (
                    <LiteraryForm
                      gathering
                      op="report_post"
                      fields={{ id: String(p.id) }}
                      label="向站长反馈"
                    >
                      <label className="block space-y-2">
                        <span>
                          <UiText text="说明问题（最多五百字）" />
                        </span>
                        <UiTextarea
                          className="input w-full"
                          name="reason"
                          rows={3}
                          required
                          maxLength={500}
                        />
                      </label>
                    </LiteraryForm>
                  )}
                </div>
              </details>
            )}
          </article>
        ))}
      </section>
      <nav className="flex gap-5 text-sm">
        {page > 1 && (
          <Link href={`?page=${page - 1}`}>
            <UiText text="上一页" />
          </Link>
        )}
        {posts.length === 20 && (
          <Link href={`?page=${page + 1}`}>
            <UiText text="下一页" />
          </Link>
        )}
      </nav>
      {joined && phase === "open" && !Number(v.hidden) && (
        <section className="card space-y-5 p-6">
          <h2 className="text-xl">
            <UiText text="席间留文" />
          </h2>
          <LiteraryForm
            gathering
            op="post"
            fields={{ id, send_key: crypto.randomUUID() }}
            draftKey={`${uid}:gathering:${id}`}
            label="将此篇留席"
          >
            <label className="block space-y-2">
              <span>
                <UiText text="正文（最多一万字，可用自注 [[词语|解释或出处]]）" />
              </span>
              <UiTextarea
                className="input w-full"
                name="body"
                rows={9}
                required
              />
            </label>
            <label className="flex items-start gap-3">
              <UiInput name="consent" type="checkbox" required />
              <UiText text="确认在席间按本席范围展示此篇与我的署名。定稿后不能修改，可收回展示。" />
            </label>
            <label className="flex items-start gap-3">
              <UiInput name="archive" type="checkbox" />
              <UiText text="另同意将此篇原文及署名留入集序，保持本席范围（选填，可撤回）。未勾选则结束后不纳入集序。" />
            </label>
          </LiteraryForm>
        </section>
      )}
      {joined && (
        <details className="space-y-4 text-sm">
          <summary className="cursor-pointer">
            <UiText text="留名与离席" />
          </summary>
          <div className="mt-4 space-y-5">
            {!ended && (
              <LiteraryForm
                gathering
                op="archive_identity"
                fields={{ id }}
                label="保存留名选择"
              >
                <label className="flex items-start gap-3">
                  <UiInput
                    name="archive"
                    type="checkbox"
                    defaultChecked={!!Number(membership.archive_consent)}
                  />
                  <UiText text="将我的雅号列入集序出席名录；与每篇文字的归档授权独立。" />
                </label>
              </LiteraryForm>
            )}
            {ended && Number(membership.archive_consent) > 0 && (
              <LiteraryForm
                gathering
                op="archive_identity"
                fields={{ id }}
                label="撤回集序名录留名"
              />
            )}
            {!owner && (
              <>
                <p className="text-ink-soft leading-loose">
                  <UiText text="离席会撤回你在本席的全部文字展示和名录授权，失去私席访问权限；原文仍可从雅集首页的个人记录找回。离席后不能再入席。" />
                </p>
                <LiteraryForm
                  gathering
                  op="leave"
                  fields={{ id }}
                  label="确认离席并收回展示"
                />
              </>
            )}
          </div>
        </details>
      )}
      {owner && !ended && (
        <details className="text-sm">
          <summary className="cursor-pointer">
            <UiText text="主人管理" />
          </summary>
          <div className="mt-4 space-y-5">
            {management.rows
              .filter((m) => m.user_id !== uid)
              .map((m) => (
                <div key={String(m.user_id)} className="space-y-2">
                  <p>
                    {String(m.pen_name)} ·{" "}
                    <UiText
                      text={m.status === "invited" ? "邀帖未应" : "已入席"}
                    />
                  </p>
                  <LiteraryForm
                    gathering
                    op="revoke"
                    fields={{ id, target: String(m.user_id) }}
                    label="撤回席位及其文字展示"
                  />
                </div>
              ))}
            <p className="leading-loose text-ink-soft">
              <UiText text="提前散席会立即结束本次雅集，按既有授权生成集序，之后不能续开。" />
            </p>
            <LiteraryForm
              gathering
              op="close"
              fields={{ id }}
              label="确认提前散席"
            />
          </div>
        </details>
      )}
      {s && (
        <details className="text-sm">
          <summary className="cursor-pointer">
            <UiText text="向站长反馈雅集" />
          </summary>
          <div className="mt-4">
            <LiteraryForm
              gathering
              op="report"
              fields={{ id }}
              label="提交反馈"
            >
              <label className="block space-y-2">
                <span>
                  <UiText text="说明问题（最多五百字）" />
                </span>
                <UiTextarea
                  name="reason"
                  className="input w-full"
                  rows={3}
                  maxLength={500}
                  required
                />
              </label>
            </LiteraryForm>
          </div>
        </details>
      )}
    </div>
  );
}
