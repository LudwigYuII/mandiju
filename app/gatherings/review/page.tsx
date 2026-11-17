import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { UiText, UiInput } from "@/components/UiText";
import LiteraryForm from "@/components/LiteraryForm";
export const dynamic = "force-dynamic";
export default async function Review({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await waitDb();
  const s = await getSession();
  if (!s) redirect("/login");
  const me = (
    await db.execute({
      sql: "SELECT role FROM users WHERE id=?",
      args: [s.uid],
    })
  ).rows[0];
  if (me?.role !== "admin") redirect("/gatherings");
  const n = Number((await searchParams).page),
    page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
  const reports = (
    await db.execute({
      sql: `SELECT r.*,CASE WHEN r.target_kind='post' THEN (SELECT body FROM gathering_posts WHERE id=r.target_id) ELSE (SELECT intro FROM literary_spaces WHERE id=r.target_id AND kind='gathering') END reported_text FROM gathering_reports r ORDER BY r.created_at DESC,r.id LIMIT 30 OFFSET ?`,
      args: [(page - 1) * 30],
    })
  ).rows;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl">
        <UiText text="雅集治理" />
      </h1>
      <p className="text-sm leading-loose text-ink-soft">
        <UiText text="仅供站长处理被反馈的内容，隐藏或恢复均留审计。集序结束不妨碍依站规处理内容。" />
      </p>
      {!reports.length && (
        <p>
          <UiText text="暂无待阅反馈。" />
        </p>
      )}
      {reports.map((r) => (
        <article key={String(r.id)} className="card space-y-4 p-6">
          <p className="whitespace-pre-wrap break-words leading-loose">
            {String(r.reported_text || "")}
          </p>
          <p className="text-sm text-ink-soft">{String(r.reason)}</p>
          <LiteraryForm
            gathering
            op={r.target_kind === "post" ? "moderate_post" : "moderate"}
            fields={{ id: String(r.target_id) }}
            label="处理此项"
          >
            <label className="flex gap-3">
              <UiInput name="restore" type="checkbox" />
              <UiText text="恢复展示（不勾选则隐藏）" />
            </label>
          </LiteraryForm>
        </article>
      ))}
      <nav className="flex gap-5 text-sm">
        {page > 1 && (
          <Link href={`?page=${page - 1}`}>
            <UiText text="上一页" />
          </Link>
        )}
        {reports.length === 30 && (
          <Link href={`?page=${page + 1}`}>
            <UiText text="下一页" />
          </Link>
        )}
        <Link href="/gatherings">
          <UiText text="回到雅集" />
        </Link>
      </nav>
    </div>
  );
}
