import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertImageRights} from '../lib/image-rights';
import {RequestError} from '../lib/request-body';
import {legalNoticeState,imageRightsVersion,type LegalConfig} from '../lib/legal-notice';
import {legalConfig} from '../config/legal';

test('upload rights cannot be inferred from missing, unchecked or ambiguous form values',()=>{
 for(const value of [undefined,'false','1','TRUE','',new Blob(['true'])]){
  const form=new FormData();if(value!==undefined)form.set('rightsConfirmed',value);
  assert.throws(()=>assertImageRights(form),(error:unknown)=>error instanceof RequestError&&error.status===400);
 }
 const duplicates=new FormData();duplicates.append('rightsConfirmed','true');duplicates.append('rightsConfirmed','false');
 assert.throws(()=>assertImageRights(duplicates),RequestError);
});

test('an explicit single acknowledgement carries its policy version',()=>{
 const form=new FormData();form.set('rightsConfirmed','true');
 assert.deepEqual(assertImageRights(form),{rightsConfirmed:true,rightsVersion:imageRightsVersion});
});

test('incomplete or unsafe operator contact details keep a notice in draft state',()=>{
 assert.equal(legalNoticeState(legalConfig).configured,false);
 const complete:LegalConfig={operatorName:'Fictional operator',contactEmail:'privacy@example.invalid',operatorAddress:'Fictional postal contact',jurisdiction:'Fictional jurisdiction',legalBases:'Operator-reviewed bases',retention:'Operator-reviewed periods',processorsAndTransfers:'Operator-reviewed vendors',minorsPolicy:'Operator-reviewed scope',complaintAuthority:'Applicable authority'};
 assert.equal(legalNoticeState(complete).configured,true);
 for(const value of ['','   ','javascript:alert(1)','invalid address']){
  const state=legalNoticeState({...complete,contactEmail:value});
  assert.equal(state.configured,false);assert.equal(state.contactEmail,null);assert.ok(state.missing.includes('contactEmail'));
 }
 for(const key of Object.keys(complete)){
  assert.equal(legalNoticeState({...complete,[key]:' '}).configured,false);
 }
});
