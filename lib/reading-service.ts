import type { Client, Transaction } from '@libsql/client';
import { contentTransaction } from './content-transaction';
import catalog from '@/data/reading-catalog.json';
import { active, allowance } from './literary-service';
import { plainText } from './literary-policy';
import { siteDateKey, siteDateStart, SITE_TIME_ZONE } from './time';
import { nextDateKey } from './seasonal-service';
type Sql=Pick<Client,'execute'>|Pick<Transaction,'execute'>;
const unblocked=`NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=e.user_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=e.user_id))`;
export async function ensureReadingDay(client:Client,date=new Date()) {
  const day=siteDateKey(date);
  if((await client.execute({sql:'SELECT 1 FROM reading_days WHERE day_key=?',args:[day]})).rows.length)return day;
  const tx=await contentTransaction(client);
  try{
    const old=(await tx.execute({sql:'SELECT day_key FROM reading_days WHERE day_key=?',args:[day]})).rows[0];
    if(!old){
      const ids:string[]=[];
      for(const book of catalog){
        await tx.execute({sql:'INSERT OR IGNORE INTO library_books(id,title,author,source_url,license,license_url,rights_note,reviewed_at) VALUES(?,?,?,?,?,?,?,?)',args:[book.id,book.title,book.author,book.source,book.license,book.license_url,book.rights,book.reviewed_at]});
        for(const [i,body]of book.passages.entries()){
          const id=`${book.id}:${i+1}`;ids.push(id);
          await tx.execute({sql:'INSERT OR IGNORE INTO library_passages(id,book_id,position,body) VALUES(?,?,?,?)',args:[id,book.id,i+1,body]});
        }
      }
      const opens=siteDateStart(day),closes=siteDateStart(nextDateKey(day));
      if(opens===null||closes===null)throw new Error('此日边界遇到时区切换，请稍后再试');
      const index=Math.floor(Date.parse(day+'T00:00:00Z')/86400000)%ids.length;
      await tx.execute({sql:'INSERT INTO reading_days(day_key,passage_id,time_zone,opens_at,closes_at) VALUES(?,?,?,?,?)',args:[day,ids[index],SITE_TIME_ZONE,opens,closes]});
    }
    await tx.commit();return day;
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
export async function readReadingDay(q:Sql,day:string){
  return (await q.execute({sql:'SELECT d.*,p.body,p.position,b.title,b.author,b.source_url,b.license,b.license_url,b.rights_note,b.reviewed_at FROM reading_days d JOIN library_passages p ON p.id=d.passage_id JOIN library_books b ON b.id=p.book_id WHERE d.day_key=?',args:[day]})).rows[0];
}
export async function readOwnReading(q:Sql,day:string,uid:string){return (await q.execute({sql:'SELECT * FROM reading_entries WHERE day_key=? AND user_id=?',args:[day,uid]})).rows[0];}
export async function readReadingNotes(q:Sql,day:string,uid:string,offset=0){
  if(!uid)return [];
  return (await q.execute({sql:`SELECT e.id,e.user_id,e.note,e.created_at,e.revision,u.pen_name FROM reading_entries e JOIN public_users u ON u.id=e.user_id WHERE e.day_key=? AND e.shared=1 AND e.active=1 AND e.hidden=0 AND e.note<>'' AND EXISTS(SELECT 1 FROM reading_entries mine WHERE mine.day_key=e.day_key AND mine.user_id=? AND mine.active=1) AND ${unblocked} ORDER BY e.created_at,e.id LIMIT 20 OFFSET ?`,args:[day,uid,uid,uid,offset]})).rows;
}
export async function readingMutation(client:Client,actor:string,op:string,data:Record<string,string>,timestamp?:number){
  const tx=await client.transaction('write'),now=timestamp??Date.now();
  try{
    const me=await active(tx,actor);
    if(op==='save'){
      const d=(await tx.execute({sql:'SELECT * FROM reading_days WHERE day_key=?',args:[data.day]})).rows[0];
      if(!d||now<Number(d.opens_at)||now>=Number(d.closes_at))throw new Error('此日已收卷，只能回看或撤回自己的文字');
      const copy=String(data.copy_body||'');plainText(copy,10000);if(Array.from(copy).length>10000)throw new Error('抄写最多一万字');
      const note=String(data.note||'');plainText(note,1000);if(Array.from(note).length>1000)throw new Error('札记最多一千字');
      if(data.consent!=='on')throw new Error('请确认参与与札记的阅读范围');
      const old=await readOwnReading(tx,data.day,actor);
      if(old&&!Number(old.active))throw new Error('已退出此日共读，不再重新入席');
      const revision=Number(data.revision||0);
      if(!Number.isSafeInteger(revision)||revision<0)throw new Error('请刷新后再写');
      if(old&&Number(old.revision)!==revision)throw new Error('另一页已修改，请刷新后接续');
      await allowance(tx,actor,'reading-save',now,30);
      if(old)await tx.execute({sql:'UPDATE reading_entries SET copy_body=?,note=?,shared=?,revision=revision+1,updated_at=? WHERE id=?',args:[copy,note,data.share==='on'?1:0,now,String(old.id)]});
      else await tx.execute({sql:'INSERT INTO reading_entries(id,day_key,user_id,copy_body,note,shared,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',args:[crypto.randomUUID(),data.day,actor,copy,note,data.share==='on'?1:0,now,now]});
    }else if(op==='unshare'||op==='leave'){
      const r=await tx.execute({sql:`UPDATE reading_entries SET shared=0,revision=revision+1,updated_at=?${op==='leave'?',active=0':''} WHERE id=? AND user_id=?`,args:[now,data.id,actor]});
      if(!r.rowsAffected)throw new Error('只能收回自己的札记');
    }else if(op==='report'){
      const e=(await tx.execute({sql:`SELECT e.id,e.note FROM reading_entries e WHERE e.id=? AND e.shared=1 AND e.active=1 AND e.hidden=0 AND EXISTS(SELECT 1 FROM reading_entries mine WHERE mine.day_key=e.day_key AND mine.user_id=? AND mine.active=1) AND ${unblocked}`,args:[data.id,actor,actor,actor]})).rows[0];
      if(!e)throw new Error('此札记不可访问');
      await allowance(tx,actor,'reading-report',now,10);
      await tx.execute({sql:'INSERT OR IGNORE INTO reading_reports(id,entry_id,reporter_id,reason,note_snapshot,created_at) VALUES(?,?,?,?,?,?)',args:[crypto.randomUUID(),data.id,actor,plainText(data.reason,500,1),String(e.note),now]});
    }else if(op==='moderate'){
      if(me.role!=='admin')throw new Error('无权处理');
      const report=(await tx.execute({sql:'SELECT 1 FROM reading_reports WHERE entry_id=?',args:[data.id]})).rows[0];
      if(!report)throw new Error('只能处理已反馈的札记');
      await tx.execute({sql:'UPDATE reading_entries SET hidden=? WHERE id=?',args:[data.restore==='on'?0:1,data.id]});
      await tx.execute({sql:'INSERT INTO admin_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',args:[crypto.randomUUID(),actor,data.restore==='on'?'reading_restore':'reading_hide',data.id,now]});
    }else throw new Error('无法识别这项操作');
    await tx.commit();return {};
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
