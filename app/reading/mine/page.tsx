import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db,waitDb } from '@/lib/db';
import { UiText } from '@/components/UiText';
import LiteraryForm from '@/components/LiteraryForm';
export const dynamic='force-dynamic';
export default async function Mine({searchParams}:{searchParams:Promise<{page?:string}>}){
  await waitDb();const s=await getSession();if(!s)redirect('/login');const n=Number((await searchParams).page),page=Number.isSafeInteger(n)&&n>0?Math.min(n,10000):1;
  const rows=(await db.execute({sql:'SELECT e.*,b.title FROM reading_entries e JOIN reading_days d ON d.day_key=e.day_key JOIN library_passages p ON p.id=d.passage_id JOIN library_books b ON b.id=p.book_id WHERE e.user_id=? ORDER BY e.day_key DESC LIMIT 20 OFFSET ?',args:[s.uid,(page-1)*20]})).rows;
  return <div className="mx-auto max-w-3xl space-y-8"><h1 className="text-3xl"><UiText text="我的抄写与札记"/></h1><p className="leading-loose text-ink-soft"><UiText text="这些原文只在你的个人记录中完整保存。分享仅限同日参与者的札记，不包括抄写。"/></p>
    {!rows.length&&<p><UiText text="尚无抄写与札记。"/></p>}
    {rows.map(e=><article key={String(e.id)} className="card space-y-4 p-6"><p className="text-sm text-ink-soft">{String(e.day_key)} · {String(e.title)}</p><h2 className="text-lg"><UiText text="我的抄写"/></h2><p className="whitespace-pre-wrap break-words leading-loose">{String(e.copy_body)}</p><h2 className="text-lg"><UiText text="我的札记"/></h2><p className="whitespace-pre-wrap break-words leading-loose">{String(e.note)}</p><p className="text-xs text-ink-soft"><UiText text={!Number(e.active)?'已退出此日共读':Number(e.shared)?'札记向同日参与者分享':'札记仅本人可见'}/></p><Link className="text-sm underline underline-offset-4" href={`/reading?day=${e.day_key}`}><UiText text="回看此日共读"/></Link>{Number(e.shared)>0&&<LiteraryForm reading op="unshare" fields={{id:String(e.id)}} label="撤回札记分享"/>}</article>)}
    <nav className="flex gap-5 text-sm">{page>1&&<Link href={`?page=${page-1}`}><UiText text="上一页"/></Link>}{rows.length===20&&<Link href={`?page=${page+1}`}><UiText text="下一页"/></Link>}<Link href="/reading"><UiText text="今日共读"/></Link></nav>
  </div>;
}
