import Link from 'next/link';
import { db,waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { listTravel } from '@/lib/travel-service';
import { TRAVEL_REGIONS } from '@/lib/travel-policy';
import { UiText,UiInput } from '@/components/UiText';
import TravelRegionSelect from '@/components/TravelRegionSelect';
import WorldTravelMap from '@/components/WorldTravelMap';
export const dynamic='force-dynamic';
export default async function Travel({searchParams}:{searchParams:Promise<{region?:string;q?:string;page?:string}>}){
 await waitDb();const s=await getSession(),uid=s?.uid||'',q=await searchParams;
 const region=q.region&&q.region in TRAVEL_REGIONS?q.region:'',query=(q.q||'').slice(0,80),n=Number(q.page),page=Number.isSafeInteger(n)&&n>0?Math.min(n,10000):1;
 const [entries,pins,me]=await Promise.all([listTravel(db,uid,{region,query,offset:(page-1)*20}),listTravel(db,uid,{region,query,pins:true}),uid?db.execute({sql:'SELECT role FROM users WHERE id=?',args:[uid]}):Promise.resolve({rows:[]})]);
 const href=(p:number)=>`?${new URLSearchParams({region,q:query,page:String(p)})}`;
 return <div className="mx-auto max-w-5xl space-y-8"><header className="space-y-4"><p className="text-sm tracking-widest text-ink-soft"><UiText text="一地一记，纸上远游"/></p><h1 className="text-3xl"><UiText text="云游地图"/></h1><p className="max-w-3xl leading-loose text-ink-soft"><UiText text="在世界的一处留一篇游记。墨点只代表作者主动公开的行旅文字，不表示此刻所在，也不计较去过多少地方。"/></p><nav className="flex flex-wrap gap-4"><Link className="btn" href={s?'/travel/new':'/login'}><UiText text="写一篇游记"/></Link>{s&&<Link className="btn-ghost" href="/travel/mine"><UiText text="我的游记"/></Link>}</nav></header>
 <form className="flex flex-wrap items-end gap-4"><label className="space-y-2"><span className="block text-sm"><UiText text="按地区浏览"/></span><TravelRegionSelect value={region}/></label><label className="flex-1 space-y-2"><span className="block text-sm"><UiText text="检索篇名或地名"/></span><UiInput name="q" maxLength={80} defaultValue={query} className="input w-full"/></label><button className="btn-ghost"><UiText text="展读"/></button></form>
 <WorldTravelMap pins={pins.map(p=>({id:String(p.id),title:String(p.title),longitude:Number(p.longitude),latitude:Number(p.latitude)}))}/>
 <p className="text-xs leading-loose text-ink-soft"><UiText text="墨点呈现当前筛选下最近的至多三百篇公开游记，大小相同；更多文字可继续翻页。底图为简化陆地轮廓，不用于导航或定位。"/></p>
 <section className="grid gap-5 sm:grid-cols-2" aria-label="游记文字列表">{!entries.length&&<p className="py-6 text-ink-soft"><UiText text="此处尚无公开游记，远游也可以从记忆开始。"/></p>}{entries.map(e=><article key={String(e.id)} className="card space-y-3 p-6"><p className="text-xs text-ink-soft">{String(e.place_name)} · <UiText text={TRAVEL_REGIONS[String(e.region)]||'海域与其他'}/></p><h2 className="text-xl"><Link href={`/travel/${e.id}`}>{String(e.title)}</Link></h2><p className="text-sm text-ink-soft">{String(e.pen_name)}</p></article>)}</section>
 <nav className="flex flex-wrap gap-5 text-sm">{page>1&&<Link href={href(page-1)}><UiText text="上一页"/></Link>}{entries.length===20&&<Link href={href(page+1)}><UiText text="下一页"/></Link>}{me.rows[0]?.role==='admin'&&<Link href="/travel/review"><UiText text="游记治理"/></Link>}<Link href="/map"><UiText text="私人往来地名"/></Link></nav>
 </div>;
}
