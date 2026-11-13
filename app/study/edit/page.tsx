import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import StudyForm from "@/components/StudyForm";
import { UiText, UiInput, UiTextarea } from "@/components/UiText";
export const dynamic = "force-dynamic";
export default async function EditStudy() {
  await waitDb();
  const s = await getSession();
  if (!s) redirect("/login");
  const me = (
    await db.execute({
      sql: "SELECT literary_name FROM users WHERE id=?",
      args: [s.uid],
    })
  ).rows[0];
  if (!me?.literary_name) redirect("/identity");
  const p = (
    await db.execute({
      sql: "SELECT * FROM study_profiles WHERE owner_id=?",
      args: [s.uid],
    })
  ).rows[0];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-ink-soft">
          <UiText text="书斋 · 题名与陈设" />
        </p>
        <h1 className="text-3xl">
          <UiText text="布置书斋" />
        </h1>
        <p className="leading-loose text-ink-soft">
          <UiText text="门庭迎客，内斋留给获准的来访者。这里的文字由你亲自公开，旧信与草稿不会自动陈列。" />
        </p>
      </header>
      <StudyForm
        op="profile"
        fields={{ revision: String(p?.revision || 0) }}
        label="保存书斋"
      >
        <section className="card space-y-5 p-6">
          <label className="block space-y-2">
            <span>
              <UiText text="书斋名（公开，二至二十字，可留空）" />
            </span>
            <UiInput
              name="name"
              maxLength={40}
              defaultValue={String(p?.name || "")}
              className="input w-full"
            />
          </label>
          <label className="block space-y-2">
            <span>
              <UiText text="门庭小序（公开，最多五百字）" />
            </span>
            <UiTextarea
              name="public_intro"
              defaultValue={String(p?.public_intro || "")}
              rows={5}
              className="input w-full"
            />
          </label>
        </section>
        <section className="card space-y-5 p-6">
          <label className="block space-y-2">
            <span>
              <UiText text="内斋札记（仅自己和获准访客可见，最多五千字）" />
            </span>
            <UiTextarea
              name="inner_note"
              defaultValue={String(p?.inner_note || "")}
              rows={10}
              className="input w-full"
            />
          </label>
          <p className="text-sm text-ink-soft">
            <UiText text="请勿在此粘贴未经对方同意公开的私人来信。" />
          </p>
          <label className="flex items-center gap-3">
            <UiInput
              name="visits_closed"
              type="checkbox"
              defaultChecked={!!Number(p?.visits_closed)}
            />
            <UiText text="暂不收拜帖" />
          </label>
          <label className="flex items-center gap-3">
            <UiInput
              name="gifts_closed"
              type="checkbox"
              defaultChecked={!!Number(p?.gifts_closed)}
            />
            <UiText text="暂不收赠答" />
          </label>
        </section>
      </StudyForm>
      <nav className="flex flex-wrap gap-5 text-sm">
        <Link href={`/study/${encodeURIComponent(String(me.literary_name))}`}>
          <UiText text="回到书斋" />
        </Link>
        <Link href="/visits">
          <UiText text="拜帖与赠答" />
        </Link>
      </nav>
    </div>
  );
}
