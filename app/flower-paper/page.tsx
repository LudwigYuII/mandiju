import { redirect } from 'next/navigation';
import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isFloralPaper, paperClass } from '@/components/paper';
import { UiText } from '@/components/UiText';
import Link from 'next/link';

async function savePaper(form:FormData) {
  'use server';
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const name=String(form.get('name')||'').trim();
  const style=['flower',form.get('color'),form.get('pattern'),form.get('edge')].join('-');
  if (!name||name.length>30||!isFloralPaper(style)) redirect('/flower-paper?invalid=1');
  await db.execute({sql:'INSERT INTO floral_papers VALUES(?,?,?) ON CONFLICT(owner_id,style) DO UPDATE SET name=excluded.name',args:[me.uid,style,name]});
  redirect('/flower-paper');
}

async function giftPaper(form:FormData) {
  'use server';
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const style=String(form.get('style')||'');
  const peer=String(form.get('peer')||'').trim();
  const result=await db.execute({
    sql:`INSERT OR IGNORE INTO floral_papers(owner_id,style,name)
      SELECT u.id,f.style,f.name FROM floral_papers f JOIN public_users u ON u.pen_name=?
      JOIN study_profiles p ON p.owner_id=u.id AND p.gifts_closed=0
      WHERE f.owner_id=? AND f.style=? AND u.id<>f.owner_id AND u.banned=0 AND u.retreat_until<=?
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=u.id AND b.blocked_id=f.owner_id) OR (b.blocker_id=f.owner_id AND b.blocked_id=u.id))
      AND EXISTS(SELECT 1 FROM letters l WHERE l.deliver_at<=? AND l.burned=0 AND l.moderation_hidden=0 AND COALESCE(l.burn_seconds,0)=0 AND
        ((l.author_id=u.id AND l.recipient_id=f.owner_id) OR (l.author_id=f.owner_id AND l.recipient_id=u.id)))`,
    args:[peer,me.uid,style,Date.now(),Date.now()],
  });
  redirect('/flower-paper?'+(result.rowsAffected?'gifted=1':'invalid=1'));
}

export default async function FlowerPaper({searchParams}:{searchParams:Promise<{gifted?:string;invalid?:string}>}) {
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const state=await searchParams;
  const {rows}=await db.execute({sql:'SELECT style,name FROM floral_papers WHERE owner_id=? ORDER BY name',args:[me.uid]});
  return <section className="mx-auto max-w-2xl space-y-6">
    <h1 className="text-3xl"><UiText text="花笺"/></h1>
    <form action={savePaper} className="card grid gap-4 p-6">
      <label><UiText text="笺名"/> <input name="name" className="input" maxLength={30} required/></label>
      <label><UiText text="纸色"/> <select name="color" className="input"><option value="cream">米白</option><option value="jade">竹青</option><option value="rose">浅绛</option></select></label>
      <label><UiText text="暗纹"/> <select name="pattern" className="input"><option value="clear">素面</option><option value="lines">淡水纹</option><option value="dots">细点</option></select></label>
      <label><UiText text="边饰"/> <select name="edge" className="input"><option value="frame">细框</option><option value="plain">留白</option></select></label>
      <button className="btn"><UiText text="收存花笺"/></button>
    </form>
    {state.gifted&&<p role="status"><UiText text="花笺已赠出。"/></p>}
    {state.invalid&&<p role="alert"><UiText text="未能保存或赠送，请核对资料和对方的赠答设置。"/></p>}
    {rows.map(row=><article key={String(row.style)} className={'letter-sheet p-5 '+paperClass(String(row.style))}>
      <h2 className="mb-4 text-lg">{String(row.name)}</h2>
      <form action={giftPaper} className="flex flex-wrap gap-3"><input type="hidden" name="style" value={String(row.style)}/>
        <label><UiText text="笔友雅号"/> <input name="peer" className="input" required maxLength={40}/></label>
        <button className="btn-ghost"><UiText text="赠一份花笺"/></button>
      </form>
    </article>)}
    <Link href="/write" className="underline"><UiText text="用花笺写信"/></Link>
  </section>;
}
