const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('@libsql/client');
const {playGo,readGame}=require('../lib/go-service.ts');

test('online Go restricts invitations, turns, revisions and scoring to the two players',async()=>{
  const db=createClient({url:':memory:'});
  try {
    for(const sql of [
      'CREATE TABLE public_users(id TEXT, pen_name TEXT, banned INTEGER)',
      'CREATE TABLE letters(author_id TEXT, recipient_id TEXT, deliver_at INTEGER, moderation_hidden INTEGER, burned INTEGER)',
      'CREATE TABLE user_blocks(blocker_id TEXT, blocked_id TEXT)',
      'CREATE TABLE go_games(id TEXT PRIMARY KEY, black_id TEXT, white_id TEXT, board TEXT, turn INTEGER DEFAULT 1, passes INTEGER DEFAULT 0, state TEXT DEFAULT \'invited\', revision INTEGER DEFAULT 0, dead TEXT DEFAULT \'\', accepted_by INTEGER DEFAULT 0, result TEXT DEFAULT \'\', updated_at INTEGER)',
      'CREATE TABLE go_positions(game_id TEXT, board TEXT, PRIMARY KEY(game_id,board))',
      "INSERT INTO public_users VALUES ('a','甲',0),('b','乙',0),('c','丙',0)",
      "INSERT INTO letters VALUES ('a','b',0,0,0)",
    ]) await db.execute(sql);
    await assert.rejects(playGo(db,'a',{op:'invite',peer:'丙'}),/通信/);
    const id=await playGo(db,'a',{op:'invite',peer:'乙'});
    const op=(user,command,revision,point)=>playGo(db,user,{id,op:command,revision:String(revision),point});
    assert.equal(await readGame(db,id,'c'),undefined);
    await assert.rejects(op('a','accept',0),/不可/);
    await op('b','accept',0);
    await assert.rejects(op('b','move',1,'0'),/回合/);
    await op('a','move',1,'0');
    await assert.rejects(op('a','move',1,'1'),/更新/);
    await op('b','pass',2);
    await op('a','pass',3);
    await op('a','score',4);
    await op('b','mark',5,'0');
    await op('b','score',6);
    assert.equal((await readGame(db,id,'a')).state,'scoring');
    await op('a','score',7);
    assert.equal((await readGame(db,id,'a')).state,'finished');
    await db.execute("INSERT INTO user_blocks VALUES ('b','a')");
    assert.equal(await readGame(db,id,'a'),undefined);
  } finally { db.close(); }
});
