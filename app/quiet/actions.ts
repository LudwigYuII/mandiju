'use server';

import {db,waitDb} from '@/lib/db';
import {getSession} from '@/lib/auth';
import {blockedBetween} from '@/lib/study-service';
import {quietSchedule,teaTime} from '@/lib/quiet-time';
import {redirect} from 'next/navigation';

export async function quietAction(form:FormData) {
  await waitDb();
  const me=await getSession();
  if (!me) redirect('/login');
  const now=Date.now(), schedule=quietSchedule(now), uid=me.uid;
  const get=(key:string)=>String(form.get(key)??'').trim();
  const op=get('op'), id=get('id'), body=get('body');
  const tx=await db.transaction('write');
  let error='';
  try {
    const one=async(sql:string,args:(string|number)[]) => (await tx.execute({sql,args})).rows[0];
    const run=(sql:string,args:(string|number)[])=>tx.execute({sql,args});
    const note=async(room:string,max:number)=>{
      if (!body||body.length>max) throw Error('请检查文字长度');
      await run('INSERT INTO quiet_notes VALUES(?,?,?,?,?)',[room,uid,body,now,crypto.randomUUID()]);
    };
    if(op==='tea') {
      const starts=teaTime(get('date'),get('time'));
      const peer=await one(`SELECT u.id FROM public_users u WHERE u.pen_name=? AND u.banned=0 AND u.id<>?
        AND EXISTS(SELECT 1 FROM letters l WHERE l.deliver_at<=? AND l.burned=0 AND l.moderation_hidden=0
        AND ((l.author_id=u.id AND l.recipient_id=?) OR (l.recipient_id=u.id AND l.author_id=?)))`,[get('peer'),uid,now,uid,uid]);
      if(!peer||starts<now||starts>now+30*86400000||await blockedBetween(tx,uid,String(peer.id))) throw Error('请选择可往来的笔友及三十日内的时间');
      if(await one('SELECT 1 FROM quiet_tea WHERE host=? AND starts>=? GROUP BY host HAVING COUNT(*)>=8',[uid,now])) throw Error('预约已满');
      await run('INSERT OR IGNORE INTO quiet_tea(id,host,guest,starts) VALUES(?,?,?,?)',[crypto.randomUUID(),uid,String(peer.id),starts]);
    } else if(['accept','cancel','tea-note'].includes(op)) {
      const tea=await one('SELECT * FROM quiet_tea WHERE id=? AND (host=? OR guest=?)',[id,uid,uid]);
      if(!tea||await blockedBetween(tx,String(tea.host),String(tea.guest))) throw Error('预约不可用');
      if(op==='cancel'&&now<Number(tea.starts)) await run('DELETE FROM quiet_tea WHERE id=?',[id]);
      else if(op==='accept'&&tea.guest===uid&&now<Number(tea.starts)) await run('UPDATE quiet_tea SET accepted=1 WHERE id=?',[id]);
      else if(op==='tea-note'&&Number(tea.accepted)&&now>=Number(tea.starts)+15*60000) {
        if(await one('SELECT 1 FROM quiet_notes WHERE room=? AND uid=?',['tea:'+id,uid])) throw Error('已经留过一句');
        await note('tea:'+id,160);
      } else throw Error('当前不能进行这项操作');
    } else if(op==='incense') {
      await run(`INSERT INTO quiet_incense VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE
        SET starts=excluded.starts,ends=excluded.ends WHERE quiet_incense.ends<=excluded.starts`,[uid,now,now+30*60000]);
    } else if(op==='incense-note') {
      const timer=await one('SELECT starts FROM quiet_incense WHERE uid=? AND ends<=?',[uid,now]);
      if(!timer) throw Error('请待计时结束');
      const room='incense:'+timer.starts;
      if(await one('SELECT 1 FROM quiet_notes WHERE room=? AND uid=?',[room,uid])) throw Error('已经留过札记');
      await note(room,160);
    } else if(op==='music') {
      if(!await one('SELECT 1 FROM quiet_music WHERE week=?',[schedule.week])) throw Error('本周尚未排曲');
      const room='music:'+schedule.week;
      if(await one('SELECT 1 FROM quiet_notes WHERE room=? AND uid=?',[room,uid])) throw Error('已经留过听后感');
      await note(room,600);
    } else if(op==='music-set') {
      const week=get('week');
      const day=new Date(week+'T12:00:00Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||day.getUTCDay()!==1||day.toISOString().slice(0,10)!==week||week<schedule.week) throw Error('请选择本周或之后的周一');
      const admin=await one("SELECT 1 FROM users WHERE id=? AND role='admin'",[uid]);
      const https=(s:string)=>{try{return new URL(s).protocol==='https:'&&s.length<=600;}catch{return false;}};
      if(!admin||!https(get('url'))||!https(get('source'))||!get('credit')||get('credit').length>300||!get('title')||get('title').length>80) throw Error('请填写曲名、音源与授权出处');
      await run('INSERT INTO quiet_music VALUES(?,?,?,?,?)',[week,get('title'),get('url'),get('credit'),get('source')]);
    } else if(['join','post','report'].includes(op)) {
      if(!schedule.open) throw Error('夜话已经散场');
      const room='night:'+schedule.night;
      const member=await one('SELECT 1 FROM quiet_members WHERE room=? AND uid=?',[room,uid]);
      if(op==='join') {
        if(!member&&await one('SELECT 1 FROM quiet_members WHERE room=? GROUP BY room HAVING COUNT(*)>=8',[room])) throw Error('本间席满');
        await run('INSERT OR IGNORE INTO quiet_members VALUES(?,?)',[room,uid]);
      } else if(!member) throw Error('请先入席');
      else if(op==='post') {
        if(await one('SELECT 1 FROM quiet_notes WHERE room=? AND uid=? AND created>?',[room,uid,now-30000])) throw Error('两次发言请间隔三十秒');
        await note(room,600);
      } else {
        const post=await one('SELECT uid,body FROM quiet_notes WHERE room=? AND id=?',[room,id]);
        if(!post||!get('reason')||get('reason').length>300||await blockedBetween(tx,uid,String(post.uid))) throw Error('请核对反馈内容');
        await run('INSERT OR IGNORE INTO quiet_reports VALUES(?,?,?,?,?)',[id,uid,String(post.body),get('reason'),now+30*86400000]);
      }
    } else throw Error('操作无效');
    await tx.commit();
  } catch(e) {
    await tx.rollback();
    const message=e instanceof Error?e.message:'';
    error=/[\u4e00-\u9fff]/.test(message)?message:'未能保存，请稍后再试';
  } finally {tx.close();}
  const tab=['tea','incense','music','night'].includes(get('tab'))?get('tab'):'tea';
  redirect('/quiet?tab='+tab+(error?'&error='+encodeURIComponent(error):''));
}
