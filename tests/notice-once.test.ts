import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type AccountNoticeReceipt} from '../lib/domain/types';
import {accountNoticeView,requiresAccountNotice} from '../lib/domain/notice-gate';
const account={id:'member',playerId:'player',email:'',role:'member' as const};
const latest={version:'latest',contentHash:'a'.repeat(64),contentSnapshot:'latest text'};
const receipt:AccountNoticeReceipt={id:'receipt',accountId:'member',playerId:'player',version:'original',contentHash:'b'.repeat(64),contentSnapshot:'original text',acceptedAt:1234,method:'explicit-account-confirmation'};
test('account confirmation survives later versions without claiming acceptance of their text',()=>{
 const s=emptyState();s.accountNoticeReceipts=[structuredClone(receipt)];const original=structuredClone(s);
 for(let i=0;i<3;i++){const v=accountNoticeView(s,account,{...latest,version:'release-'+i});assert.equal(v.required,false);assert.equal(v.acceptedAt,1234);assert.equal(v.acceptedVersion,'original');assert.equal(v.currentConfirmed,false)}
 assert.equal(requiresAccountNotice(s,account,latest),false);assert.deepEqual(s,original);
});
test('another account or activity registration cannot replace personal entry confirmation',()=>{
 const s=emptyState();s.accountNoticeReceipts=[{...receipt,accountId:'another-member'}];assert.equal(accountNoticeView(s,account,latest).required,true);assert.equal(accountNoticeView(s,account,latest).acceptedAt,null);
});
test('invalid historical receipt does not silently unlock first entry',()=>{
 for(const invalid of [{acceptedAt:-1},{contentHash:''},{contentSnapshot:''}]){const s=emptyState();s.accountNoticeReceipts=[{...receipt,...invalid}];assert.equal(accountNoticeView(s,account,latest).required,true)}
});
