import { notFound } from 'next/navigation';
import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { UiText } from '@/components/UiText';
import PrintButton from '@/components/PrintButton';
import { bookConsent } from '../actions';

export default async function ReadBook({params}:{params:Promise<{id:string}>}) {
  await waitDb();
  const {id}=await params;
  const me=await getSession();
  // Check publication and visible letters in the same query snapshot.
  const {rows}=await db.execute({
    sql:`SELECT b.title AS book_title,b.owner_id,b.peer_id,b.owner_ok,b.peer_ok,
      l.id,l.title,l.body,u.pen_name
      FROM letter_books b
      JOIN users owner ON owner.id=b.owner_id AND owner.banned=0
      JOIN users peer ON peer.id=b.peer_id AND peer.banned=0
      LEFT JOIN letter_book_items item ON item.book_id=b.id
      LEFT JOIN letters l ON l.id=item.letter_id AND l.deliver_at<=? AND l.moderation_hidden=0
        AND l.burned=0 AND COALESCE(l.burn_seconds,0)=0
        AND ((l.author_id=b.owner_id AND l.recipient_id=b.peer_id) OR
             (l.author_id=b.peer_id AND l.recipient_id=b.owner_id))
      LEFT JOIN public_users u ON u.id=l.author_id
      WHERE b.id=? AND (b.owner_id=? OR b.peer_id=? OR (b.owner_ok=1 AND b.peer_ok=1))
      AND NOT EXISTS(SELECT 1 FROM user_blocks x WHERE
        (x.blocker_id=b.owner_id AND x.blocked_id=b.peer_id) OR
        (x.blocker_id=b.peer_id AND x.blocked_id=b.owner_id))
      ORDER BY l.deliver_at,l.id LIMIT 24`,
    args:[Date.now(),id,me?.uid||'',me?.uid||''],
  });
  const book=rows[0];
  if (!book) notFound();
  const participant=me&&(me.uid===book.owner_id||me.uid===book.peer_id);
  const approved=me?.uid===book.owner_id?book.owner_ok:book.peer_ok;
  const publicBook=Number(book.owner_ok)===1&&Number(book.peer_ok)===1;
  return <section className="mx-auto max-w-2xl space-y-8">
    <header className="border-b pb-6"><h1 className="text-3xl">{String(book.book_title)}</h1><p className="mt-3"><UiText text={publicBook?'双方已同意公开':'双方私密预览'}/></p></header>
    {participant&&<form action={bookConsent} className="space-y-3 print:hidden">
      <input type="hidden" name="id" value={id}/>
      {Number(approved)?<button className="btn-ghost"><UiText text="撤回我的公开授权"/></button>:<>
        <label className="flex gap-3"><input name="consent" type="checkbox" required/><UiText text="我已核对本册，同意公开所选信件的标题、正文和署名。"/></label>
        <button className="btn"><UiText text="确认公开授权"/></button>
      </>}
      <p className="text-sm text-ink-soft"><UiText text="撤回授权后，站内公开链接停止展示。已下载或复制的内容无法追回。"/></p>
    </form>}
    {publicBook&&<div className="print:hidden"><PrintButton/></div>}
    {rows.filter(row=>row.id).map(row=><article key={String(row.id)} className="card space-y-4 p-6">
      <h2 className="text-xl">{String(row.title)}</h2><p className="text-sm">{String(row.pen_name)}</p>
      <p className="whitespace-pre-wrap break-words leading-loose">{String(row.body)}</p>
    </article>)}
  </section>;
}
