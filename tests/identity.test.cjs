const test=require('node:test');const assert=require('node:assert/strict');
const {normalizeLiteraryName}=require('../lib/literary-name.ts');
const {createClient}=require('@libsql/client');const {upgradeSchema}=require('../lib/schema-upgrades.ts');
test('literary identity canonicalizes simplified/traditional and rejects reserved or unsafe names',()=>{
 assert.equal(normalizeLiteraryName('聽雨').key,normalizeLiteraryName('听雨').key);
 for(const value of ['管理员','慢遞局','<script>','一','五个汉字呀','雨\u200b声'])assert.throws(()=>normalizeLiteraryName(value));
 assert.equal(normalizeLiteraryName('  山雨  ').name,'山雨');
});
test('identity migration hides historic names while keeping original accounts and delivery promises',async()=>{
 const db=createClient({url:':memory:'});
 try {
 for(const sql of ["CREATE TABLE users(id TEXT PRIMARY KEY,pen_name TEXT,seal_text TEXT)","CREATE TABLE letters(id TEXT PRIMARY KEY,author_id TEXT,recipient_id TEXT,deliver_at INTEGER,postage TEXT)","CREATE TABLE drafts(id TEXT)","CREATE TABLE notifications(id TEXT)"])await db.execute(sql);
 await db.execute("INSERT INTO users VALUES('original-user','旧账号姓名','旧印')");
 await db.execute("INSERT INTO letters VALUES('capsule','original-user','original-user',999,'capsule')");
 await upgradeSchema(db);await upgradeSchema(db);
 assert.equal((await db.execute('SELECT pen_name FROM users')).rows[0].pen_name,'旧账号姓名');
 assert.ok(!(await db.execute('SELECT pen_name FROM public_users')).rows[0].pen_name.includes('旧账号姓名'));
 await db.execute("UPDATE users SET literary_name='听雨',literary_key='听雨',seal_style='yin' WHERE id='original-user'");
 assert.equal((await db.execute('SELECT seal_text FROM public_users')).rows[0].seal_text,'yin:听雨');
 assert.equal((await db.execute('SELECT deliver_at FROM letters')).rows[0].deliver_at,999);
 }finally{db.close();}
});
