import type {Client,Transaction} from '@libsql/client';
import { active,allowance } from './literary-service';
import { plainText,workBody } from './literary-policy';
import { coordinates,TRAVEL_REGIONS } from './travel-policy';
import { findPlace,regionForPoint } from './geography';
type Sql=Pick<Client,'execute'>|Pick<Transaction,'execute'>;
const audience=`(e.author_id=? OR (e.visibility='public' AND e.hidden=0 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=e.author_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=e.author_id))))`;
export async function readTravel(q:Sql,id:string,uid=''){
 return (await q.execute({sql:`SELECT e.*,u.pen_name,u.seal_text FROM travel_entries e JOIN public_users u ON u.id=e.author_id WHERE e.id=? AND ${audience}`,args:[id,uid,uid,uid]})).rows[0];
}
export async function listTravel(q:Sql,uid='',options:{region?:string;query?:string;offset?:number;pins?:boolean;own?:boolean}={}){
 const args:(string|number)[]=[];
 let where=options.own?'e.author_id=?':`e.visibility='public' AND e.hidden=0 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=e.author_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=e.author_id))`;
 args.push(uid);if(!options.own)args.push(uid);
 if(options.region&&options.region in TRAVEL_REGIONS){where+=' AND e.region=?';args.push(options.region);}
 const query=plainText(options.query,80);if(query){where+=' AND instr(lower(e.title || \' \' || e.place_name || \' \' || e.country_label),lower(?))>0';args.push(query);}
 args.push(options.pins?300:20,options.pins?0:options.offset||0);
 return (await q.execute({sql:`SELECT e.id,e.author_id,e.title,e.place_name,e.canonical_name,e.country_label,e.longitude,e.latitude,e.region,e.location_kind,e.visibility,e.hidden,e.created_at,u.pen_name FROM travel_entries e JOIN public_users u ON u.id=e.author_id WHERE ${where} ORDER BY e.created_at DESC,e.id LIMIT ? OFFSET ?`,args})).rows;
}
export async function travelMutation(client:Client,actor:string,op:string,data:Record<string,string>,timestamp?:number):Promise<{id?:string}>{
 const tx=await client.transaction('write'),now=timestamp??Date.now();
 try{
  const me=await active(tx,actor);let result:{id?:string}={};
  if(op==='save'){
   const old=data.id?(await tx.execute({sql:'SELECT * FROM travel_entries WHERE id=? AND author_id=?',args:[data.id,actor]})).rows[0]:null;
   if(data.id&&!old)throw new Error('只能修改自己的游记');
   const key=plainText(data.send_key,80,16);
   const duplicate=!data.id?(await tx.execute({sql:'SELECT id FROM travel_entries WHERE author_id=? AND send_key=?',args:[actor,key]})).rows[0]:null;
   if(duplicate)result.id=String(duplicate.id);
   else{
    const revision=Number(data.revision||0);
    if(!Number.isSafeInteger(revision)||revision<0||old&&revision!==Number(old.revision))throw new Error('另一页已修改，请刷新后接续');
    const title=plainText(data.title,80,1),body=workBody(data.body);
    const visibility=data.visibility==='public'?'public':'private';
    if(visibility==='public'&&data.consent!=='on')throw new Error('请明确确认公开正文、雅号和地点');
    let point,placeId:null|string=null,canonical='',country='',region='',kind='manual';
    const place= data.location_kind==='catalog'?findPlace(data.place_id||''):null;
    if(data.location_kind==='catalog'&&!place)throw new Error('请重新选择资料库地点');
    if(place){point=coordinates(place.longitude,place.latitude);placeId=place.id;canonical=place.name;country=place.country;region=place.region;kind='catalog';}
    else{point=coordinates(data.longitude,data.latitude);region=regionForPoint(point.longitude,point.latitude);}
    const placeName=plainText(data.place_name,100)||canonical;if(!placeName)throw new Error('请题写地点名称');
    await allowance(tx,actor,'travel-save',now,20);
    const id=old?String(old.id):crypto.randomUUID();
    if(old)await tx.execute({sql:'UPDATE travel_entries SET title=?,body=?,place_name=?,place_id=?,canonical_name=?,country_label=?,longitude=?,latitude=?,region=?,location_kind=?,visibility=?,revision=revision+1,updated_at=? WHERE id=? AND author_id=?',args:[title,body,placeName,placeId,canonical,country,point.longitude,point.latitude,region,kind,visibility,now,id,actor]});
    else await tx.execute({sql:'INSERT INTO travel_entries(id,author_id,title,body,place_name,place_id,canonical_name,country_label,longitude,latitude,region,location_kind,visibility,created_at,updated_at,send_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[id,actor,title,body,placeName,placeId,canonical,country,point.longitude,point.latitude,region,kind,visibility,now,now,key]});
    result.id=id;
   }
  }else if(op==='private'){
   const r=await tx.execute({sql:"UPDATE travel_entries SET visibility='private',revision=revision+1,updated_at=? WHERE id=? AND author_id=?",args:[now,data.id,actor]});if(!r.rowsAffected)throw new Error('只能收回自己的游记');
  }else if(op==='report'){
   const e=await readTravel(tx,data.id,actor);if(!e||e.visibility!=='public'||Number(e.hidden))throw new Error('此游记不可访问');
   await allowance(tx,actor,'travel-report',now,10);
   await tx.execute({sql:'INSERT OR IGNORE INTO travel_reports(id,entry_id,reporter_id,reason,title_snapshot,body_snapshot,created_at) VALUES(?,?,?,?,?,?,?)',args:[crypto.randomUUID(),data.id,actor,plainText(data.reason,500,1),String(e.title),String(e.body),now]});
  }else if(op==='moderate'){
   if(me.role!=='admin')throw new Error('无权处理');
   const r=(await tx.execute({sql:'SELECT 1 FROM travel_reports WHERE entry_id=?',args:[data.id]})).rows[0];if(!r)throw new Error('只能处理已反馈的游记');
   await tx.execute({sql:'UPDATE travel_entries SET hidden=? WHERE id=?',args:[data.restore==='on'?0:1,data.id]});
   await tx.execute({sql:'INSERT INTO admin_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',args:[crypto.randomUUID(),actor,data.restore==='on'?'travel_restore':'travel_hide',data.id,now]});
  }else throw new Error('无法识别这项操作');
  await tx.commit();return result;
 }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
