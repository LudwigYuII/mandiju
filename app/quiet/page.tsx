import Link from 'next/link';
import {redirect} from 'next/navigation';
import type {ReactNode} from 'react';
import {db,waitDb} from '@/lib/db';
import {getSession} from '@/lib/auth';
import {UiText,UiTextarea} from '@/components/UiText';
import {SITE_TIME_ZONE,formatSiteTime} from '@/lib/time';
import {quietSchedule} from '@/lib/quiet-time';
import {quietAction} from './actions';
import Timer from './timer';

export const dynamic='force-dynamic';
const pages={tea:'同饮',incense:'焚香',music:'听琴',night:'夜话'};
type Tab=keyof typeof pages;
function Form({tab,op,id='',button,children}:{tab:Tab;op:string;id?:string;button:string;children?:ReactNode}) {
  return <form action={quietAction} className="space-y-3">
    <input type="hidden" name="tab" value={tab}/><input type="hidden" name="op" value={op}/><input type="hidden" name="id" value={id}/>
    {children}<button className="btn-ghost"><UiText text={button}/></button>
  </form>;
}
function Note({max,label='写一句话'}:{max:number;label?:string}) {
  return <label className="block"><UiText text={label}/><UiTextarea name="body" className="input mt-2 block w-full" required maxLength={max} rows={3}/></label>;
}
export default async function Quiet({searchParams}:{searchParams:Promise<{tab?:string;error?:string}>}) {
  await waitDb();
  const me=await getSession();
  if(!me) redirect('/login');
  const p=await searchParams, tab:Tab=p.tab&&Object.hasOwn(pages,p.tab)?p.tab as Tab:'tea';
  const uid=me.uid, now=Date.now(), schedule=quietSchedule(now);
  const query=async(sql:string,args:(string|number)[]) => (await db.execute({sql,args})).rows;
  const own=async(room:string)=>(await query('SELECT body FROM quiet_notes WHERE room=? AND uid=? LIMIT 1',[room,uid]))[0];
  const notes=async(room:string,requireOwn=false)=>query(`SELECT n.id,n.uid,n.body,u.pen_name FROM quiet_notes n JOIN public_users u ON u.id=n.uid
    WHERE n.room=? AND u.banned=0 AND (?=0 OR EXISTS(SELECT 1 FROM quiet_notes self WHERE self.room=n.room AND self.uid=?))
    AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=n.uid AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=n.uid))
    ORDER BY n.created DESC LIMIT 50`,[room,requireOwn?1:0,uid,uid,uid]);
  let content:ReactNode;
  if(tab==='tea') {
    const teas=await query(`SELECT t.*,u.pen_name FROM quiet_tea t JOIN public_users u ON u.id=CASE WHEN t.host=? THEN t.guest ELSE t.host END
      WHERE (t.host=? OR t.guest=?) AND u.banned=0 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE
      (b.blocker_id=u.id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=u.id)) ORDER BY t.starts DESC LIMIT 24`,[uid,uid,uid,uid,uid]);
    content=<><p><UiText text="与笔友约十五分钟，同饮者可在结束后各留一句。"/> · {SITE_TIME_ZONE}</p>
      <Form tab={tab} op="tea" button="邀约同饮">
        <label className="block"><UiText text="笔友雅号"/> <input name="peer" className="input" maxLength={40} required/></label>
        <div className="flex flex-wrap gap-4"><label><UiText text="日期"/> <input type="date" name="date" className="input" required/></label><label><UiText text="时间"/> <input type="time" name="time" className="input" required/></label></div>
      </Form>
      {await Promise.all(teas.map(async t=>{
        const id=String(t.id), end=Number(t.starts)+900000, accepted=Number(t.accepted)===1, room='tea:'+id;
        const entries=accepted&&now>=end?await notes(room):[];
        return <article className="card space-y-4 p-6" key={id}><h2>{String(t.pen_name)} · {formatSiteTime(Number(t.starts))}</h2>
          {!accepted&&<p><UiText text="等待应约"/></p>}
          {now<Number(t.starts)&&<>{!accepted&&t.guest===uid&&<Form tab={tab} id={id} op="accept" button="应约"/>}<Form tab={tab} id={id} op="cancel" button="取消预约"/></>}
          {accepted&&now>=Number(t.starts)&&now<end&&<Timer ends={end}/>}
          {accepted&&now<Number(t.starts)&&<Link className="underline" href="/quiet?tab=tea"><UiText text="到时刷新入席"/></Link>}
          {accepted&&now>=end&&<>{entries.map(n=><p key={String(n.id)}>{String(n.pen_name)} · {String(n.body)}</p>)}
            {!entries.some(n=>n.uid===uid)&&<Form tab={tab} id={id} op="tea-note" button="留一句"><Note max={160}/></Form>}</>}
        </article>;
      }))}</>;
  } else if(tab==='incense') {
    const [timer]=await query('SELECT starts,ends FROM quiet_incense WHERE uid=?',[uid]);
    const active=timer&&Number(timer.ends)>now;
    const fellow=active&&(await query('SELECT 1 FROM quiet_incense WHERE uid<>? AND ends>? LIMIT 1',[uid,now])).length>0;
    const note=timer&&!active?await own('incense:'+timer.starts):null;
    content=<><p><UiText text="一炷香三十分钟，留给读书、写字或静坐。"/></p>
      {active?<><Timer ends={Number(timer.ends)}/>{fellow&&<p><UiText text="此刻亦有人同焚一炷香。"/></p>}</>:<Form tab={tab} op="incense" button="焚一炷香"/>}
      {timer&&!active&&(note?<p className="card p-6">{String(note.body)}</p>:<Form tab={tab} op="incense-note" button="私存札记"><Note max={160} label="仅本人可见的札记"/></Form>)}</>;
  } else if(tab==='music') {
    const [track]=await query('SELECT * FROM quiet_music WHERE week=?',[schedule.week]);
    const admin=(await query("SELECT 1 FROM users WHERE id=? AND role='admin'",[uid])).length>0;
    const room='music:'+schedule.week;
    const entries=track?await notes(room,true):[];
    const submitted=track ? await own(room) : null;
    content=<>{track?<><h2 className="text-xl">{String(track.title)}</h2>
      <audio controls preload="none" src={String(track.url)} className="w-full"/>
      <p className="text-sm">{String(track.credit)} · <a className="underline" href={String(track.source)} rel="noreferrer"><UiText text="授权出处"/></a></p>
      {!submitted&&<Form tab={tab} op="music" button="留下听后感"><Note max={600} label="先写下自己的听后感，再展读同听者的文字"/></Form>}
      {entries.map(n=><article key={String(n.id)} className="card whitespace-pre-wrap p-6">{String(n.pen_name)} · {String(n.body)}</article>)}
      </>:<p><UiText text="本周尚未安排古琴曲。"/></p>}
      {track?.url==="https://upload.wikimedia.org/wikipedia/commons/1/1e/Shenren_Chang.ogg"&&<a className="underline" href="https://creativecommons.org/licenses/by-sa/2.5/" rel="noreferrer">CC BY-SA 2.5</a>}
      {admin&&<Form tab={tab} op="music-set" button="安排本周曲目">
        <label className="block"><UiText text="刊期周一"/> <input name="week" type="date" defaultValue={schedule.week} className="input" required/></label>
        <label className="block"><UiText text="曲名"/> <input name="title" className="input" maxLength={80} required/></label>
        <label className="block"><UiText text="可直接播放的 HTTPS 音源"/> <input name="url" type="url" className="input" required/></label>
        <label className="block"><UiText text="演奏者与录音授权说明"/> <input name="credit" className="input" maxLength={300} required/></label>
        <label className="block"><UiText text="授权出处网址"/> <input name="source" type="url" className="input" required/></label>
      </Form>}</>;
  } else {
    const room='night:'+schedule.night;
    const joined=schedule.open&&(await query('SELECT 1 FROM quiet_members WHERE room=? AND uid=?',[room,uid])).length>0;
    const entries=joined?await notes(room):[];
    const admin=(await query("SELECT 1 FROM users WHERE id=? AND role='admin'",[uid])).length>0;
    content=<><p><UiText text="每晚 22:00 至次日 01:00 开放，每间最多八席，发言至少间隔三十秒。"/> · {SITE_TIME_ZONE}</p>
      {admin&&<Link href="/quiet/reports" className="underline"><UiText text="夜话反馈"/></Link>}
      <p className="text-sm text-ink-soft"><UiText text="散场后正文停止展示。举报所附正文供站务处理，保留三十天。"/></p>
      {!schedule.open?<p><UiText text="夜话尚未开席。"/></p>:joined?<><Form tab={tab} op="post" button="留一段话"><Note max={600}/></Form>
      <Link className="underline" href="/quiet?tab=night"><UiText text="刷新夜话"/></Link>
      {entries.map(n=><article key={String(n.id)} className="card space-y-3 p-6"><p>{String(n.pen_name)}</p><p className="whitespace-pre-wrap break-words">{String(n.body)}</p>
        {n.uid!==uid&&<details><summary><UiText text="反馈此段文字"/></summary><Form tab={tab} id={String(n.id)} op="report" button="提交反馈"><input name="reason" className="input" aria-label="原因" maxLength={300} required/></Form></details>}
      </article>)}</>:<Form tab={tab} op="join" button="入席"/>}</>;
  }
  return <section className="mx-auto max-w-3xl space-y-6"><nav className="flex flex-wrap gap-4">{Object.entries(pages).map(([id,label])=><Link key={id} href={'/quiet?tab='+id} aria-current={id===tab?'page':undefined} className={id===tab?'underline underline-offset-4':''}><UiText text={label}/></Link>)}</nav>
    <h1 className="text-3xl"><UiText text={pages[tab]}/></h1>
    {p.error&&<p role="alert"><UiText text={p.error.slice(0,100)}/></p>}
    {content}
  </section>;
}
