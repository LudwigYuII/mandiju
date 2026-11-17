import { Solar } from 'lunar-typescript';
import type { Client } from '@libsql/client';
import { contentTransaction } from './content-transaction';
import config from '@/data/seasons.json';
import { calendarEvents } from './calendar-core';
import { siteDateKey, siteDateParts, siteDateStart, SITE_TIME_ZONE } from './time';
export function seasonalTheme(date=new Date()) {
  const {year,month,day}=siteDateParts(date);
  const lunar=Solar.fromYmd(year,month,day).getLunar();
  const term=lunar.getPrevJieQi(true).getName();
  const season=config.seasons.find(s=>s.terms.includes(term))||config.seasons[3];
  return {...season,term,events:calendarEvents(date)};
}
export function nextDateKey(day:string) { const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10); }
/** Existing public calendar + one canonical event row: cron and page access are safe to repeat. */
export async function ensureSeasonalGatherings(client:Client,date=new Date()) {
  const day=siteDateKey(date),events=calendarEvents(date).filter(e=>config.gatherings.includes(e.name));
  if(!events.length)return [];
  const start=siteDateStart(day),end=siteDateStart(nextDateKey(day));
  if(start===null||end===null) return [];
  const tx=await contentTransaction(client);
  try {
    const host=(await tx.execute("SELECT id FROM users WHERE role='admin' AND banned=0 AND literary_name IS NOT NULL ORDER BY created_at,id LIMIT 1")).rows[0];
    if(!host){await tx.commit();return [];}
    const ids:string[]=[];
    for(const event of events){
      const key=`${day}:${event.kind}:${event.name}`;
      const old=(await tx.execute({sql:'SELECT space_id FROM seasonal_gatherings WHERE event_key=?',args:[key]})).rows[0];
      if(old){ids.push(String(old.space_id));continue;}
      const id=crypto.randomUUID();
      await tx.execute({sql:"INSERT INTO literary_spaces(id,owner_id,kind,title,intro,visibility,capacity,created_at,send_key,starts_at,ends_at,event_timezone) VALUES(?,?,'gathering',?,?,'public',12,?,?,?,?,?)",args:[id,String(host.id),`${event.name} · 应节雅集`,'此席由站务依岁时自动设立。留一段应景的文字即可，不必守候；仅作者明确授权的篇章与留名收入集序。',date.getTime(),`seasonal:${key}`,start,end,SITE_TIME_ZONE]});
      await tx.execute({sql:"INSERT INTO literary_members(space_id,user_id,status,created_at) VALUES(?,?,'joined',?)",args:[id,String(host.id),date.getTime()]});
      await tx.execute({sql:'INSERT INTO seasonal_gatherings(event_key,space_id,created_at) VALUES(?,?,?)',args:[key,id,date.getTime()]});
      ids.push(id);
    }
    await tx.commit();return ids;
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
