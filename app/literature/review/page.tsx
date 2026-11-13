import { redirect } from "next/navigation";
import Link from "next/link";
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
  const n = Number((await searchParams).page),
    page = Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
  await waitDb();
  const s = await getSession();
  if (!s) redirect("/login");
  const role = (
    await db.execute({
      sql: "SELECT role FROM users WHERE id=?",
      args: [s.uid],
    })
  ).rows[0];
  if (role?.role !== "admin") redirect("/literature");
  const reports = (
    await db.execute({
      sql: `SELECT r.*,u.pen_name,CASE WHEN r.target_kind='entry' THEN (SELECT title FROM literary_entries WHERE id=r.target_id) ELSE (SELECT title FROM literary_spaces WHERE id=r.target_id) END AS title,CASE WHEN r.target_kind='entry' THEN (SELECT body FROM literary_entries WHERE id=r.target_id) ELSE (SELECT intro FROM literary_spaces WHERE id=r.target_id) END AS reported_text FROM literary_reports r JOIN public_users u ON u.id=r.reporter_id ORDER BY r.created_at DESC,r.id LIMIT 30 OFFSET ?`,
      args: [(page - 1) * 30],
    })
  ).rows;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl">
        <UiText text="作品治理" />
      </h1>
      <p className="text-sm leading-loose text-ink-soft">
        <UiText text="此处仅供站长处理已反馈内容，隐藏与恢复会记录审计；不会改写作者原文。" />
      </p>
      {!reports.length && (
        <p>
          <UiText text="暂无待阅反馈。" />
        </p>
      )}
      {reports.map((r) => (
        <article key={String(r.id)} className="card space-y-4 p-6">
          <h2 className="text-xl">{String(r.title || "")}</h2>
          <p className="whitespace-pre-wrap break-words leading-loose">
            {String(r.reported_text || "")}
          </p>
          <p className="text-sm text-ink-soft">
            {String(r.pen_name)}：{String(r.reason)}
          </p>
          <LiteraryForm
            op="moderate"
            fields={{ kind: String(r.target_kind), id: String(r.target_id) }}
            label="处理此项"
          >
            <label className="flex gap-3">
              <UiInput type="checkbox" name="restore" />
              <UiText text="恢复展示（不勾选则隐藏）" />
            </label>
          </LiteraryForm>
        </article>
      ))}
      <nav className="flex gap-5 text-sm">
        {page > 1 && (
          <Link href={`/literature/review?page=${page - 1}`}>
            <UiText text="上一页" />
          </Link>
        )}
        {reports.length === 30 && (
          <Link href={`/literature/review?page=${page + 1}`}>
            <UiText text="下一页" />
          </Link>
        )}
      </nav>
    </div>
  );
}
