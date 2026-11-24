'use server';
import {redirect} from 'next/navigation';
import {db,waitDb} from '@/lib/db';
import {getSession} from '@/lib/auth';
import {rateLimit} from '@/lib/rate-limit';
import {blockedBetween} from '@/lib/study-service';
import {categories,plants,lanternSeason,drawStream} from '@/lib/pastimes';

export async function pastime(form:FormData){
  await waitDb();
  const me=await getSession();
  if(!me) redirect('/login');
  const read=(k:string)=>String(form.get(k)??'').trim();
  const tabs=['stream','verse','riddle','shelf','plant','wall'];
  const tab=tabs.includes(read('tab'))?read('tab'):'stream';
  if(!(await rateLimit('pastime:'+me.uid,24,60000)).ok) redirect('/pastimes?tab='+tab+'&notice=rate');
  const now=Date.now(), op=read('op'), title=read('title'), body=read('body'), id=read('id'), uid=me.uid;
  const tx=await db.transaction('write');
  let ok=false;
  try{
    const run=(sql:string,args:(string|number)[])=>tx.execute({sql,args});
    const row=async(sql:string,args:(string|number)[]) => (await run(sql,args)).rows[0];
    const post=async(kind:string,parent='',answer='')=>{
      if(!body||body.length>600||title.length>80) throw Error();
      await run('INSERT INTO pastime_posts(id,kind,owner,parent,title,body,answer,created) VALUES(?,?,?,?,?,?,?,?)',
        [crypto.randomUUID(),kind,uid,parent,title,body,answer,now]);
    };
    if(op==='enroll'||op==='leave'){
      if(op==='enroll') await run('INSERT OR IGNORE INTO pastime_stream_opt VALUES(?)',[uid]);
      else await run('DELETE FROM pastime_stream_opt WHERE owner=?',[uid]);
      await drawStream(tx,now);
    }else if(op==='stream-write'||op==='decline'){
      const chosen=await row('SELECT day,prompt FROM pastime_stream_draw WHERE owner=? AND day=? AND done=0 AND deadline>?',[uid,id,now]);
      if(!chosen) throw Error();
      if(op==='decline'){
        await run('UPDATE pastime_stream_draw SET deadline=? WHERE day=?',[now,String(chosen.day)]);
        await drawStream(tx,now);
      }else{
        if(body.length>100) throw Error();
        await post('stream',String(chosen.day));
        await run('UPDATE pastime_stream_draw SET done=1 WHERE day=?',[String(chosen.day)]);
      }
    }else if(op==='verse'){
      if(!['联句','对对子'].includes(title)) throw Error();
      await post('verse');
    }else if(op==='reply'||op==='mark'){
      const target=await row('SELECT * FROM pastime_posts WHERE id=? AND hidden=0',[id]);
      if(!target||await blockedBetween(tx,uid,String(target.owner))) throw Error();
      if(op==='reply'&&target.kind==='verse') await post('reply',id);
      else if(op==='mark'&&target.kind==='reply'){
        const root=await row("SELECT owner FROM pastime_posts WHERE id=? AND kind='verse' AND hidden=0",[String(target.parent)]);
        if(root?.owner!==uid) throw Error();
        await run('UPDATE pastime_posts SET marked=1-marked WHERE id=?',[id]);
      }else throw Error();
    }else if(op==='riddle'){
      const answer=read('answer');
      if(!lanternSeason(now)||!title||!answer||answer.length>300) throw Error();
      await post('riddle','',answer);
    }else if(op==='reveal'){
      if(lanternSeason(now)) throw Error();
      await run("UPDATE pastime_posts SET marked=1 WHERE id=? AND owner=? AND kind='riddle'",[id,uid]);
    }else if(op==='shelf'){
      if(!categories.includes(title)) throw Error();
      if(await row("SELECT 1 FROM pastime_posts WHERE kind='shelf' AND owner=? AND hidden=0 GROUP BY owner HAVING count(*)>=12",[uid])) throw Error();
      await post('shelf');
    }else if(op==='plant'){
      if(!plants.includes(title)) throw Error();
      await run('INSERT OR IGNORE INTO pastime_plants VALUES(?,?,?)',[uid,title,now]);
    }else if(op==='wall'){
      if(body.length>160) throw Error();
      await post('wall');
    }else if(op==='hide'){
      const admin=await row("SELECT 1 FROM users WHERE id=? AND role='admin'",[uid]);
      if(admin) await run('UPDATE pastime_posts SET hidden=1 WHERE id=?',[id]);
      else await run("UPDATE pastime_posts SET hidden=1 WHERE id=? AND owner=? AND kind='shelf'",[id,uid]);
    }else throw Error();
    await tx.commit();ok=true;
  }catch{await tx.rollback();}finally{tx.close();}
  redirect('/pastimes?tab='+tab+'&notice='+(ok?'ok':'invalid'));
}
