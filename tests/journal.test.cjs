const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mdj-journal-'));process.env.MDJ_DB=path.join(dir,'site.db');process.env.MDJ_ADMIN_PASS='isolated-journal-admin-pass';
const{db,waitDb}=require('../lib/db.ts'),{journalMutation:mut,journalIssue,publishedJournal,ownSubmission}=require('../lib/journal-service.ts'),{journalPdf}=require('../lib/journal-pdf.ts');
test('quarterly publication requires deliberate review consent, current author proof and issue version; withdrawal and moderation reach every read',async()=>{
 try{
  await waitDb();const now=Date.now();for(const[id,name]of[['a','甲笺'],['b','乙笺']])await db.execute({sql:'INSERT INTO users(id,email,pen_name,password_hash,literary_name,created_at) VALUES(?,?,?,?,?,?)',args:[id,id+'@example.test',name,'not-a-login',name,now]});
  const admin=String((await db.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")).rows[0].id);await db.execute({sql:"UPDATE users SET literary_name='站主' WHERE id=?",args:[admin]});const run=(a,op,d)=>mut(db,a,op,d,now),issue=async()=>journalIssue(db,id),sub=async()=>ownSubmission(db,sid,'a');
  await assert.rejects(()=>run('a','issue-save',{title:'无权',period:'冬',send_key:'journal-issue-key01'}),/站长/);
  const {issue:id}=await run(admin,'issue-save',{title:'冬笺',period:'二〇二六年冬',foreword:'诸友成帙',send_key:'journal-issue-key01'});
  assert.equal(await publishedJournal(db,id),null);await run(admin,'issue-state',{id,revision:'0',state:'open'});
  const input={issue_id:id,title:'PRIVATE_JOURNAL_TITLE',body:'  PRIVATE_JOURNAL_BODY\n\n',byline:'甲笺',send_key:'journal-submission-01'};
  const{id:sid}=await run('a','save',input);assert.equal((await run('a','save',input)).id,sid);assert.equal((await sub()).state,'draft');assert.equal((await sub()).body,input.body);assert.equal(await ownSubmission(db,sid,'b'),undefined);
  await assert.rejects(()=>run('b','save',{...input,id:sid,revision:'0'}),/自己的/);
  await assert.rejects(()=>run(admin,'select',{id:sid,revision:'0',issue_revision:'0',selected:'on',position:'1'}),/授权/);
  await assert.rejects(()=>run('a','save',{...input,id:sid,revision:'0',submit:'on'}),/授权/);
  await run('a','save',{...input,id:sid,revision:'0',submit:'on',review_consent:'on'});
  await run(admin,'select',{id:sid,revision:'1',issue_revision:'0',selected:'on',position:'1',section:'行旅'});
  await assert.rejects(()=>run('a','approve',{id:sid,revision:'2',issue_revision:'1',consent:'on'}),/编排/);
  await run(admin,'issue-state',{id,revision:'1',state:'proof'});
  await assert.rejects(()=>run(admin,'issue-state',{id,revision:'1',state:'published',consent:'on'}),/每篇/);
  await assert.rejects(()=>run('b','approve',{id:sid,revision:'2',issue_revision:'1',consent:'on'}),/自己的/);
  await assert.rejects(()=>run('a','approve',{id:sid,revision:'2',issue_revision:'1'}),/授权/);
  await run('a','approve',{id:sid,revision:'2',issue_revision:'1',consent:'on'});
  await run(admin,'propose',{id:sid,revision:'2',issue_revision:'1',title:'冬行',body:'  修订稿\n\n繁體與简体',editor_note:'请核对'});
  await assert.rejects(()=>run(admin,'issue-state',{id,revision:'1',state:'published',consent:'on'}),/每篇/);
  await assert.rejects(()=>run('a','approve',{id:sid,revision:'2',issue_revision:'1',consent:'on'}),/版本/);
  await run('a','approve',{id:sid,revision:'3',issue_revision:'1',consent:'on'});
  await run(admin,'issue-save',{id,revision:'1',title:'冬笺定本',period:'二〇二六年冬',foreword:'新的刊首语'});
  await assert.rejects(()=>run(admin,'issue-state',{id,revision:'2',state:'published',consent:'on'}),/每篇/);
  await run('a','approve',{id:sid,revision:'3',issue_revision:'2',consent:'on'});
  await run(admin,'issue-state',{id,revision:'2',state:'published',consent:'on'});
  let book=await publishedJournal(db,id);assert.equal(book.entries.length,1);assert.equal(book.entries[0].body,'  修订稿\n\n繁體與简体');
  await assert.rejects(()=>run(admin,'propose',{id:sid,revision:'3',issue_revision:'2',title:'偷改',body:'偷改',editor_note:'偷改'}),/封存/);
  await assert.rejects(()=>run('a','save',{...input,id:sid,revision:'3',submit:'on',review_consent:'on'}),/不收稿/);
  await run('b','report',{id:sid,reason:'测试公开反馈'});
  await run(admin,'moderate',{id:sid,reason:'测试暂时隐藏'});assert.equal((await publishedJournal(db,id)).entries.length,0);
  await run(admin,'moderate',{id:sid,reason:'恢复',restore:'on'});assert.equal((await publishedJournal(db,id)).entries.length,1);
  await db.execute({sql:'INSERT INTO user_blocks(blocker_id,blocked_id,created_at) VALUES(?,?,?)',args:['b','a',now]});assert.equal((await publishedJournal(db,id,'b')).entries.length,0);assert.equal((await publishedJournal(db,id)).entries.length,1);
  await db.execute("UPDATE users SET banned=1 WHERE id='a'");assert.equal((await publishedJournal(db,id)).entries.length,0);await db.execute("UPDATE users SET banned=0 WHERE id='a'");
  await run('a','withdraw',{id:sid,revision:'3'});assert.equal((await publishedJournal(db,id)).entries.length,0);assert.equal((await sub()).body,'  修订稿\n\n繁體與简体');await run(admin,'moderate',{id:sid,reason:'不能越过撤稿',restore:'on'});assert.equal((await publishedJournal(db,id)).entries.length,0);
  assert.equal((await db.execute('SELECT body_snapshot FROM journal_reports')).rows[0].body_snapshot,'  修订稿\n\n繁體與简体');
  await run(admin,'issue-state',{id,revision:'2',state:'withdrawn',consent:'on'});assert.equal(await publishedJournal(db,id),null);
  await assert.rejects(()=>run(admin,'issue-state',{id,revision:'2',state:'published',consent:'on'}),/校对/);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('standalone quarterly PDF embeds CJK fonts, preserves text and annotations, paginates long prose and lists missing glyphs',()=>{
 const bytes=journalPdf({title:'冬笺',period:'二〇二六年冬',foreword:'刊首文字',entries:[{title:'湖畔小记',byline:'甲笺',section:'行旅',body:'繁體與简体 Café Grüße\n疏影[[梅|自注示例]]。\n'+'远行归来，静坐读书。'.repeat(700)+'\n𠮷'}]});
 assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.7');assert.ok(bytes.includes(Buffer.from('/FontFile2')));assert.ok(bytes.includes(Buffer.from('/ToUnicode')));assert.ok(bytes.includes(Buffer.from('/Count ')));
 const file=path.join(os.tmpdir(),'mdj-pdf-'+process.pid+'.pdf');try{fs.writeFileSync(file,bytes);const extracted=spawnSync('pdftotext',[file,'-'],{encoding:'utf8'});if(!extracted.error){assert.equal(extracted.status,0);for(const s of['繁體與简体','Café Grüße','自注示例','U+20BB7'])assert.ok(extracted.stdout.includes(s),s);assert.ok(extracted.stdout.split('\f').length>8);}}finally{fs.rmSync(file,{force:true});}
});
