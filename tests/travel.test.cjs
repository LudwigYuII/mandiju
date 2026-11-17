const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mdj-travel-'));process.env.MDJ_DB=path.join(dir,'site.db');process.env.MDJ_ADMIN_PASS='isolated-travel-admin-pass';
const {db,waitDb}=require('../lib/db.ts');const {travelMutation,readTravel,listTravel}=require('../lib/travel-service.ts');const {searchPlaces,findPlace,regionForPoint}=require('../lib/geography.ts');const {coordinates}=require('../lib/travel-policy.ts');const {studyMutation}=require('../lib/study-service.ts');const {upgradeSchema}=require('../lib/schema-upgrades.ts');
test('offline geography covers global places, bilingual search and finite rounded coordinates',()=>{
 for(const name of ['上海','京都','撒马尔罕','Hong Kong','Singapore','London','São Paulo','Cape Town','Sydney'])assert.ok(searchPlaces(name).length,name);
 assert.equal(searchPlaces('上海')[0].region,'asia');assert.equal(searchPlaces('Singapore')[0].region,'asia');assert.equal(searchPlaces('Hong Kong')[0].region,'asia');
 assert.equal(regionForPoint(121.47,31.23),'asia');assert.equal(regionForPoint(0,0),'ocean');
 assert.deepEqual(coordinates('12.345','-34.567'),{longitude:12.35,latitude:-34.57});
 for(const pair of [['',''],['Infinity',0],['NaN',0],[181,1],[0,91]])assert.throws(()=>coordinates(...pair));
 assert.equal(findPlace('forged-place-id'),null);
});
test('travel transactions keep private text and coordinates out of maps and enforce deliberate publication, revisions and withdrawal',async()=>{
 try{
  await waitDb();const now=Date.now();for(const [id,name]of [['a','甲笺'],['b','乙笺'],['c','丙笺']])await db.execute({sql:'INSERT INTO users(id,email,pen_name,password_hash,literary_name,created_at) VALUES(?,?,?,?,?,?)',args:[id,id+'@example.test',name,'not-a-login',name,now]});
  const run=(a,op,d)=>travelMutation(db,a,op,d,now),sh=searchPlaces('上海')[0];
  const input={title:'PRIVATE_TRAVEL_TITLE',body:'  PRIVATE_TRAVEL_BODY\n\n',location_kind:'catalog',place_id:sh.id,longitude:'0',latitude:'0',send_key:'travel-private-key01'};
  const {id}=await run('a','save',input);assert.equal((await run('a','save',input)).id,id);
  assert.equal((await readTravel(db,id,'a')).visibility,'private');assert.equal(Number((await readTravel(db,id,'a')).longitude),sh.longitude,'server uses catalog coordinates, not forged client values');
  assert.equal((await readTravel(db,id,'a')).body,input.body);for(const uid of ['','b']){assert.equal(await readTravel(db,id,uid),undefined);assert.equal((await listTravel(db,uid,{pins:true})).length,0);}
  assert.equal((await listTravel(db,'a',{own:true})).length,1);assert.equal((await listTravel(db,'a',{pins:true})).length,0,'owner private entries never become public pins');
  await assert.rejects(()=>run('b','save',{...input,id}),/自己的/);
  await assert.rejects(()=>run('a','save',{...input,id,visibility:'public'}),/确认/);
  await run('a','save',{...input,id,visibility:'public',consent:'on',revision:'0'});
  assert.equal((await listTravel(db,'b',{pins:true})).length,1);assert.equal((await listTravel(db,'b',{region:'europe'})).length,0);assert.equal((await listTravel(db,'b',{region:'asia',query:'上海'})).length,1);
  await assert.rejects(()=>run('a','save',{...input,id,revision:'0'}),/另一页/);
  await run('b','report',{id,reason:'测试反馈'});
  await run('a','private',{id});assert.equal(await readTravel(db,id,'b'),undefined);assert.equal((await listTravel(db,'b',{pins:true})).length,0);
  await run('a','save',{...input,id,revision:'2',body:'NEW_PRIVATE_BODY'});
  assert.equal((await db.execute('SELECT body_snapshot FROM travel_reports')).rows[0].body_snapshot,input.body,'report must not follow later private edits');
  await run('a','save',{...input,id,revision:'3',visibility:'public',consent:'on'});
  await studyMutation(db,'b','block',{target:'a'},now);assert.equal(await readTravel(db,id,'b'),undefined);assert.equal((await listTravel(db,'b',{pins:true})).length,0);
  await studyMutation(db,'b','unblock',{target:'a'},now);assert.ok(await readTravel(db,id,'b'));
  const manual=await run('a','save',{title:'旧称',body:'城中往事',place_name:'临安',location_kind:'manual',longitude:'120.1555',latitude:'30.2744',send_key:'travel-manual-key001'});const m=await readTravel(db,manual.id,'a');assert.equal(m.place_name,'临安');assert.equal(m.region,'asia');assert.equal(Number(m.longitude),120.16);
  await assert.rejects(()=>run('a','save',{...input,place_id:'invalid',send_key:'invalid-place-key01'}),/重新选择/);
  await assert.rejects(()=>run('a','save',{title:'bad',body:'bad',longitude:'Infinity',latitude:'0',place_name:'bad',send_key:'invalid-point-key01'}),/范围/);
  const admin=String((await db.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")).rows[0].id);await db.execute({sql:"UPDATE users SET literary_name='站主' WHERE id=?",args:[admin]});
  await assert.rejects(()=>run('b','moderate',{id}),/无权/);await run(admin,'moderate',{id});assert.equal(await readTravel(db,id,'b'),undefined);assert.equal((await listTravel(db,'b',{pins:true})).length,0);assert.ok(await readTravel(db,id,'a'));
  await run('a','private',{id});await run(admin,'moderate',{id,restore:'on'});assert.equal(await readTravel(db,id,'b'),undefined,'moderation restore cannot override withdrawal');
  assert.equal(Number((await db.execute("SELECT COUNT(*) n FROM admin_audit WHERE action LIKE 'travel_%'")).rows[0].n),2);
  await upgradeSchema(db);assert.equal((await readTravel(db,id,'a')).body,input.body);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
