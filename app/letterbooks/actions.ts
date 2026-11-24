'use server';

import { redirect } from 'next/navigation';
import { db, waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { blockedBetween } from '@/lib/study-service';
import { revalidatePath } from 'next/cache';

export async function createBook(form: FormData) {
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const title=String(form.get('title')||'').trim();
  const peer=String(form.get('peer')||'');
  const ids=[...new Set(form.getAll('letter').map(String))];
  if (!title||title.length>80||!ids.length||ids.length>24||peer===me.uid) redirect('/letterbooks?invalid=1');
  const tx=await db.transaction('write');
  const id=crypto.randomUUID();
  try {
    if (await blockedBetween(tx,me.uid,peer)) throw Error('无法与此笔友编书');
    for (const letter of ids) {
      const {rows}=await tx.execute({
        sql:`SELECT 1 FROM letters WHERE id=? AND deliver_at<=? AND moderation_hidden=0 AND burned=0
          AND COALESCE(burn_seconds,0)=0 AND ((author_id=? AND recipient_id=?) OR (author_id=? AND recipient_id=?))`,
        args:[letter,Date.now(),me.uid,peer,peer,me.uid],
      });
      if (!rows.length) throw Error('所选信件不可收录');
    }
    await tx.execute({sql:'INSERT INTO letter_books(id,owner_id,peer_id,title,created_at) VALUES(?,?,?,?,?)',args:[id,me.uid,peer,title,Date.now()]});
    for (const letter of ids) await tx.execute({sql:'INSERT INTO letter_book_items VALUES(?,?)',args:[id,letter]});
    await tx.commit();
  } catch {
    await tx.rollback();
    redirect('/letterbooks?invalid=1');
  } finally { tx.close(); }
  redirect('/letterbooks/'+id);
}

export async function bookConsent(form: FormData) {
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const id=String(form.get('id')||'');
  const consent=form.get('consent')==='on'?1:0;
  await db.execute({
    sql:`UPDATE letter_books SET
      owner_ok=CASE WHEN owner_id=? THEN ? ELSE owner_ok END,
      peer_ok=CASE WHEN peer_id=? THEN ? ELSE peer_ok END
      WHERE id=? AND (owner_id=? OR peer_id=?)`,
    args:[me.uid,consent,me.uid,consent,id,me.uid,me.uid],
  });
  revalidatePath('/letterbooks/'+id);
}
