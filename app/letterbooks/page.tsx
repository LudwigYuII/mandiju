import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { UiText } from '@/components/UiText';
import { createBook } from './actions';

export default async function LetterBooks({searchParams}:{searchParams:Promise<{peer?:string;invalid?:string}>}) {
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const q=await searchParams;
  const books=(await db.execute({sql:'SELECT id,title FROM letter_books WHERE owner_id=? OR peer_id=? ORDER BY created_at DESC LIMIT 50',args:[me.uid,me.uid]})).rows;
  const peers=(await db.execute({
    sql:`SELECT DISTINCT u.id,u.pen_name FROM letters l JOIN public_users u
      ON u.id=CASE WHEN l.author_id=? THEN l.recipient_id ELSE l.author_id END
      WHERE (l.author_id=? OR l.recipient_id=?) AND u.id<>? AND u.banned=0 AND l.deliver_at<=?
      AND l.moderation_hidden=0 AND l.burned=0 AND COALESCE(l.burn_seconds,0)=0
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id=u.id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=u.id))
      ORDER BY u.pen_name LIMIT 100`,
    args:[me.uid,me.uid,me.uid,me.uid,Date.now(),me.uid,me.uid],
  })).rows;
  const peer=peers.find(row=>row.id===q.peer);
  const letters=peer?(await db.execute({
    sql:`SELECT id,title FROM letters WHERE deliver_at<=? AND moderation_hidden=0 AND burned=0
      AND COALESCE(burn_seconds,0)=0 AND ((author_id=? AND recipient_id=?) OR (author_id=? AND recipient_id=?))
      ORDER BY deliver_at DESC LIMIT 100`,
    args:[Date.now(),me.uid,String(peer.id),String(peer.id),me.uid],
  })).rows:[];
  return <section className="mx-auto max-w-2xl space-y-6">
    <h1 className="text-3xl"><UiText text="尺牍集"/></h1>
    <ul>{books.map(book=><li key={String(book.id)}><Link href={'/letterbooks/'+book.id} className="underline">{String(book.title)}</Link></li>)}</ul>
    {q.invalid&&<p role="alert"><UiText text="请选择一至二十四封可收录的信，并填写书名。"/></p>}
    <form className="flex gap-3"><label><UiText text="选择笔友"/> <select className="input" name="peer" defaultValue={q.peer} required><option value="">—</option>{peers.map(p=><option key={String(p.id)} value={String(p.id)}>{String(p.pen_name)}</option>)}</select></label><button className="btn-ghost"><UiText text="选信"/></button></form>
    {peer&&<form action={createBook} className="space-y-4">
      <input type="hidden" name="peer" value={String(peer.id)}/>
      <label className="block"><UiText text="书名"/> <input name="title" className="input" maxLength={80} required/></label>
      {letters.map(l=><label className="block" key={String(l.id)}><input type="checkbox" name="letter" value={String(l.id)}/> {String(l.title)}</label>)}
      <button className="btn"><UiText text="建立私密预览"/></button>
    </form>}
  </section>;
}
