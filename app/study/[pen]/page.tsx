import Link from "next/link";
import { notFound } from "next/navigation";
import { db, waitDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { friendshipBetween, canWriteTo } from "@/lib/friends";
import { blockedBetween, readStudyInner } from "@/lib/study-service";
import { canEnterStudy, GIFT_KINDS } from "@/lib/study-policy";
import { formatSiteTime } from "@/lib/time";
import { UiText, UiTextarea } from "@/components/UiText";
import StudyForm from "@/components/StudyForm";
import Seal from "@/components/Seal";
import FriendButton from "@/components/FriendButton";
import LetterCard, { type LetterRow } from "@/components/LetterCard";
export const dynamic = "force-dynamic";
export default async function StudyPage({
  params,
}: {
  params: Promise<{ pen: string }>;
}) {
  await waitDb();
  const { pen } = await params;
  const sess = await getSession();
  const u = (
    await db.execute({
      sql: "SELECT id,pen_name,seal_text,retreat_until,show_referrer FROM public_users WHERE pen_name=? AND banned=0",
      args: [decodeURIComponent(pen)],
    })
  ).rows[0];
  if (!u) notFound();
  const uid = String(u.id),
    isMe = sess?.uid === uid;
  const [profile, letters, visit, isBlocked, referrer] = await Promise.all([
    db.execute({
      sql: "SELECT name,public_intro,visits_closed,gifts_closed FROM study_profiles WHERE owner_id=?",
      args: [uid],
    }),
    db.execute({
      sql: `SELECT l.*,u.pen_name,u.avatar_id,u.bg_id,u.seal_text FROM letters l JOIN public_users u ON u.id=l.author_id WHERE l.author_id=? AND l.recipient_id IS NULL AND l.moderation_hidden=0 AND l.deliver_at<=? ORDER BY l.deliver_at DESC LIMIT 50`,
      args: [uid, Date.now()],
    }),
    sess && !isMe
      ? db.execute({
          sql: "SELECT status,retry_at FROM study_visits WHERE owner_id=? AND visitor_id=?",
          args: [uid, sess.uid],
        })
      : Promise.resolve({ rows: [] }),
    sess && !isMe ? blockedBetween(db, sess.uid, uid) : Promise.resolve(false),
    Number(u.show_referrer)
      ? db.execute({
          sql: "SELECT p.literary_name FROM invites i JOIN users p ON p.id=i.created_by WHERE i.used_by=? AND p.literary_name IS NOT NULL AND p.banned=0 AND p.show_referrer=1 LIMIT 1",
          args: [uid],
        })
      : Promise.resolve({ rows: [] }),
  ]);
  const p = profile.rows[0],
    v = visit.rows[0];
  const enter = canEnterStudy(
    uid,
    sess?.uid,
    v ? String(v.status) : undefined,
    isBlocked,
  );
  // Never fetch or serialize private text before authorization. Dynamic route is not shared-cached.
  const inner = enter ? await readStudyInner(db, uid, sess!.uid) : null;
  const rel =
    sess && !isMe && !isBlocked
      ? await friendshipBetween(sess.uid, uid)
      : "none";
  const writable =
    sess && !isMe && !isBlocked ? await canWriteTo(sess.uid, uid) : false;
  return (
    <div className="mx-auto max-w-3xl space-y-9">
      <header className="border-b border-[var(--paper-edge)] pb-7 space-y-4">
        <p className="text-xs tracking-widest text-ink-soft">
          <UiText text="门庭 · 书斋" />
        </p>
        <div className="flex items-start justify-between gap-5">
          <div className="space-y-2">
            <h1 className="text-3xl leading-relaxed break-words">
              {p?.name ? (
                String(p.name)
              ) : (
                <>
                  {String(u.pen_name)}
                  <UiText text="的书斋" />
                </>
              )}
            </h1>
            <p className="text-sm text-ink-soft">{String(u.pen_name)}</p>
          </div>
          <Seal char={String(u.seal_text)} size={54} />
        </div>
        {Number(u.retreat_until) > Date.now() && (
          <p className="text-sm text-ink-soft">
            <UiText text="闭关中，预计出关：" />
            {formatSiteTime(Number(u.retreat_until))}
          </p>
        )}
        {referrer.rows[0]?.literary_name && (
          <p className="text-sm text-ink-soft">
            <UiText text="引荐人：" />
            {String(referrer.rows[0].literary_name)}
          </p>
        )}
        <nav className="flex flex-wrap gap-5 text-sm">
          <a href="#courtyard">
            <UiText text="门庭" />
          </a>
          <a href="#inner">
            <UiText text="内斋" />
          </a>
          {isMe && (
            <Link href="/study/edit">
              <UiText text="布置书斋" />
            </Link>
          )}
          {sess && (
            <Link href="/visits">
              <UiText text="拜帖与赠答" />
            </Link>
          )}
          {writable && (
            <Link
              href={`/correspondence/${encodeURIComponent(String(u.pen_name))}`}
            >
              <UiText text="往来册" />
            </Link>
          )}
        </nav>
      </header>
      <section id="courtyard" className="space-y-5 scroll-mt-32">
        <h2 className="text-xl">
          <UiText text="门庭小序" />
        </h2>
        <p className="whitespace-pre-wrap break-words leading-loose">
          {p?.public_intro ? (
            String(p.public_intro)
          ) : (
            <UiText text="主人尚未题序，且在门前坐坐。" />
          )}
        </p>
        {sess && !isMe && !isBlocked && (
          <FriendButton targetId={uid} pen={String(u.pen_name)} rel={rel} />
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl">
          <UiText text="公开尺牍" />
        </h2>
        {letters.rows.length ? (
          letters.rows.map((l) => (
            <LetterCard key={String(l.id)} l={l as unknown as LetterRow} />
          ))
        ) : (
          <p className="text-ink-soft">
            <UiText text="案上尚无公开尺牍。" />
          </p>
        )}
      </section>
      <section id="inner" className="card space-y-5 p-6 sm:p-8 scroll-mt-32">
        <h2 className="text-xl">
          <UiText text="内斋" />
        </h2>
        {enter ? (
          <p className="whitespace-pre-wrap break-words leading-loose">
            {inner?.inner_note ? (
              String(inner.inner_note)
            ) : (
              <UiText text="内斋尚未落笔。" />
            )}
          </p>
        ) : (
          <>
            <p className="text-sm leading-loose text-ink-soft">
              <UiText text="内斋须主人接见后方可入内；门庭与公开尺牍仍可自由阅读。" />
            </p>
            {!sess ? (
              <Link href="/login" className="btn-ghost">
                <UiText text="登录后递帖" />
              </Link>
            ) : isBlocked ? (
              <p className="text-sm text-ink-soft">
                <UiText text="暂时无法往来" />
              </p>
            ) : Number(p?.visits_closed) ? (
              <p className="text-sm text-ink-soft">
                <UiText text="主人暂不收拜帖" />
              </p>
            ) : v &&
              (v.status === "pending" || Number(v.retry_at) > Date.now()) ? (
              <p className="text-sm text-ink-soft">
                <UiText
                  text={
                    v.status === "pending"
                      ? "拜帖已在门前，可择日再来。"
                      : "暂不宜重递，请留些时日。"
                  }
                />
              </p>
            ) : (
              <StudyForm op="visit" fields={{ target: uid }} label="递交拜帖">
                <label className="block space-y-2">
                  <span className="text-sm">
                    <UiText text="附一句话（最多一百字）" />
                  </span>
                  <UiTextarea
                    name="note"
                    required
                    rows={3}
                    className="input w-full"
                  />
                </label>
              </StudyForm>
            )}
          </>
        )}
      </section>
      {writable && !Number(p?.gifts_closed) && (
        <section className="card space-y-4 p-6">
          <h2 className="text-xl">
            <UiText text="赠一件小物" />
          </h2>
          <p className="text-sm text-ink-soft">
            <UiText text="仅双方可见，无需回赠；每日可向同一位书友赠一次。" />
          </p>
          <StudyForm
            op="gift"
            fields={{ target: uid, send_key: crypto.randomUUID() }}
            label="寄赠"
          >
            <label className="block space-y-2">
              <span>
                <UiText text="小物" />
              </span>
              <select name="kind" className="input w-full">
                {Object.entries(GIFT_KINDS).map(([key, name]) => (
                  <option key={key} value={key}>
                    <UiText text={name} />
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span>
                <UiText text="附言（可留空，最多一百字）" />
              </span>
              <UiTextarea name="note" rows={3} className="input w-full" />
            </label>
          </StudyForm>
        </section>
      )}
      {sess && !isMe && (
        <details className="border-t border-[var(--paper-edge)] pt-5 text-sm">
          <summary className="cursor-pointer text-ink-soft">
            <UiText text="往来边界" />
          </summary>
          <div className="space-y-4 pt-4">
            <p className="leading-loose text-ink-soft">
              <UiText text="屏蔽将暂停双方新的拜帖、赠答与寄信，并撤回内斋访问；尚在途的信暂存，旧信保留。" />
            </p>
            <StudyForm
              op="block"
              fields={{ target: uid }}
              label="屏蔽这位书友"
              caution
            />
            <Link href="/visits">
              <UiText text="管理屏蔽记录" />
            </Link>
          </div>
        </details>
      )}
    </div>
  );
}
