import Link from "next/link";
import { notFound } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { readEntry } from "@/lib/literary-service";
import { UiText, UiTextarea } from "@/components/UiText";
import LiteraryForm from "@/components/LiteraryForm";
import AnnotatedText from "@/components/AnnotatedText";
import ColophonSection from "@/components/ColophonSection";
import Seal from "@/components/Seal";
export const dynamic = "force-dynamic";
export default async function Work({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notesPage?: string }>;
}) {
  await waitDb();
  const { id } = await params,
    s = await getSession(),
    uid = s?.uid || "",
    e = await readEntry(db, id, uid);
  if (!e) notFound();
  const owner = uid === String(e.author_id);
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <nav className="flex gap-5 text-sm">
        <Link href={`/literature/${e.space_id}`}>
          <UiText text="回到原卷" />
        </Link>
        <Link href="/literature">
          <UiText text="唱和卷" />
        </Link>
      </nav>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <article className="card space-y-6 p-6 sm:p-9">
          <p className="text-sm text-ink-soft">
            {String(e.pen_name)} ·{" "}
            <UiText text={e.visibility === "public" ? "公开卷" : "私卷"} />
          </p>
          <h1 className="text-3xl leading-relaxed break-words">
            {String(e.title)}
          </h1>
          {Number(e.withdrawn) > 0 && (
            <p className="text-sm text-ink-soft">
              <UiText text="此篇已收回，仅作者保留原文。" />
            </p>
          )}
          {Number(e.hidden) > 0 && (
            <p className="text-sm text-ink-soft">
              <UiText text="此篇已暂停展示。" />
            </p>
          )}
          <div
            className={
              Number(e.vertical)
                ? "writing-vertical max-h-[32rem] overflow-x-auto text-lg leading-loose"
                : "text-lg leading-loose"
            }
          >
            <AnnotatedText text={String(e.body)} />
          </div>
          {e.rhyme && (
            <p className="text-sm text-ink-soft">
              <UiText text="韵脚提示：" />
              {String(e.rhyme)}
            </p>
          )}
          <div className="flex justify-end">
            <Seal char={String(e.seal_text)} size={45} />
          </div>
          {owner && !Number(e.withdrawn) && (
            <details className="border-t border-[var(--paper-edge)] pt-4 text-sm">
              <summary className="cursor-pointer">
                <UiText text="收回展示" />
              </summary>
              <p className="my-4 text-ink-soft">
                <UiText text="原文为自己保留，同卷书友仅见收回标记，题跋不再随篇展示。" />
              </p>
              <LiteraryForm
                op="withdraw"
                fields={{ id }}
                label="确认收回此篇"
              />
            </details>
          )}
          {s && !owner && (
            <details className="text-sm">
              <summary className="cursor-pointer">
                <UiText text="作品反馈" />
              </summary>
              <LiteraryForm
                op="report"
                fields={{ kind: "entry", id }}
                label="提交反馈"
              >
                <label className="block space-y-2 pt-4">
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
            </details>
          )}
        </article>
        <ColophonSection
          kind="entry"
          id={id}
          uid={uid}
          page={Number((await searchParams).notesPage) || 1}
        />
      </div>
    </div>
  );
}
