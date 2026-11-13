import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { genreLabel, fmtTime } from "@/lib/delivery";
import Reveal from "@/components/Reveal";
import ShareSummary from "@/components/ShareSummary";

export const dynamic = "force-dynamic";

export default async function YearPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");

  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const year = now.getFullYear();

  const letters = await db.execute({
    sql: `SELECT * FROM letters WHERE author_id = ? AND sent_at >= ? AND sent_at < ?`,
    args: [sess.uid, start, end],
  });
  const rows = letters.rows as any[];
  const totalChars = rows.reduce((s, l) => s + Number(String(l.body).length), 0);

  const stamps = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM user_stamps WHERE user_id = ? AND acquired_at >= ? AND acquired_at < ?`,
    args: [sess.uid, start, end],
  });

  const cities = new Set(rows.map((l) => String(l.city)).filter(Boolean));

  const genreCount: Record<string, number> = {};
  for (const l of rows) {
    const g = String(l.genre);
    genreCount[g] = (genreCount[g] ?? 0) + 1;
  }
  const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];

  const received = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM letters WHERE recipient_id = ? AND sent_at >= ? AND sent_at < ? AND deliver_at <= ?`,
    args: [sess.uid, start, end, Date.now()],
  });

  const first = rows.length
    ? rows.reduce((min, l) => Math.min(min, Number(l.sent_at)), Infinity)
    : null;

  const summary = `${year} 年，你在慢递局寄出了 ${rows.length} 封信（收到 ${(received.rows[0] as any)?.n ?? 0} 封），写下约 ${totalChars} 字，解锁 ${(stamps.rows[0] as any)?.n ?? 0} 枚邮票，信从 ${cities.size} 座城市出发${
    topGenre ? `，写得最多的是${genreLabel(topGenre[0])}` : ""
  }。`;

  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">{year} 年度信笺</h1>

      <Reveal>
        <section className="card glass p-6 text-center">
          <p className="text-xs tracking-[0.3em] text-ink-soft">慢递局 · 年度回顾</p>
          <p className="mt-5 text-6xl font-semibold tracking-tight text-vermilion">{rows.length}</p>
          <p className="mt-1 text-sm text-ink-soft">封信，从你的笔尖出发</p>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-ink-soft">{summary}</p>
          {first && (
            <p className="mt-4 text-xs text-ink-soft">
              {year} 年的第一封信寄出于 {fmtTime(first)}
            </p>
          )}
          <div className="mt-6">
            <ShareSummary text={summary} />
          </div>
        </section>
      </Reveal>

      <Reveal delay={70}>
        <section className="grid grid-cols-2 gap-3">
          {[
            { label: "写下字数", value: `${totalChars.toLocaleString()} 字` },
            { label: "解锁邮票", value: `${(stamps.rows[0] as any)?.n ?? 0} 枚` },
            { label: "出发城市", value: `${cities.size} 座` },
            { label: "收到来信", value: `${(received.rows[0] as any)?.n ?? 0} 封` },
          ].map((s) => (
            <div key={s.label} className="card glass p-4 text-center">
              <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
              <div className="mt-1 text-xs text-ink-soft">{s.label}</div>
            </div>
          ))}
        </section>
      </Reveal>

      <Reveal delay={120}>
        <p className="text-center text-xs text-ink-soft">
          <Link href="/print?scope=mine" className="text-vermilion">
            把这一年的信印成一册 →
          </Link>
        </p>
      </Reveal>
    </div>
  );
}

