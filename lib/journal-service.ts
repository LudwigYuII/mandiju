import type {Client,Transaction} from '@libsql/client';
import {active,allowance} from './literary-service';
import {plainText,workBody} from './literary-policy';
type Sql=Pick<Client,'execute'>|Pick<Transaction,'execute'>;
export const JOURNAL_STATES:Record<string,string>={draft:'草稿',open:'征稿中',proof:'校对中',published:'已刊行',withdrawn:'已撤回'};
export const SUBMISSION_STATES:Record<string,string>={draft:'私存草稿',submitted:'已投稿',selected:'已选入校样',declined:'未选入',withdrawn:'已撤稿'};
const publicCondition=`s.state='selected' AND s.hidden=0 AND u.banned=0 AND s.approved_revision=s.revision AND s.approved_issue_revision=i.revision AND s.publish_consent_at IS NOT NULL`;
const blockCondition=`NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id=s.author_id AND b.blocked_id=?) OR (b.blocker_id=? AND b.blocked_id=s.author_id))`;
export async function journalIssue(q:Sql,id:string){return(await q.execute({sql:'SELECT * FROM journal_issues WHERE id=?',args:[id]})).rows[0];}
export async function publishedJournal(q:Sql,id:string,viewer=''){
 const issue=await journalIssue(q,id);if(!issue||issue.state!=='published')return null;
 const entries=(await q.execute({sql:`SELECT s.id,s.title,s.body,s.byline,s.section,s.author_id,s.position FROM journal_submissions s JOIN users u ON u.id=s.author_id JOIN journal_issues i ON i.id=s.issue_id WHERE s.issue_id=? AND ${publicCondition} AND ${blockCondition} ORDER BY s.position,s.created_at,s.id`,args:[id,viewer,viewer]})).rows;
 return {issue,entries};
}
export async function ownSubmission(q:Sql,id:string,viewer:string){return(await q.execute({sql:'SELECT * FROM journal_submissions WHERE id=? AND author_id=?',args:[id,viewer]})).rows[0];}
export async function journalMutation(client:Client,actor:string,op:string,data:Record<string,string>,timestamp?:number):Promise<{id?:string;issue?:string}>{
 const tx=await client.transaction('write'),now=timestamp??Date.now();
 try{
  const me=await active(tx,actor);let result:{id?:string;issue?:string}={};
  const admin=()=>{if(me.role!=='admin')throw Error('仅站长可编选季刊');};
  const audit=async(action:string,target:string)=>{await tx.execute({sql:'INSERT INTO admin_audit(id,actor_id,action,target_id,created_at) VALUES(?,?,?,?,?)',args:[crypto.randomUUID(),actor,'journal_'+action,target,now]});};
  const revision=(old:Record<string,unknown>)=>{if(String(old.revision)!==data.revision)throw Error('版本已变化，请刷新后核对');};
  const issueRevision=(old:Record<string,unknown>)=>{if(String(old.revision)!==data.issue_revision)throw Error('刊期编排已变化，请刷新后核对');};
  if(op==='issue-save'){
   admin();const old=data.id?await journalIssue(tx,data.id):null;if(data.id&&!old)throw Error('刊期不存在');
   if(old){revision(old);if(['published','withdrawn'].includes(String(old.state)))throw Error('已刊行或撤回的刊期不能改写');}
   else{const dup=(await tx.execute({sql:'SELECT id FROM journal_issues WHERE send_key=?',args:[plainText(data.send_key,80,16)]})).rows[0];if(dup){await tx.commit();return{issue:String(dup.id)};}}
   const title=plainText(data.title,80,1),period=plainText(data.period,40,1),foreword=String(data.foreword||'');if(foreword.length>3000)throw Error('刊首语最多三千字');
   const id=old?String(old.id):crypto.randomUUID();
   if(old)await tx.execute({sql:'UPDATE journal_issues SET title=?,period=?,foreword=?,revision=revision+1 WHERE id=?',args:[title,period,foreword,id]});
   else await tx.execute({sql:'INSERT INTO journal_issues(id,title,period,foreword,created_by,created_at,send_key) VALUES(?,?,?,?,?,?,?)',args:[id,title,period,foreword,actor,now,data.send_key]});
   await audit('issue_edit',id);result.issue=id;
  }else if(op==='issue-state'){
   admin();const issue=await journalIssue(tx,data.id);if(!issue)throw Error('刊期不存在');revision(issue);
   const state=data.state,old=String(issue.state);
   if(state==='withdrawn'&&old==='published'){
    if(data.consent!=='on')throw Error('请确认撤回全期在线阅读与PDF');
   }else if(state==='published'){
    if(old!=='proof'||data.consent!=='on')throw Error('请在校对后确认刊行');
    const all=(await tx.execute({sql:"SELECT s.*,u.banned FROM journal_submissions s JOIN users u ON u.id=s.author_id WHERE s.issue_id=? AND s.state='selected'",args:[data.id]})).rows;
    if(!all.length||all.length>24)throw Error('每期需选入一至二十四篇');
    if(all.some(s=>Number(s.hidden)||Number(s.banned)||s.approved_revision===null||Number(s.approved_revision)!==Number(s.revision)||s.approved_issue_revision===null||Number(s.approved_issue_revision)!==Number(issue.revision)||!s.publish_consent_at))throw Error('每篇选稿均须作者确认当前校样与刊期版本');
   }else if(!(['draft','open','proof'].includes(state)&&['draft','open','proof'].includes(old)))throw Error('不可进行此状态变更');
   // State transitions do not alter the approved issue metadata/revision. Reopening still forbids publication until proof.
   await tx.execute({sql:'UPDATE journal_issues SET state=?,published_at=CASE WHEN ?=\'published\' THEN ? ELSE published_at END WHERE id=?',args:[state,state,now,data.id]});
   await audit('issue_'+state,data.id);result.issue=data.id;
  }else if(op==='save'){
   const old=data.id?await ownSubmission(tx,data.id,actor):null;if(data.id&&!old)throw Error('只能修改自己的稿件');
   const issue=await journalIssue(tx,old?String(old.issue_id):data.issue_id);if(!issue||!['open','proof'].includes(String(issue.state)))throw Error('此刊期暂不收稿');
   if(old){revision(old);if(old.state==='withdrawn')throw Error('已撤稿，请另起新稿');}
   else{const key=plainText(data.send_key,80,16),dup=(await tx.execute({sql:'SELECT id,issue_id FROM journal_submissions WHERE author_id=? AND send_key=?',args:[actor,key]})).rows[0];if(dup){await tx.commit();return{id:String(dup.id),issue:String(dup.issue_id)};}}
   const title=plainText(data.title,80,1),body=workBody(data.body),byline=plainText(data.byline,40,1),submit=data.submit==='on';
   if(submit&&data.review_consent!=='on')throw Error('投稿前请授权编辑审阅此版本');
   if(!old&&issue.state!=='open')throw Error('校对中不接收新稿');
   const state=old?.state==='selected'?'selected':submit?'submitted':'draft';
   await allowance(tx,actor,'journal-save',now,30);
   const id=old?String(old.id):crypto.randomUUID();
   if(old)await tx.execute({sql:'UPDATE journal_submissions SET title=?,body=?,byline=?,state=?,revision=revision+1,approved_revision=NULL,approved_issue_revision=NULL,publish_consent_at=NULL,reviewed_at=?,updated_at=? WHERE id=?',args:[title,body,byline,state,state==='draft'?null:now,now,id]});
   else await tx.execute({sql:'INSERT INTO journal_submissions(id,issue_id,author_id,title,body,byline,state,created_at,updated_at,reviewed_at,send_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)',args:[id,String(issue.id),actor,title,body,byline,state,now,now,submit?now:null,data.send_key]});
   if(state==='selected'&&!submit)throw Error('选稿修订需再次授权编辑审阅');
   result={id,issue:String(issue.id)};
  }else if(op==='withdraw'){
   const s=await ownSubmission(tx,data.id,actor);if(!s)throw Error('只能撤回自己的稿件');revision(s);
   await tx.execute({sql:"UPDATE journal_submissions SET state='withdrawn',revision=revision+1,approved_revision=NULL,approved_issue_revision=NULL,publish_consent_at=NULL,updated_at=? WHERE id=?",args:[now,data.id]});
   result={id:data.id,issue:String(s.issue_id)};
  }else if(op==='select'||op==='propose'){
   admin();const s=(await tx.execute({sql:"SELECT * FROM journal_submissions WHERE id=? AND state IN ('submitted','selected','declined')",args:[data.id]})).rows[0];if(!s)throw Error('只能编选已授权审阅的稿件');revision(s);
   const issue=await journalIssue(tx,String(s.issue_id));if(!issue||!['open','proof'].includes(String(issue.state)))throw Error('刊期已封存或未开放');issueRevision(issue);
   if(op==='select'){
    const state=data.selected==='on'?'selected':'declined';
    if(state==='selected'){const n=(await tx.execute({sql:"SELECT COUNT(*) n FROM journal_submissions WHERE issue_id=? AND state='selected' AND id<>?",args:[String(issue.id),data.id]})).rows[0];if(Number(n.n)>=24)throw Error('每期最多二十四篇');}
    const position=Number(data.position);if(!Number.isSafeInteger(position)||position<0||position>999)throw Error('篇序须在零至九百九十九之间');
    await tx.execute({sql:'UPDATE journal_submissions SET state=?,position=?,section=?,revision=revision+1,approved_revision=NULL,approved_issue_revision=NULL,publish_consent_at=NULL,updated_at=? WHERE id=?',args:[state,position,plainText(data.section,40),now,data.id]});
    await tx.execute({sql:'UPDATE journal_issues SET revision=revision+1 WHERE id=?',args:[String(issue.id)]});
   }else{
    await tx.execute({sql:'UPDATE journal_submissions SET title=?,body=?,editor_note=?,revision=revision+1,approved_revision=NULL,approved_issue_revision=NULL,publish_consent_at=NULL,updated_at=? WHERE id=?',args:[plainText(data.title,80,1),workBody(data.body),plainText(data.editor_note,500,1),now,data.id]});
   }
   await audit(op,data.id);result.issue=String(issue.id);
  }else if(op==='approve'){
   const s=await ownSubmission(tx,data.id,actor);if(!s||s.state!=='selected')throw Error('仅能确认自己的选稿');revision(s);
   const issue=await journalIssue(tx,String(s.issue_id));if(!issue||issue.state!=='proof')throw Error('请待编排完成后再确认校样');issueRevision(issue);
   if(Number(s.hidden))throw Error('此稿暂不可刊行');if(data.consent!=='on')throw Error('请确认此版本公开及PDF收录授权');
   await tx.execute({sql:'UPDATE journal_submissions SET approved_revision=revision,approved_issue_revision=?,publish_consent_at=?,updated_at=? WHERE id=?',args:[Number(issue.revision),now,now,data.id]});result={id:data.id,issue:String(issue.id)};
  }else if(op==='report'){
   const s=(await tx.execute({sql:`SELECT s.* FROM journal_submissions s JOIN journal_issues i ON i.id=s.issue_id JOIN users u ON u.id=s.author_id WHERE s.id=? AND i.state='published' AND ${publicCondition} AND ${blockCondition}`,args:[data.id,actor,actor]})).rows[0];if(!s)throw Error('稿件不可访问');
   await allowance(tx,actor,'journal-report',now,10);
   await tx.execute({sql:'INSERT OR IGNORE INTO journal_reports(id,submission_id,reporter_id,reason,title_snapshot,body_snapshot,created_at) VALUES(?,?,?,?,?,?,?)',args:[crypto.randomUUID(),data.id,actor,plainText(data.reason,500,1),String(s.title),String(s.body),now]});
  }else if(op==='moderate'){
   admin();const reason=plainText(data.reason,500,1);const s=(await tx.execute({sql:'SELECT id,issue_id FROM journal_submissions WHERE id=? AND state<>\'draft\'',args:[data.id]})).rows[0];if(!s)throw Error('稿件不存在');
   await tx.execute({sql:'UPDATE journal_submissions SET hidden=? WHERE id=?',args:[data.restore==='on'?0:1,data.id]});await audit((data.restore==='on'?'restore:':'hide:')+reason,data.id);result.issue=String(s.issue_id);
  }else throw Error('无法识别这项操作');
  await tx.commit();return result;
 }catch(e){await tx.rollback();throw e;}finally{tx.close();}
}
