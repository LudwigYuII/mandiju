import { redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { availableStamps } from "@/lib/stamps";
import { getTopicById, monthKey } from "@/lib/topics";
import WriteForm from "@/components/WriteForm";

export const dynamic = "force-dynamic";

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; reply?: string }>;
}) {
  await waitDb();
  const sess = await getSession();
  if (!sess) redirect("/login");

  const { topic: topicId, reply: replyId } = await searchParams;
  let topic: { id: string; title: string } | null = null;
  if (topicId) {
    const t = await getTopicById(topicId);
    if (t && String(t.month) === monthKey()) {
      topic = { id: String(t.id), title: String(t.title) };
    }
  }

  let reply: { id: string; title: string; authorPen: string } | null = null;
  if (replyId) {
    const r = await db.execute({
      sql: `SELECT l.id, l.title, u.pen_name FROM letters l JOIN users u ON u.id = l.author_id WHERE l.id = ?`,
      args: [replyId],
    });
    if (r.rows.length > 0) {
      const row = r.rows[0] as any;
      reply = { id: String(row.id), title: String(row.title), authorPen: String(row.pen_name) };
    }
  }

  const me = (
    await db.execute({ sql: "SELECT * FROM users WHERE id=?", args: [sess.uid] })
  ).rows[0] as any;
  const penpals = (
    await db.execute({
      sql: "SELECT pen_name, avatar_id, bg_id FROM users WHERE id != ? ORDER BY created_at ASC",
      args: [sess.uid],
    })
  ).rows.map((r: any) => ({
    pen: String(r.pen_name),
    avatarId: String(r.avatar_id),
    bgId: String(r.bg_id),
  }));
  const stamps = await availableStamps(sess.uid);
  const drafts = await db.execute({
    sql: "SELECT * FROM drafts WHERE user_id=? ORDER BY updated_at DESC LIMIT 20",
    args: [sess.uid],
  });

  return (
    <div className="space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">写信</h1>
      <WriteForm
        pen={String(me.pen_name)}
        penpals={penpals}
        stamps={stamps.map((s: any) => ({
          id: s.id,
          name: s.name,
          file: s.file,
          seasonal: s.seasonal ?? "",
        }))}
        coins={Number(me.coins ?? 0)}
        topic={topic}
        reply={reply}
        drafts={drafts.rows.map((d: any) => ({
          id: String(d.id),
          genre: String(d.genre),
          title: String(d.title ?? ""),
          body: String(d.body ?? ""),
          postage: String(d.postage ?? ""),
          stampId: String(d.stamp_id ?? ""),
          recipient: String(d.recipient ?? ""),
          city: String(d.city ?? ""),
          weather: String(d.weather ?? ""),
          image: String(d.image ?? ""),
          capsuleDate: String(d.capsule_date ?? ""),
          topicId: String(d.topic_id ?? ""),
          replyTo: String(d.reply_to ?? ""),
          updatedAt: Number(d.updated_at),
        }))}
      />
    </div>
  );
}
