import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newUsername,changeUsernameInput,canChangeOwnUsername} from '../lib/username-policy';

test('新登录账号仅允许2–32位原始ASCII字母数字，统一小写',()=>{
 for(const [input,expected]of [['Alpha123','alpha123'],['12','12'],[' ABC99 ','abc99'],['a'.repeat(32),'a'.repeat(32)]])assert.equal(newUsername.parse(input),expected);
 for(const input of ['a','a'.repeat(33),'中文账号','abc_def','abc-def','email@example.com','abc def','ＦＵＬＬ１２','аbc','éabc',"x' OR 1=1"])assert.equal(newUsername.safeParse(input).success,false);
});
test('登录账号自主修改机会按服务端标记判断，零时刻也表示已用，群主无次数限制',()=>{
 assert.equal(canChangeOwnUsername(false,null),false);assert.equal(canChangeOwnUsername(true,null),false);
 assert.equal(canChangeOwnUsername(false,{usernameChangedAt:null}),true);
 for(const t of [0,Date.now()]){assert.equal(canChangeOwnUsername(false,{usernameChangedAt:t}),false);assert.equal(canChangeOwnUsername(true,{usernameChangedAt:t}),true)}
});
test('修改账号不能从请求伪造角色、次数或身份，固定requestId和目标ID保留',()=>{
 const requestId='f35cd3a9-30ce-48f5-bac8-e1af1576bffa',base={action:'changeUsername',newUsername:'NewUser123',currentPassword:'original',requestId};
 const parsed=changeUsernameInput.parse({...base,accountId:'other-account'});assert.equal(parsed.newUsername,'newuser123');assert.equal(parsed.accountId,'other-account');
 for(const key of ['role','isOwner','userId','usernameChangedAt','username_changed_at','canChangeUsername'])assert.equal(changeUsernameInput.safeParse({...base,[key]:null}).success,false);
 assert.equal(changeUsernameInput.safeParse({...base,requestId:'bad'}).success,false);
});
