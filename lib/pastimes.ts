import type { Client, Transaction } from '@libsql/client';
import { Solar } from 'lunar-typescript';
import { siteDateKey } from './time';

export const dayMs=86400000;
export const categories=['石','砚','茶器','书','其他'];
export const plants=['梅','兰','竹','菊'];
export function lanternSeason(now:number) {
  const [year,month,day]=siteDateKey(new Date(now)).split('-').map(Number);
  const lunar=Solar.fromYmd(year,month,day).getLunar();
  return lunar.getMonth()===1&&lunar.getDay()>=13&&lunar.getDay()<=17;
}
const prompts=['微雨','松间月','一灯如豆','远山','故人来','新叶','江上风'];
export async function drawStream(tx:Transaction,now:number){
  const today=siteDateKey(new Date(now));
  const pending=(await tx.execute({sql:"SELECT day FROM pastime_stream_draw WHERE day<? AND done=0 ORDER BY day LIMIT 40",args:[today]})).rows;
  for(const {day} of pending) await drawDay(tx,String(day),today,now);
  await drawDay(tx,today,today,now);
}
async function drawDay(tx:Transaction,day:string,today:string,now:number){
  const current=(await tx.execute({sql:"SELECT * FROM pastime_stream_draw WHERE day=?",args:[day]})).rows[0];
  if(current?.done) return;
  if(current&&Number(current.deadline)>now&&current.owner){
    const eligible=(await tx.execute({sql:`SELECT 1 FROM pastime_stream_opt o JOIN users u ON u.id=o.owner
      WHERE o.owner=? AND u.banned=0 AND u.retreat_until<=?`,args:[current.owner,now]})).rows[0];
    if(eligible) return;
  }
  if(current?.owner) await tx.execute({sql:"INSERT OR IGNORE INTO pastime_stream_skip VALUES(?,?)",args:[day,current.owner]});
  const next=(await tx.execute({sql:`SELECT o.owner FROM pastime_stream_opt o JOIN users u ON u.id=o.owner
    WHERE u.banned=0 AND u.retreat_until<=? AND u.literary_name IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM pastime_stream_skip s WHERE s.day=? AND s.owner=o.owner)
    ORDER BY random() LIMIT 1`,args:[now,day]})).rows[0];
  if(!next){
    if(current&&day!==today) await tx.execute({sql:"UPDATE pastime_stream_draw SET done=1 WHERE day=?",args:[day]});
    return;
  }
  await tx.execute({sql:`INSERT INTO pastime_stream_draw VALUES(?,?,?,?,0)
    ON CONFLICT(day) DO UPDATE SET owner=excluded.owner,deadline=excluded.deadline`,
    args:[day,next.owner,prompts[Math.floor(now/dayMs)%prompts.length],now+dayMs]});
  await tx.execute({sql:"INSERT OR IGNORE INTO notifications(id,user_id,type,body,link,created_at,event_key) VALUES(?,?,'friend',?,'/pastimes?tab=stream',?,?)",
    args:[crypto.randomUUID(),next.owner,'曲水流觞的酒杯漂到了你面前。',now,'pastime-stream:'+day+':'+next.owner]});
}
export async function maintainPastimes(client:Client,now=Date.now()){
  const tx=await client.transaction('write');
  try{
    await drawStream(tx,now);
    await tx.execute({sql:"DELETE FROM pastime_posts WHERE kind='wall' AND created<=?",args:[now-60*dayMs]});
    await tx.commit();
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
