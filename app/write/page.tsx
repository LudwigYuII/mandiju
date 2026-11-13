import { UiText } from "@/components/UiText";

import { notFound, redirect } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { gateOnboard } from "@/lib/onboard";
import { availableStamps, sentLetterCount } from "@/lib/stamps";
import { getTopicById, monthKey } from "@/lib/topics";
import { getPenpals } from "@/lib/friends";
import WriteForm from "@/components/WriteForm";

import { readableLetter } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; reply?: string; to?: string }>;
}) {
  await waitDb();
  const sess = await gateOnboard();
  if (!sess) redirect("/login");

  const { topic: topicId, reply: replyId, to } = await searchParams;
  let topic: { id: string; title: string } | null = null;
  if (topicId) {
    const t = await getTopicById(topicId);
    if (t && String(t.month) === monthKey()) {
      topic = { id: String(t.id), title: String(t.title) };
    }
  }

  let reply: { id: string; title: string; authorPen: string } | null = null;
  if (replyId) {
    const row = await readableLetter(replyId, sess.uid);
    if (!row) notFound();
    const author = (
      await db.execute({
        sql: "SELECT pen_name FROM public_users WHERE id=?",
        args: [String(row.author_id)],
      })
    ).rows[0];
    reply = {
      id: String(row.id),
      title: String(row.title),
      authorPen: String(author?.pen_name ?? ""),
    };
  }

  const [me, penpals, stamps, drafts, sent] = await Promise.all([
    db.execute({ sql: "SELECT * FROM public_users WHERE id=?", args: [sess.uid] }),
    getPenpals(sess.uid),
    availableStamps(sess.uid),
    db.execute({
      sql: "SELECT d.*,COALESCE(p.pen_name,d.recipient) AS display_recipient FROM drafts d LEFT JOIN public_users p ON p.id=d.recipient_id WHERE d.user_id=? ORDER BY d.updated_at DESC LIMIT 20",
      args: [sess.uid],
    }),
    sentLetterCount(sess.uid),
  ]);
  const meRow = me.rows[0] as any;

  return (
    <div className="writing-room space-y-6">
      <h1 className="rise text-3xl font-semibold tracking-tight">
        <UiText text={"写信"} />
      </h1>
      <WriteForm
        pen={String(meRow.pen_name)}
        mySeal={String(meRow.seal_text || String(meRow.pen_name)[0] || "印")}
        penpals={penpals.map((p) => ({
          pen: p.pen,
          retreatUntil: p.retreatUntil,
          avatarId: p.avatarId,
          bgId: p.bgId,
          via: p.via,
        }))}
        stamps={stamps.map((s: any) => ({
          id: s.id,
          name: s.name,
          file: s.file,
          seasonal: s.seasonal ?? "",
        }))}
        coins={Number(meRow.coins ?? 0)}
        sent={sent}
        topic={topic}
        reply={reply}
        to={to ?? ""}
        drafts={drafts.rows.map((d: any) => ({
          id: String(d.id),
          genre: String(d.genre),
          title: String(d.title ?? ""),
          body: String(d.body ?? ""),
          postage: String(d.postage ?? ""),
          stampId: String(d.stamp_id ?? ""),
          recipient: String(d.display_recipient ?? ""),
          city: String(d.city ?? ""),
          weather: String(d.weather ?? ""),
          image: String(d.image ?? ""),
          capsuleDate: String(d.capsule_date ?? ""),
          topicId: String(d.topic_id ?? ""),
          replyTo: String(d.reply_to ?? ""),
          burnSeconds: String(d.burn_seconds ?? ""),
          sealColor: String(d.seal_color ?? ""),
          sealPattern: String(d.seal_pattern ?? ""),
          paper: String(d.paper ?? ""),
          vertical: String(d.vertical ?? ""),
          updatedAt: Number(d.updated_at),
          revision: Number(d.revision ?? 0),
        }))}
      />
    </div>
  );
}
