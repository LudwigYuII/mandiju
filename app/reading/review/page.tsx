import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db,waitDb } from '@/lib/db';
import { UiText,UiInput } from '@/components/UiText';
import LiteraryForm from '@/components/LiteraryForm';
export const dynamic='force-dynamic';
export default async function Review({searchParams}:{searchParams:Promise<{page?:string}>}){
  await waitDb();const s=await getSession();if(!s)redirect('/login');const me=(await db.execute({sql:'SELECT role FROM users WHERE id=?',args:[s.uid]})).rows[0];if(me?.role!=='admin')redirect('/reading');
  const n=Number((await searchParams).page),page=Number.isSafeInteger(n)&&n>0?Math.min(n,10000):1;
  const reports=(await db.execute({sql:'SELECT r.id,r.entry_id,r.reason,r.note_snapshot AS note,e.day_key,u.pen_name FROM reading_reports r JOIN reading_entries e ON e.id=r.entry_id JOIN public_users u ON u.id=r.reporter_id ORDER BY r.created_at DESC,r.id LIMIT 30 OFFSET ?',args:[(page-1)*30]})).rows;
  return <div className="mx-auto max-w-3xl space-y-6"><h1 className="text-3xl"><UiText text="共读治理"/></h1><p className="text-sm text-ink-soft"><UiText text="仅呈现已反馈的札记，不读取作者的私人抄写；隐藏与恢复写入审计。"/></p>{!reports.length&&<p><UiText text="暂无待阅反馈。"/></p>}{reports.map(r=><article key={String(r.id)} className="card space-y-4 p-6"><p className="text-sm text-ink-soft">{String(r.day_key)} · {String(r.pen_name)}</p><p className="whitespace-pre-wrap break-words leading-loose">{String(r.note)}</p><p className="text-sm text-ink-soft">{String(r.reason)}</p><LiteraryForm reading op="moderate" fields={{id:String(r.entry_id)}} label="处理此项"><label className="flex gap-3"><UiInput name="restore" type="checkbox"/><UiText text="恢复展示（不勾选则隐藏）"/></label></LiteraryForm></article>)}<nav className="flex gap-5 text-sm">{page>1&&<Link href={`?page=${page-1}`}><UiText text="上一页"/></Link>}{reports.length===30&&<Link href={`?page=${page+1}`}><UiText text="下一页"/></Link>}</nav></div>;
}
