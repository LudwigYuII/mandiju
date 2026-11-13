import Link from "next/link";
import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { gateOnboard } from "@/lib/onboard";
import { statusOf, fmtTime } from "@/lib/delivery";
import { expireBurnLetters } from "@/lib/burn-db";
import Seal from "@/components/Seal";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  await waitDb();
  const sess = await gateOnboard();
  if (!sess) redirect("/login");

  await expireBurnLetters(); // 倒计时到期的焚毁信兜底抹除

  const rows = await db.execute({
    sql: `
      SELECT l.*,
        CASE WHEN l.author_id = ? THEN ur.pen_name ELSE ua.pen_name END AS peer_pen,
        CASE WHEN l.author_id = ? THEN ur.seal_text ELSE ua.seal_text END AS peer_seal,
        CASE WHEN l.author_id = ? THEN 'to' ELSE 'from' END AS direction
      FROM letters l
      JOIN users ua ON ua.id = l.author_id
      JOIN users ur ON ur.id = l.recipient_id
      WHERE l.recipient_id IS NOT NULL AND (l.author_id = ? OR (l.recipient_id = ? AND l.deliver_at <= ?))
      ORDER BY l.deliver_at DESC LIMIT 100`,
    args: [sess.uid, sess.uid, sess.uid, sess.uid, sess.uid, Date.now()],
  });

  const capsules = rows.rows.filter((l: any) => String(l.author_id) === String(l.recipient_id));
  const mails = rows.rows.filter((l: any) => String(l.author_id) !== String(l.recipient_id));

  const renderItem = (l: any, i: number, capsule: boolean) => {
    const delivered = statusOf(Number(l.deliver_at)) === "delivered";
    const isBurn = Number(l.burn_seconds ?? 0) > 0;
    const burned = Number(l.burned) === 1;
    const stateLabel = capsule
      ? delivered
        ? "已解锁"
        : "沉睡中"
      : burned
        ? "已焚毁"
        : isBurn
          ? !delivered
            ? "运输中…"
            : l.direction === "to"
              ? l.burned_at
                ? "对方已拆封 · 焚毁中"
                : "已送达 · 未拆封"
              : "未拆封 · 阅后即焚"
          : !delivered
            ? "运输中…"
            : l.direction === "to"
              ? l.read_at
                ? "对方已读"
                : "已送达 · 未读"
              : l.read_at
                ? "已读"
                : "未读";
    const hot = !delivered || stateLabel.includes("未读") || stateLabel.includes("焚");
    const corrUrl = capsule
      ? null
      : `/correspondence/${encodeURIComponent(String(l.peer_pen))}`;
    return (
      <Reveal key={l.id} delay={Math.min(i, 6) * 60}>
        <div
          className={`card glass flex items-center justify-between gap-3 p-4 transition-all duration-300 hover:-translate-y-0.5 ${
            delivered && !burned ? "" : "border-dashed opacity-70"
          }`}
        >
          <Link href={`/letter/${l.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Seal char={String(l.peer_seal || l.peer_pen[0])} size={36} tone={capsule ? "vermilion" : "blue"} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>{String(l.peer_pen)}</span>
                <span className="text-xs font-normal text-ink-soft">
                  {capsule ? "寄给未来的自己" : l.direction === "to" ? "我寄出的" : "寄给我的"}
                </span>
              </div>
              <div className="truncate text-xs text-ink-soft">
                {isBurn && !burned && "🔥 "}
                {String(l.title)}
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="text-right text-xs text-ink-soft">
              <div className={hot ? "font-semibold text-vermilion" : ""}>{stateLabel}</div>
              <div>{fmtTime(Number(l.deliver_at))}</div>
            </div>
            {corrUrl && (
              <Link
                href={corrUrl}
                className="whitespace-nowrap rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-ink-soft transition hover:border-vermilion/50 hover:text-vermilion dark:border-white/15"
              >
                往来册 →
              </Link>
            )}
          </div>
        </div>
      </Reveal>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="rise px-1 text-3xl font-semibold tracking-tight">往来信笺</h1>

      {capsules.length > 0 && (
        <Reveal>
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold tracking-[0.18em] text-ink-soft">
              ⏳ 时光胶囊（{capsules.length}）
            </h2>
            {capsules.map((l: any, i: number) => renderItem(l, i, true))}
          </section>
        </Reveal>
      )}

      {mails.length === 0 && capsules.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">
          还没有私人信件。写信时把收件人选成某位笔友，这里就会出现你们的往来。
        </p>
      ) : (
        mails.map((l: any, i: number) => renderItem(l, i, false))
      )}
    </div>
  );
}

