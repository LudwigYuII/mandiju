import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db,waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { readTravel } from '@/lib/travel-service';
import { TRAVEL_REGIONS } from '@/lib/travel-policy';
import { UiText,UiTextarea } from '@/components/UiText';
import LiteraryForm from '@/components/LiteraryForm';
import AnnotatedText from '@/components/AnnotatedText';
import WorldTravelMap from '@/components/WorldTravelMap';
import Seal from '@/components/Seal';
export const dynamic='force-dynamic';
export default async function TravelEntry({params}:{params:Promise<{id:string}>}){
 await waitDb();const {id}=await params,s=await getSession(),e=await readTravel(db,id,s?.uid||'');if(!e)notFound();const owner=e.author_id===s?.uid;
 return <div className="mx-auto max-w-3xl space-y-8"><header className="space-y-4"><p className="text-sm text-ink-soft"><UiText text={e.visibility==='public'?'公开游记':'私人游记'}/> · {String(e.pen_name)}</p><h1 className="break-words text-3xl leading-relaxed">{String(e.title)}</h1><p className="text-sm text-ink-soft">{String(e.place_name)} · <UiText text={TRAVEL_REGIONS[String(e.region)]||'海域与其他'}/></p>{e.location_kind==='catalog'?<p className="text-xs text-ink-soft"><UiText text="资料库参考地名："/>{String(e.canonical_name)} · {String(e.country_label)}</p>:<p className="text-xs text-ink-soft"><UiText text="作者手动选点、自题地名，未经资料库核对。"/></p>}{Number(e.hidden)>0&&<p className="text-sm text-ink-soft"><UiText text="此篇已被站务隐藏，目前仅作者可读。"/></p>}</header>
 <article className="card space-y-6 p-6 sm:p-10"><div className="leading-loose"><AnnotatedText text={String(e.body)}/></div><div className="flex justify-end"><Seal char={String(e.seal_text)} size={36}/></div></article>
 <WorldTravelMap selected={{longitude:Number(e.longitude),latitude:Number(e.latitude)}}/>
 {owner&&<section className="space-y-4"><Link className="btn-ghost" href={`/travel/${id}/edit`}><UiText text="修订游记"/></Link>{e.visibility==='public'&&<LiteraryForm travel op="private" fields={{id}} label="收回公开，改为仅本人可见"/>}</section>}
 {!owner&&s&&<details className="text-sm"><summary className="cursor-pointer"><UiText text="反馈此篇游记"/></summary><div className="mt-4"><LiteraryForm travel op="report" fields={{id}} label="提交反馈"><label className="block space-y-2"><span><UiText text="向站长说明问题（最多五百字）"/></span><UiTextarea name="reason" required maxLength={500} rows={3} className="input w-full"/></label></LiteraryForm></div></details>}
 <nav className="flex gap-5 text-sm"><Link href="/travel"><UiText text="回到云游地图"/></Link>{owner&&<Link href="/travel/mine"><UiText text="我的游记"/></Link>}</nav></div>;
}
