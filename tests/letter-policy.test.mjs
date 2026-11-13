import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadLetter, canInteractWithLetter } from '../lib/letter-policy.ts';
const letter = {author_id:'a',recipient_id:'b',deliver_at:200,postage:'surface'};
test('private letters stay hidden from recipients before delivery and outsiders always',()=>{
 assert.equal(canReadLetter(letter,'a',100),true);
 for(const uid of ['b','c',null]) assert.equal(canReadLetter(letter,uid,100),false);
 assert.equal(canReadLetter(letter,'b',200),true);
 assert.equal(canReadLetter(letter,'c',200),false);
});
test('public letters and interactions require actual delivery',()=>{
 const pub={...letter,recipient_id:null};
 assert.equal(canReadLetter(pub,null,100),false); assert.equal(canReadLetter(pub,null,200),true);
 assert.equal(canInteractWithLetter(letter,'a',100),false);
 assert.equal(canInteractWithLetter(letter,'b',200),true);
 assert.equal(canInteractWithLetter({...letter,burned:1},'b',200),false);
});
test('old time capsules keep their unlock promise',()=>{
 const capsule={...letter,recipient_id:'a',postage:'capsule'};
 assert.equal(canReadLetter(capsule,'a',100),false);assert.equal(canReadLetter(capsule,'a',200),true);
});
