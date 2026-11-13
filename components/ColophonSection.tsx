import Link from "next/link";
import { db } from "@/lib/db";
import { readColophonTarget, readColophons } from "@/lib/literary-service";
import { UiText, UiInput, UiTextarea } from "./UiText";
import LiteraryForm from "./LiteraryForm";
export default async function ColophonSection({
  kind,
  id,
  uid = "",
  page = 1,
}: {
  kind: "entry" | "letter";
  id: string;
  uid?: string;
  page?: number;
}) {
  const target = await readColophonTarget(db, kind, id, uid);
  if (!target) return null;
  const n = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
  const notes = await readColophons(db, kind, id, uid, (n - 1) * 30),
    owner = String(target.author_id) === uid;
  return (
    <aside
      id="colophons"
      className="space-y-5 border-t border-[var(--paper-edge)] pt-6 text-sm scroll-mt-28"
    >
      <h2 className="text-lg">
        <UiText text="题跋" />
      </h2>
      <p className="leading-loose text-ink-soft">
        <UiText text="短评百字以内，由作品作者收录后随本篇展示；不授权转载或另行出版。" />
      </p>
      {!notes.length && (
        <p className="text-ink-soft">
          <UiText text="笺旁尚无题跋。" />
        </p>
      )}
      {notes.map((note) => (
        <article
          key={String(note.id)}
          className="space-y-3 border-l border-[var(--paper-edge)] pl-4"
        >
          <p className="whitespace-pre-wrap break-words leading-loose">
            {String(note.body)}
          </p>
          <p className="text-xs text-ink-soft">{String(note.pen_name)}</p>
          {note.status !== "accepted" && (
            <p className="text-xs text-ink-soft">
              <UiText
                text={
                  note.status === "pending"
                    ? "尚未收录，仅题跋者与作品作者可见"
                    : note.status === "declined"
                      ? "已婉谢"
                      : "已收回"
                }
              />
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {owner && note.status === "pending" && (
              <>
                <LiteraryForm
                  op="collect"
                  fields={{
                    id: String(note.id),
                    revision: String(note.revision),
                  }}
                  label="收录"
                />
                <LiteraryForm
                  op="decline_note"
                  fields={{
                    id: String(note.id),
                    revision: String(note.revision),
                  }}
                  label="婉谢"
                />
              </>
            )}
            {uid === String(note.author_id) && note.status !== "withdrawn" && (
              <LiteraryForm
                op="withdraw_note"
                fields={{ id: String(note.id) }}
                label="收回题跋"
              />
            )}
          </div>
        </article>
      ))}
      <nav className="flex gap-5">
        {n > 1 && (
          <Link href={`?notesPage=${n - 1}#colophons`}>
            <UiText text="上一页" />
          </Link>
        )}
        {notes.length === 30 && (
          <Link href={`?notesPage=${n + 1}#colophons`}>
            <UiText text="下一页" />
          </Link>
        )}
      </nav>
      {uid && !owner ? (
        <LiteraryForm
          op="colophon"
          fields={{ kind, id }}
          label="留题跋"
          draftKey={`${uid}:colophon:${kind}:${id}`}
        >
          <label className="block space-y-2">
            <span>
              <UiText text="留一句短评（最多一百字）" />
            </span>
            <UiTextarea
              name="body"
              required
              rows={3}
              className="input w-full"
            />
          </label>
          <label className="flex items-start gap-3">
            <UiInput type="checkbox" name="consent" required />
            <UiText text="同意收录后按本篇当前可见范围展示我的题跋及雅号；我可随时收回。" />
          </label>
        </LiteraryForm>
      ) : !uid ? (
        <Link href="/login" className="underline">
          <UiText text="登录后留题跋" />
        </Link>
      ) : null}
    </aside>
  );
}
