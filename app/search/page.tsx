import { db, waitDb } from "@/lib/db";
import LetterCard, { type LetterRow } from "@/components/LetterCard";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await waitDb();
  const { q } = await searchParams;
  const kw = (q ?? "").trim().slice(0, 40);
  const esc = kw.replace(/[\\%_]/g, (m) => `\\${m}`);

  let results: { rows: any[] } = { rows: [] };
  if (kw) {
    results = await db.execute({
      sql: `
        SELECT l.*, u.pen_name, u.avatar_id, u.bg_id, u.seal_text,
          (SELECT COUNT(*) FROM likes k WHERE k.letter_id = l.id) AS likes,
          (SELECT COUNT(*) FROM replies r WHERE r.letter_id = l.id) AS replies
        FROM letters l JOIN users u ON u.id = l.author_id
        WHERE l.recipient_id IS NULL AND l.deliver_at <= ?
          AND (l.title LIKE ? ESCAPE '\\' OR l.body LIKE ? ESCAPE '\\' OR u.pen_name LIKE ? ESCAPE '\\')
        ORDER BY l.deliver_at DESC LIMIT 50`,
      args: [Date.now(), `%${esc}%`, `%${esc}%`, `%${esc}%`],
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">寻信</h1>
      <form action="/search" method="get" className="rise">
        <input name="q" className="input" placeholder="搜标题、正文、笔名…" maxLength={40} defaultValue={kw} />
      </form>

      {kw ? (
        <p className="px-1 text-xs text-ink-soft">「{kw}」找到 {results.rows.length} 封公开信</p>
      ) : (
        <p className="px-1 text-xs text-ink-soft">输入关键词，在公开信里找找看。</p>
      )}

      <section className="space-y-4">
        {results.rows.length === 0 && kw ? (
          <p className="py-10 text-center text-sm text-ink-soft">没有找到相关的信</p>
        ) : (
          results.rows.map((l: any, i: number) => (
            <Reveal key={l.id} delay={Math.min(i, 6) * 50}>
              <LetterCard l={l as LetterRow} />
            </Reveal>
          ))
        )}
      </section>
    </div>
  );
}
