"use server";
import { db,waitDb } from "./db";
import { getSession } from "./auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalizeLiteraryName } from "./literary-name";
import { siteDateStart } from "./time";
import type { ActionState } from "./actions";
export async function setIdentityAction(_:ActionState, data:FormData):Promise<ActionState> {
 await waitDb(); const s=await getSession(); if(!s) redirect('/login');
 let n; try {n=normalizeLiteraryName(String(data.get('name')||''));} catch(e) {return {error:(e as Error).message};}
 const style=data.get('style')==='yin'?'yin':'yang';
 try {
 const result=await db.execute({sql:"UPDATE users SET literary_name=?,literary_key=?,seal_style=? WHERE id=? AND literary_name IS NULL",args:[n.name,n.key,style,s.uid]});
 if(!result.rowsAffected) return {error:'雅号已题定，暂未开放改名'};
 } catch {return {error:'此雅号已被使用，请换一个'};}
 revalidatePath('/','layout'); redirect('/');
}
export async function setRetreatAction(_:ActionState,data:FormData):Promise<ActionState> {
 await waitDb(); const s=await getSession(); if(!s) redirect('/login');
 const date=String(data.get('until')||''); const until=date?siteDateStart(date):0;
 if(until===null || (until!==0 && (until<=Date.now() || until>Date.now()+366*86400000))) return {error:'请选择未来一年内的出关日期'};
 const tx=await db.transaction('write');
 try {
 await tx.execute({sql:'UPDATE users SET retreat_until=? WHERE id=?',args:[until,s.uid]});
 // Only new ordinary letters still in transit participate. Existing delivery promises and capsules are untouched.
 await tx.execute({sql:"UPDATE letters SET deliver_at=MAX(original_deliver_at,?) WHERE recipient_id=? AND author_id<>recipient_id AND postage<>'capsule' AND original_deliver_at IS NOT NULL AND deliver_at>?",args:[until||Date.now(),s.uid,Date.now()]});
 await tx.commit();
 } catch {await tx.rollback();return {error:'闭关设置未保存，请重试'};} finally {tx.close();}
 revalidatePath('/','layout');return {ok:true};
}
export async function setSealStyleAction(_:ActionState,data:FormData):Promise<ActionState> {
 await waitDb(); const s=await getSession();if(!s) redirect('/login');
 await db.execute({sql:'UPDATE users SET seal_style=?,show_referrer=? WHERE id=?',args:[data.get('style')==='yin'?'yin':'yang',data.get('referrer')==='on'?1:0,s.uid]});
 revalidatePath('/','layout');return {ok:true};
}
