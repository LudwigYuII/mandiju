const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mdj-reading-'));process.env.MDJ_DB=path.join(dir,'site.db');process.env.MDJ_ADMIN_PASS='isolated-reading-admin-pass';
const {db,waitDb}=require('../lib/db.ts');
const {ensureReadingDay,readReadingDay,readOwnReading,readReadingNotes,readingMutation}=require('../lib/reading-service.ts');
const {ensureSeasonalGatherings,seasonalTheme}=require('../lib/seasonal-service.ts');
const {studyMutation}=require('../lib/study-service.ts');
const {upgradeSchema}=require('../lib/schema-upgrades.ts');
test('seasonal tone follows term boundaries and separates lunar festivals',()=>{
 assert.equal(seasonalTheme(new Date('2026-11-17T04:00Z')).id,'winter');
 const autumn=seasonalTheme(new Date('2026-09-25T04:00Z'));
 assert.ok(autumn.events.some(e=>e.name==='中秋'&&e.kind==='festival'));
 assert.ok(!autumn.events.some(e=>e.name==='中秋'&&e.kind==='term'));
});
test('daily reading keeps copies private, locks a daily edition and limits notes to the actual cohort',async()=>{
 try{
 await waitDb();const now=Date.parse('2026-11-17T04:00Z'),next=now+86400000;
 for(const [id,name]of [['a','甲笺'],['b','乙笺'],['c','丙笺']])await db.execute({sql:'INSERT INTO users(id,email,pen_name,password_hash,literary_name,created_at) VALUES(?,?,?,?,?,?)',args:[id,id+'@example.test',name,'not-a-login',name,now]});
 const day=await ensureReadingDay(db,new Date(now));const edition=await readReadingDay(db,day);
 assert.ok(edition.source_url.includes('oldid='));assert.equal(edition.license,'CC BY-SA 4.0');
 await Promise.all([ensureReadingDay(db,new Date(now)),ensureReadingDay(db,new Date(now))]);assert.equal((await readReadingDay(db,day)).passage_id,edition.passage_id);
 const run=(a,op,d,t=now)=>readingMutation(db,a,op,d,t),input={day,copy_body:'  PRIVATE_COPY\n\n',note:'COHORT_SHARED_NOTE',share:'on',consent:'on',revision:'0'};
 await assert.rejects(()=>run('a','save',{...input,consent:''}),/确认/);
 await run('a','save',input);assert.equal((await readOwnReading(db,day,'a')).copy_body,input.copy_body);
 for(const uid of ['','b','c'])assert.equal((await readReadingNotes(db,day,uid)).length,0);
 await run('b','save',{day,consent:'on'});const notes=await readReadingNotes(db,day,'b');assert.equal(notes[0].note,input.note);assert.ok(!JSON.stringify(notes).includes('PRIVATE_COPY'));assert.equal(notes[0].copy_body,undefined);
 await assert.rejects(()=>run('c','report',{id:String(notes[0].id),reason:'越权'}),/不可访问/);
 await run('b','report',{id:String(notes[0].id),reason:'测试反馈'});
 await run('a','save',{...input,note:'NEW_PRIVATE_NOTE',share:'',revision:'0'});
 assert.equal((await readReadingNotes(db,day,'b')).length,0);
 assert.equal((await db.execute('SELECT note_snapshot FROM reading_reports')).rows[0].note_snapshot,input.note,'report evidence cannot follow later private edits');
 await assert.rejects(()=>run('a','save',input),/另一页/);
 await run('a','save',{...input,revision:'1'});
 await studyMutation(db,'b','block',{target:'a'},now);assert.equal((await readReadingNotes(db,day,'b')).length,0);
 await studyMutation(db,'b','unblock',{target:'a'},now);assert.equal((await readReadingNotes(db,day,'b')).length,1);
 const admin=String((await db.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")).rows[0].id);await db.execute({sql:"UPDATE users SET literary_name='站主' WHERE id=?",args:[admin]});
 await assert.rejects(()=>run('b','moderate',{id:String(notes[0].id)}),/无权/);
 await run(admin,'moderate',{id:String(notes[0].id)});assert.equal((await readReadingNotes(db,day,'b')).length,0);
 await run(admin,'moderate',{id:String(notes[0].id),restore:'on'});assert.equal((await readReadingNotes(db,day,'b')).length,1);
 await ensureReadingDay(db,new Date(next));
 await assert.rejects(()=>run('c','save',{...input},next),/已收卷/);
 await run('c','save',{day:'2026-11-18',consent:'on'},next);assert.equal((await readReadingNotes(db,day,'c')).length,0,'another day does not grant old cohort access');
 assert.equal((await readReadingNotes(db,day,'b')).length,1,'original cohort can revisit old notes');
 await run('a','unshare',{id:String(notes[0].id)},next);assert.equal((await readReadingNotes(db,day,'b')).length,0);
 await run('b','leave',{id:String((await readOwnReading(db,day,'b')).id)},next);assert.equal((await readReadingNotes(db,day,'b')).length,0);
 assert.equal((await readOwnReading(db,day,'a')).copy_body,input.copy_body);
 // Seasonal cron and simultaneous page visits share one canonical twelve-seat gathering.
 const when=new Date('2026-12-22T04:00Z');assert.ok(seasonalTheme(when).events.some(e=>e.name==='冬至'));
 const [one,two]=await Promise.all([ensureSeasonalGatherings(db,when),ensureSeasonalGatherings(db,when)]);assert.equal(one.length,1);assert.equal(one[0],two[0]);
 const room=(await db.execute({sql:'SELECT * FROM literary_spaces WHERE id=?',args:[one[0]]})).rows[0];assert.equal(room.kind,'gathering');assert.equal(room.visibility,'public');assert.equal(Number(room.capacity),12);assert.equal(room.event_timezone,'Asia/Shanghai');
 await db.execute({sql:'UPDATE literary_spaces SET hidden=1 WHERE id=?',args:[one[0]]});assert.equal((await ensureSeasonalGatherings(db,when))[0],one[0],'hidden seasonal gatherings are never recreated');
 await upgradeSchema(db);assert.equal((await readOwnReading(db,day,'a')).copy_body,input.copy_body);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
