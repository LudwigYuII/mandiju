import { redirect } from 'next/navigation';
import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { UiText } from '@/components/UiText';
import { siteDateKey } from '@/lib/time';
import Link from 'next/link';

async function wander() {
  'use server';
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const now=Date.now();
  const {rows}=await db.execute({
    sql:`INSERT OR IGNORE INTO snow_leaves(visitor_id,owner_id,day,available_at)
      SELECT ?,u.id,?,? FROM public_users u JOIN study_profiles p ON p.owner_id=u.id
      WHERE u.id<>? AND u.banned=0 AND u.retreat_until<=? AND p.snow_open=1 AND p.visits_closed=0
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=u.id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=u.id))
      AND EXISTS(SELECT 1 FROM letters l WHERE l.deliver_at<=? AND l.moderation_hidden=0 AND l.burned=0
        AND COALESCE(l.burn_seconds,0)=0 AND ((l.author_id=u.id AND l.recipient_id=?) OR (l.author_id=? AND l.recipient_id=u.id)))
      ORDER BY random() LIMIT 1 RETURNING (SELECT pen_name FROM public_users WHERE id=owner_id) AS pen_name`,
    args:[me.uid,siteDateKey(new Date(now)),now+3600000,me.uid,now,me.uid,me.uid,now,me.uid,me.uid],
  });
  if (!rows[0]) redirect('/snow?empty=1');
  redirect('/study/'+encodeURIComponent(String(rows[0].pen_name))+'?snow=1');
}

async function preference(form:FormData) {
  'use server';
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  await db.execute({
    sql:`INSERT INTO study_profiles(owner_id,updated_at,snow_open) VALUES(?,?,?)
      ON CONFLICT(owner_id) DO UPDATE SET snow_open=excluded.snow_open`,
    args:[me.uid,Date.now(),form.get('allow')==='on'?1:0],
  });
  redirect('/snow?saved=1');
}

export default async function Snow({searchParams}:{searchParams:Promise<{empty?:string;saved?:string}>}) {
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const q=await searchParams;
  const {rows}=await db.execute({sql:'SELECT snow_open FROM study_profiles WHERE owner_id=?',args:[me.uid]});
  const leaves=(await db.execute({
    sql:`SELECT u.id,u.pen_name FROM snow_leaves leaf JOIN public_users u ON u.id=leaf.visitor_id
      WHERE leaf.owner_id=? AND leaf.available_at<=? AND u.banned=0
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=u.id AND b.blocked_id=leaf.owner_id) OR (b.blocker_id=leaf.owner_id AND b.blocked_id=u.id))
      ORDER BY leaf.available_at DESC LIMIT 12`,args:[me.uid,Date.now()],
  })).rows;
  return <section className="mx-auto max-w-xl space-y-7">
    <h1 className="text-3xl"><UiText text="雪夜访戴"/></h1>
    <p><UiText text="从有过书信往来且愿意接待的笔友中，随缘访一位。来访只到书斋门庭。"/></p>
    <form action={wander}><button className="btn"><UiText text="乘兴一访"/></button></form>
    {q.empty&&<p role="status"><UiText text="今日已到访，或此刻没有可访的笔友。"/></p>}
    <form action={preference} className="space-y-4 border-t pt-6">
      <label className="flex gap-3"><input name="allow" type="checkbox" defaultChecked={Number(rows[0]?.snow_open)===1}/><UiText text="允许有过书信往来的笔友随缘到访"/></label>
      <button className="btn-ghost"><UiText text="保存来访设置"/></button>
      {q.saved&&<p role="status"><UiText text="已保存。"/></p>}
    </form>
    {leaves.length>0&&<section className="space-y-3">
      <h2 className="text-xl"><UiText text="门庭落叶"/></h2>
      {leaves.map((leaf,index)=><p key={String(leaf.id)+index}>🍂 {String(leaf.pen_name)}<UiText text="曾至"/></p>)}
    </section>}
    <Link href="/visits" className="underline"><UiText text="拜帖与赠答"/></Link>
  </section>;
}
