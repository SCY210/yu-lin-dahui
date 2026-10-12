import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareTreasureForm,formWriteRequestId} from '../lib/client/treasure-write';

test('ambiguous response retries preserve one request key until a new shop confirmation',()=>{
 let next=0;const makeId=()=>String(++next);
 for(const action of ['treasureRedeem','treasureProduct','treasureGrant','treasureOrder']){
  const form=prepareTreasureForm({title:'Confirm',action,values:{quantity:1},fields:[]},makeId),id=formWriteRequestId(form,action,makeId);
  assert.equal(formWriteRequestId(form,action,makeId),id);
  const updated={...form,values:{...form.values,quantity:2}};
  assert.equal(formWriteRequestId(updated,action,makeId),id,'shared form input updates preserve metadata');
  const reopened=prepareTreasureForm({...form,values:{quantity:1}},makeId);
  assert.notEqual(formWriteRequestId(reopened,action,makeId),id,'explicit new confirmation is a new action');
  assert.notEqual(formWriteRequestId(form,'anotherAction',makeId),id);
 }
});
test('ordinary and non-form actions continue generating separate request IDs',()=>{
 let next=0;const makeId=()=>String(++next),form=prepareTreasureForm({title:'Edit',action:'profile',values:{},fields:[]},makeId);
 assert.equal('writeRequestId' in form,false);
 assert.notEqual(formWriteRequestId(form,'profile',makeId),formWriteRequestId(form,'profile',makeId));
 assert.notEqual(formWriteRequestId(null,'treasureRedeem',makeId),formWriteRequestId(null,'treasureRedeem',makeId));
});
test('manual rating and points forms keep one request ID across an ambiguous response',()=>{
 let next=0;const makeId=()=>String(++next);
 const form=prepareTreasureForm({title:'Raise rating',action:'grantPoints',values:{playerId:'p',points:0,rating:100},fields:[]},makeId);
 const first=formWriteRequestId(form,'grantPoints',makeId);
 assert.equal(formWriteRequestId({...form,values:{...form.values,rating:150}},'grantPoints',makeId),first);
 const reopened=prepareTreasureForm({...form},makeId);assert.notEqual(formWriteRequestId(reopened,'grantPoints',makeId),first);
});
