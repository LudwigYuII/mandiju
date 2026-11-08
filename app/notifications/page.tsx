import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtTime } from "@/lib/delivery";
import { markNotificationAction, markAllNotificationsAction } from "@/lib/actions";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

const ICONS: Record<string, string> = {
  letter_in: "📬",
  reply: "💬",
  like: "❤️",
  stamp: "🎫",
};

export default async function NotificationsPage() {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");

  const rows = await db.execute({
    sql: "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
    args: [sess.uid],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="rise text-3xl font-semibold tracking-tight">通知</h1>
        {rows.rows.some((r: any) => !Number(r.read)) && (
          <form action={markAllNotificationsAction}>
            <button className="btn-ghost !text-sm">全部已读</button>
          </form>
        )}
      </div>

      {rows.rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">还没有通知。去写信、回信，通知会自己长出来。</p>
      ) : (
        <div className="space-y-2">
          {rows.rows.map((n: any, i: number) => {
            const unread = !Number(n.read);
            return (
              <Reveal key={n.id} delay={Math.min(i, 8) * 40}>
                <form action={markNotificationAction}>
                  <input type="hidden" name="id" value={String(n.id)} />
                  <input type="hidden" name="link" value={String(n.link ?? "/notifications")} />
                  <button
                    className={`card glass flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 ${
                      unread ? "!border-vermilion/40" : "opacity-60"
                    }`}
                  >
                    <span className="text-xl">{ICONS[String(n.type)] ?? "🔔"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{String(n.body)}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{fmtTime(Number(n.created_at))}</span>
                    </span>
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-vermilion" />}
                  </button>
                </form>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
