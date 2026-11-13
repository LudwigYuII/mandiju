import Link from "next/link";
import { notFound } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readSpace, readEntries } from "@/lib/literary-service";
import { UiText, UiInput, UiTextarea } from "@/components/UiText";
import LiteraryForm from "@/components/LiteraryForm";
import AnnotatedText from "@/components/AnnotatedText";
import Seal from "@/components/Seal";
export const dynamic = "force-dynamic";
export default async function Scroll({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  await waitDb();
  const { id } = await params,
    s = await getSession(),
    uid = s?.uid || "";
  const v = await readSpace(db, id, uid);
  if (!v) notFound();
  const [entries, membership, members] = await Promise.all([
    readEntries(db, id, uid),
    uid
      ? db.execute({
          sql: "SELECT status FROM literary_members WHERE space_id=? AND user_id=?",
          args: [id, uid],
        })
      : Promise.resolve({ rows: [] }),
    uid
      ? db.execute({
          sql: `SELECT m.user_id,m.status,u.pen_name FROM literary_members m JOIN public_users u ON u.id=m.user_id WHERE m.space_id=? AND (m.status='joined' OR ?=?) AND EXISTS(SELECT 1 FROM literary_members mine WHERE mine.space_id=m.space_id AND mine.user_id=? AND mine.status='joined')`,
          args: [id, uid, String(v.owner_id), uid],
        })
      : Promise.resolve({ rows: [] }),
  ]);
  const state = membership.rows[0]?.status,
    owner = uid === String(v.owner_id),
    isHorizontal = (await searchParams).layout !== "stack";
  const done = entries.some((e) => String(e.author_id) === uid);
  return (
    <div className="space-y-8">
      <header className="mx-auto max-w-3xl space-y-4 border-b border-[var(--paper-edge)] pb-6">
        <p className="text-sm text-ink-soft">
          <UiText
            text={v.visibility === "public" ? "公开唱和卷" : "私人唱和卷"}
          />{" "}
          · {String(v.pen_name)}
        </p>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl leading-relaxed break-words">
            {String(v.title)}
          </h1>
          <Seal char={String(v.seal_text)} size={46} />
        </div>
        {v.intro && (
          <p className="whitespace-pre-wrap break-words leading-loose">
            {String(v.intro)}
          </p>
        )}
        {v.rhyme && (
          <p className="text-sm text-ink-soft">
            <UiText text="韵脚提示：" />
            {String(v.rhyme)}
          </p>
        )}
        <p className="text-sm text-ink-soft">
          <UiText text="参与上限（含起首者）：" />
          {Number(v.capacity)} ·{" "}
          <UiText text={Number(v.closed) ? "已封卷" : "静候和作"} />
        </p>
        <nav className="flex flex-wrap gap-5 text-sm">
          <Link href="/literature">
            <UiText text="回到唱和卷" />
          </Link>
          <Link href={`?layout=${isHorizontal ? "stack" : "scroll"}`}>
            <UiText text={isHorizontal ? "切换为逐篇阅读" : "切换为横向展卷"} />
          </Link>
        </nav>
      </header>
      {state === "invited" && (
        <section className="card mx-auto max-w-3xl space-y-4 p-6">
          <h2 className="text-xl">
            <UiText text="有一封卷邀" />
          </h2>
          <p className="leading-loose text-ink-soft">
            <UiText text="入卷后可阅读全卷，雅号随卷展示。可以婉谢，不必说明理由。" />
          </p>
          <LiteraryForm op="join" fields={{ id }} label="入卷">
            <label className="flex gap-3">
              <UiInput type="checkbox" name="consent" required />
              <UiText text="同意雅号随本卷范围展示" />
            </label>
          </LiteraryForm>
          <LiteraryForm op="decline_invite" fields={{ id }} label="婉谢卷邀" />
        </section>
      )}
      {v.visibility === "public" && s && !state && !Number(v.closed) && (
        <section className="card mx-auto max-w-3xl space-y-4 p-6">
          <LiteraryForm op="join" fields={{ id }} label="入卷相和">
            <label className="flex gap-3">
              <UiInput name="consent" type="checkbox" required />
              <UiText text="同意雅号随本卷范围展示" />
            </label>
          </LiteraryForm>
        </section>
      )}
      <section
        className={
          isHorizontal ? "literary-scroll" : "mx-auto max-w-3xl space-y-6"
        }
        aria-label="依序展读作品"
        tabIndex={isHorizontal ? 0 : undefined}
      >
        {entries.map((e) => (
          <article key={String(e.id)} className="card space-y-5 p-6 sm:p-8">
            <p className="text-xs text-ink-soft">
              <UiText text={Number(e.position) === 1 ? "起首" : "和作"} /> ·{" "}
              {String(e.pen_name)}
            </p>
            <h2 className="text-2xl">
              <Link href={`/works/${e.id}`}>{String(e.title)}</Link>
            </h2>
            <div
              className={
                Number(e.vertical)
                  ? "writing-vertical max-h-[28rem] overflow-x-auto leading-loose"
                  : "leading-loose"
              }
            >
              <AnnotatedText text={String(e.body)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/works/${e.id}`}
                className="text-sm underline underline-offset-4"
              >
                <UiText text="展读与题跋" />
              </Link>
              <Seal char={String(e.seal_text)} size={32} />
            </div>
          </article>
        ))}
      </section>
      {state === "joined" && !done && !Number(v.closed) && (
        <section className="card mx-auto max-w-3xl space-y-5 p-6">
          <h2 className="text-xl">
            <UiText text="接续一篇和作" />
          </h2>
          <LiteraryForm
            op="append"
            fields={{ id, send_key: crypto.randomUUID() }}
            label="将此篇入卷"
            draftKey={`${uid}:append:${id}`}
          >
            <label className="block space-y-2">
              <span>
                <UiText text="篇名（最多八十字）" />
              </span>
              <UiInput
                name="title"
                required
                maxLength={80}
                className="input w-full"
              />
            </label>
            <label className="block space-y-2">
              <span>
                <UiText text="正文（最多一万字）" />
              </span>
              <UiTextarea
                name="body"
                required
                rows={10}
                className="input w-full"
              />
            </label>
            <label className="block space-y-2">
              <span>
                <UiText text="韵脚提示（选填）" />
              </span>
              <UiInput name="rhyme" maxLength={100} className="input w-full" />
            </label>
            <p className="text-sm text-ink-soft">
              <UiText text="自注写法：[[词语|解释或出处]]。原文保存，点击或键盘聚焦词语即可展读注释。" />
            </p>
            <label className="flex gap-3">
              <UiInput name="vertical" type="checkbox" />
              <UiText text="此篇使用直排阅读" />
            </label>
            <label className="flex items-start gap-3">
              <UiInput name="consent" type="checkbox" required />
              <UiText text="确认按本卷范围展示此篇和作及雅号；受邀名单在起卷时题定。定稿后可收回展示。" />
            </label>
          </LiteraryForm>
        </section>
      )}
      {members.rows.length > 0 && (
        <section className="mx-auto max-w-3xl space-y-4 border-t border-[var(--paper-edge)] pt-6">
          <h2 className="text-lg">
            <UiText text="同卷书友" />
          </h2>
          {members.rows.map((m) => (
            <div
              className="flex flex-wrap justify-between gap-3 text-sm"
              key={String(m.user_id)}
            >
              <span>
                {String(m.pen_name)}{" "}
                {owner && m.status !== "joined" && (
                  <UiText
                    text={m.status === "invited" ? "· 卷邀未应" : "· 已离卷"}
                  />
                )}
              </span>
              {owner &&
                String(m.user_id) !== uid &&
                ["invited", "joined"].includes(String(m.status)) && (
                  <LiteraryForm
                    op="revoke_member"
                    fields={{ id, target: String(m.user_id) }}
                    label="撤回入卷权限"
                  />
                )}
            </div>
          ))}
        </section>
      )}
      {owner && !Number(v.closed) && (
        <details className="mx-auto max-w-3xl text-sm">
          <summary className="cursor-pointer">
            <UiText text="封卷" />
          </summary>
          <p className="my-4 text-ink-soft">
            <UiText text="封卷后不再接纳入卷和接续；各作者仍可收回自己的作品。" />
          </p>
          <LiteraryForm op="close" fields={{ id }} label="确认封卷" />
        </details>
      )}
      {!owner && s && (
        <details className="mx-auto max-w-3xl text-sm">
          <summary className="cursor-pointer">
            <UiText text="往来与反馈" />
          </summary>
          <div className="mt-4 space-y-4">
            {state === "joined" && (
              <LiteraryForm op="leave" fields={{ id }} label="离卷" />
            )}
            <LiteraryForm
              op="report"
              fields={{ kind: "space", id }}
              label="提交反馈"
            >
              <label className="block space-y-2">
                <span>
                  <UiText text="向站长说明问题（最多五百字）" />
                </span>
                <UiTextarea
                  name="reason"
                  required
                  rows={3}
                  className="input w-full"
                />
              </label>
            </LiteraryForm>
          </div>
        </details>
      )}
    </div>
  );
}
