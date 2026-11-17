import Link from 'next/link';
import { db,waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ensureSeasonalGatherings,seasonalTheme } from '@/lib/seasonal-service';
import { readGathering } from '@/lib/gathering-service';
import { upcomingFirstDays } from '@/lib/calendar';
import { SITE_TIME_ZONE,siteDateKey } from '@/lib/time';
import config from '@/data/seasons.json';
import { UiText } from '@/components/UiText';
import SeasonalHeader from '@/components/SeasonalHeader';
export const dynamic='force-dynamic';
export default async function Seasons(){
  await waitDb();const s=await getSession(),ids=await ensureSeasonalGatherings(db),season=seasonalTheme();
  const rooms=(await Promise.all(ids.map(id=>readGathering(db,id,s?.uid||'')))).filter(Boolean);
  const coming=upcomingFirstDays(45);
  return <div className="mx-auto max-w-3xl space-y-8"><header className="space-y-4"><p className="text-sm tracking-widest text-ink-soft"><UiText text="时序有常，来去从容"/></p><h1 className="text-3xl"><UiText text="节气与岁时"/></h1><p className="text-sm text-ink-soft">{siteDateKey()} · {SITE_TIME_ZONE}</p></header>
    <SeasonalHeader/>
    <section className="space-y-4"><h2 className="text-xl"><UiText text="今日岁时"/></h2>
      {season.events.length?season.events.map(e=><p key={e.kind+e.name}><UiText text={e.name}/> · <span className="text-sm text-ink-soft"><UiText text={e.kind==='term'?'二十四节气':'节日'}/></span></p>):<p className="text-ink-soft"><UiText text="今日无节令，寻常日也宜读书。"/></p>}
      <p className="text-sm leading-loose text-ink-soft"><UiText text="清明与冬至属于节气，中秋与元宵依农历推算；闰月不重复普通农历节日。岁时以本站公共时区为准，不对应你的实际天气或所在地。"/></p>
    </section>
    <section className="space-y-4 border-t border-[var(--paper-edge)] pt-6"><h2 className="text-xl"><UiText text="应节雅集"/></h2>
      <p className="leading-loose text-ink-soft"><UiText text="在题定的节令，站务自动设一席公开雅集，十二席；自愿入席，不催促回应。散席后仍按每篇授权留序。"/></p>
      {rooms.map(r=><Link key={String(r!.id)} className="desk-link block" href={`/gatherings/${r!.id}`}><h3>{String(r!.title)}</h3><p><UiText text="赴这一席"/></p></Link>)}
      {!rooms.length&&<p className="text-sm text-ink-soft"><UiText text="今日未设应节席，也可自行发起雅集。"/></p>}
      <details className="text-sm"><summary className="cursor-pointer"><UiText text="应节开席的节令"/></summary><p className="mt-3 leading-loose">{config.gatherings.map((name,i)=><span key={name}>{i>0?'、':''}<UiText text={name}/></span>)}</p></details>
    </section>
    <section className="space-y-4 border-t border-[var(--paper-edge)] pt-6"><h2 className="text-xl"><UiText text="近来的节令"/></h2>{coming.map(e=><p key={`${e.kind}:${e.name}:${e.days}`} className="flex flex-wrap justify-between gap-3"><span><UiText text={e.name}/> · <UiText text={e.kind==='term'?'节气':'节日'}/></span><span className="text-sm text-ink-soft">{e.days===0?<UiText text="今日"/>:<>{e.days} <UiText text="日后"/></>}</span></p>)}</section>
    <nav className="flex gap-5 text-sm"><Link href="/reading"><UiText text="共读一页"/></Link><Link href="/gatherings"><UiText text="雅集"/></Link></nav>
  </div>;
}
