import Link from 'next/link';
import {redirect} from 'next/navigation';
import type {ReactNode} from 'react';
import {db,waitDb} from '@/lib/db';
import {getSession} from '@/lib/auth';
import {UiText,UiTextarea} from '@/components/UiText';
import {formatSiteTime} from '@/lib/time';
import {categories,plants,lanternSeason,dayMs} from '@/lib/pastimes';
import {pastime} from './actions';

export const dynamic='force-dynamic';
const tabs={stream:'曲水流觞',verse:'联句与对对子',riddle:'灯谜',shelf:'博古架',plant:'莳花',wall:'驿壁题诗'};
type Tab=keyof typeof tabs;
function Form({tab,op,button,id='',children}:{tab:Tab;op:string;button:string;id?:string;children?:ReactNode}){
  return <form action={pastime} className="space-y-3">
    <input type="hidden" name="tab" value={tab}/><input type="hidden" name="op" value={op}/><input type="hidden" name="id" value={id}/>
    {children}<button className="btn-ghost"><UiText text={button}/></button>
  </form>;
}
function Body({label,max=600}:{label:string;max?:number}){
  return <label className="block"><UiText text={label}/><UiTextarea name="body" className="input mt-2 w-full" rows={3} required maxLength={max}/></label>;
}
function Choose({options,label}:{options:string[];label:string}){
  return <label className="block"><UiText text={label}/> <select className="input" name="title">{options.map(x=><option key={x} value={x}><UiText text={x}/></option>)}</select></label>;
}
export default async function Pastimes({searchParams}:{searchParams:Promise<{tab?:string;notice?:string}>}){
  await waitDb();
  const viewer=await getSession();
  if(!viewer) redirect('/login');
  const uid=viewer.uid, now=Date.now(), params=await searchParams;
  const tab:Tab=params.tab&&Object.hasOwn(tabs,params.tab)?params.tab as Tab:'stream';
  const read=async(sql:string,args:(string|number)[])=>(await db.execute({sql,args})).rows;
  const admin=(await read("SELECT 1 FROM users WHERE id=? AND role='admin'",[uid])).length>0;
  const feed=(kind:string,parent='',since=0)=>read(`SELECT p.id,p.owner,p.title,p.body,p.created,p.marked,u.pen_name,
      CASE WHEN p.kind='riddle' AND p.marked=1 AND ?=0 THEN p.answer ELSE '' END AS revealed
    FROM pastime_posts p JOIN public_users u ON u.id=p.owner
    WHERE p.kind=? AND p.parent=? AND p.hidden=0 AND u.banned=0 AND p.created>?
    AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
    (b.blocker_id=p.owner AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=p.owner))
    ORDER BY p.created DESC,p.id LIMIT 30`,[lanternSeason(now)?1:0,kind,parent,since,uid,uid]);
  const hide=(id:string)=><Form tab={tab} op="hide" id={id} button="从页面移除"/>;
  let content:ReactNode;
  if(tab==='stream'){
    const choices=await read('SELECT day,prompt,deadline FROM pastime_stream_draw WHERE owner=? AND done=0 AND deadline>? ORDER BY day LIMIT 40',[uid,now]);
    const enrolled=(await read('SELECT 1 FROM pastime_stream_opt WHERE owner=?',[uid])).length>0;
    const verses=await read(`SELECT p.id,p.body,d.prompt,u.pen_name FROM pastime_posts p
      JOIN pastime_stream_draw d ON d.day=p.parent JOIN public_users u ON u.id=p.owner
      WHERE p.kind='stream' AND p.hidden=0 AND u.banned=0
      AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=p.owner AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=p.owner))
      ORDER BY p.created DESC LIMIT 20`,[uid,uid]);
    content=<><p><UiText text="自愿报名。酒杯随机漂向一位局友，接到的人可在二十四小时内题诗一句。"/></p>
      <Form tab={tab} op={enrolled?'leave':'enroll'} button={enrolled?'退出报名':'报名等候'}/>
      {choices.map(choice=><article key={String(choice.day)} className="card space-y-4 p-6"><h2 className="text-xl">{String(choice.prompt)}</h2>
        <p>{formatSiteTime(Number(choice.deadline))}</p>
        <Form tab={tab} op="stream-write" id={String(choice.day)} button="题诗一句"><Body label="你的诗句" max={100}/></Form>
        <Form tab={tab} op="decline" id={String(choice.day)} button="婉谢，让杯顺流"/></article>)}
      {verses.map(v=><article className="card space-y-2 p-6" key={String(v.id)}><p className="text-sm text-ink-soft">{String(v.prompt)} · {String(v.pen_name)}</p><p className="whitespace-pre-wrap break-words">{String(v.body)}</p>{admin&&hide(String(v.id))}</article>)}</>;
  }else if(tab==='verse'){
    content=<><Form tab={tab} op="verse" button="出一句"><Choose label="题式" options={['联句','对对子']}/><Body label="起句或上联"/></Form>
      {await Promise.all((await feed('verse')).map(async v=><article className="card space-y-4 p-6" key={String(v.id)}>
        <p className="text-sm text-ink-soft"><UiText text={v.title}/> · {String(v.pen_name)}</p><h2 className="whitespace-pre-wrap break-words text-xl">{String(v.body)}</h2>
        <Form tab={tab} op="reply" id={String(v.id)} button="接一句"><Body label="下句或下联"/></Form>
        {(await feed('reply',String(v.id))).reverse().map(r=><div className="space-y-2 border-t pt-3" key={String(r.id)}>
          <p className="whitespace-pre-wrap break-words">{String(r.body)} · {String(r.pen_name)}{Boolean(r.marked)&&<> · <UiText text="出题者击节"/></>}</p>
          {v.owner===uid&&<Form tab={tab} op="mark" id={String(r.id)} button={r.marked?'收回击节':'击节'}/>}
          {admin&&hide(String(r.id))}
        </div>)}{admin&&hide(String(v.id))}
      </article>))}</>;
  }else if(tab==='riddle'){
    const open=lanternSeason(now);
    content=<><p><UiText text={open?'灯谜会开场，答案请寄给出题人。':'灯谜会于农历正月十三至十七开放。散场后由出题人揭晓。'}/></p>
      {open&&<Form tab={tab} op="riddle" button="挂一盏谜灯"><label className="block"><UiText text="谜题名称"/> <input name="title" className="input" maxLength={80} required/></label>
        <Body label="谜面"/><label className="block"><UiText text="谜底"/> <input name="answer" className="input" maxLength={300} required/></label></Form>}
      {(await feed('riddle')).map(r=><article className="card space-y-3 p-6" key={String(r.id)}>
        <h2 className="break-words text-xl">{String(r.title)}</h2><p>{String(r.pen_name)}</p><p className="whitespace-pre-wrap break-words">{String(r.body)}</p>
        {r.revealed&&<p className="whitespace-pre-wrap break-words"><UiText text="谜底"/> · {String(r.revealed)}</p>}
        {open&&r.owner!==uid&&<Link className="underline" href={'/write?to='+encodeURIComponent(String(r.pen_name))}><UiText text="寄信答谜"/></Link>}
        {!open&&r.owner===uid&&!r.marked&&<Form tab={tab} op="reveal" id={String(r.id)} button="揭晓谜底"/>}
        {admin&&hide(String(r.id))}
      </article>)}</>;
  }else if(tab==='shelf'){
    const items=await read("SELECT id,title,body FROM pastime_posts WHERE owner=? AND kind='shelf' AND hidden=0 ORDER BY created DESC LIMIT 12",[uid]);
    content=<><p><UiText text="清玩小记将展示在你的书斋门庭。"/></p>
      <Form tab={tab} op="shelf" button="添一件清玩"><Choose label="类别" options={categories}/><Body label="清玩小记"/></Form>
      {items.map(x=><article className="card space-y-3 p-6" key={String(x.id)}><h2><UiText text={x.title}/></h2><p className="whitespace-pre-wrap break-words">{String(x.body)}</p>{hide(String(x.id))}</article>)}</>;
  }else if(tab==='plant'){
    const [plant]=await read('SELECT kind,planted FROM pastime_plants WHERE owner=?',[uid]);
    const [activity]=plant?await read('SELECT COUNT(DISTINCT date(sent_at/1000,\'unixepoch\')) n FROM letters WHERE author_id=? AND sent_at>=?',[uid,Number(plant.planted)]):[];
    const age=plant?Math.floor((now-Number(plant.planted))/dayMs):0;
    const growth=age+Math.min(Number(activity?.n??0),age+1);
    content=plant?<article className="card space-y-4 p-8"><p aria-hidden="true" className="text-4xl">{growth>=14?'🪴':'🌱'}</p><h2 className="text-xl"><UiText text={plant.kind}/></h2>
      <p><UiText text={growth>=28?'枝叶舒展':growth>=14?'新枝渐长':growth>=4?'初见嫩叶':'新芽初发'}/></p></article>:<Form tab={tab} op="plant" button="种下一盆"><Choose label="选一株植物" options={plants}/></Form>;
  }else{
    content=<><p><UiText text="字迹会渐淡。题句展示三十天，后台于六十天后例行清理。"/></p>
      <Form tab={tab} op="wall" button="题在驿壁"><Body label="诗句" max={160}/></Form>
      {(await feed('wall','',now-30*dayMs)).map(v=><article className="card space-y-3 p-6" key={String(v.id)}>
        <p className="whitespace-pre-wrap break-words text-xl" style={{opacity:Math.max(.7,1-(now-Number(v.created))/(100*dayMs))}}>{String(v.body)}</p>
        <p className="text-sm text-ink-soft">{String(v.pen_name)}</p>{admin&&hide(String(v.id))}
      </article>)}</>;
  }
  return <section className="mx-auto max-w-3xl space-y-6">
    <nav className="flex flex-wrap gap-4">{Object.entries(tabs).map(([key,label])=><Link key={key} href={'/pastimes?tab='+key} aria-current={tab===key?'page':undefined} className={tab===key?'underline underline-offset-4':''}><UiText text={label}/></Link>)}</nav>
    <h1 className="text-3xl"><UiText text={tabs[tab]}/></h1>
    {params.notice&&<p role="status"><UiText text={params.notice==='ok'?'已保存。':params.notice==='rate'?'操作过于频繁，请稍后再试。':'未能完成，请核对内容或当前活动状态。'}/></p>}
    {content}
  </section>;
}
