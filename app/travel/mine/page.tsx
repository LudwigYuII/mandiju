import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db,waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { listTravel } from '@/lib/travel-service';
import { UiText } from '@/components/UiText';
export const dynamic='force-dynamic';
export default async function Mine({searchParams}:{searchParams:Promise<{page?:string}>}){
 await waitDb();const s=await getSession();if(!s)redirect('/login');const n=Number((await searchParams).page),page=Number.isSafeInteger(n)&&n>0?Math.min(n,10000):1,rows=await listTravel(db,s.uid,{own:true,offset:(page-1)*20});
 return <div className="mx-auto max-w-3xl space-y-8"><h1 className="text-3xl"><UiText text="我的游记"/></h1><p className="text-ink-soft"><UiText text="私人游记只在这里与本人阅读页出现，不进入公共地图。"/></p>{!rows.length&&<p><UiText text="尚无游记，记忆里的地方也可写下。"/></p>}{rows.map(e=><article key={String(e.id)} className="card space-y-3 p-6"><p className="text-xs text-ink-soft">{String(e.place_name)} · <UiText text={e.visibility==='public'?'已公开':'仅本人可见'}/>{Number(e.hidden)>0&&<> · <UiText text="站务隐藏"/></>}</p><h2 className="text-xl"><Link href={`/travel/${e.id}`}>{String(e.title)}</Link></h2><Link className="text-sm underline underline-offset-4" href={`/travel/${e.id}/edit`}><UiText text="修订游记"/></Link></article>)}<nav className="flex gap-5 text-sm">{page>1&&<Link href={`?page=${page-1}`}><UiText text="上一页"/></Link>}{rows.length===20&&<Link href={`?page=${page+1}`}><UiText text="下一页"/></Link>}<Link href="/travel/new"><UiText text="写一篇游记"/></Link><Link href="/travel"><UiText text="回到云游地图"/></Link></nav></div>;
}
