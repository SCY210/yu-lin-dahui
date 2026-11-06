import {assertAccountMutable,clubOwnerId} from './ownership';
import {fail,type Account,type State} from './types';

/** Who manages member accounts and recorded friends (docs/TESTER_MEMBER_MANAGEMENT.md): administrators, and testers, the
 * members the owner made testers. A tester keeps their member role; this grants nothing else of the admin page. */
export function canManageMembers(a:Pick<Account,'role'|'simulationTester'>|null|undefined){
 return !!a&&(a.role==='admin'||a.simulationTester===true);
}
/** Whether this account's login may be opened or its password reset by `a`. The owner's account is the owner's alone;
 * a tester manages ordinary members only, never an administrator or another tester, so a tester cannot take over an
 * account with more rights than an ordinary member. */
export function canManageAccount(s:State,a:Account,target:Pick<Account,'id'|'role'|'simulationTester'>){
 if(target.id===clubOwnerId(s)&&a.id!==target.id)return false;
 if(a.role==='admin')return true;
 return a.simulationTester===true&&target.role==='member'&&target.simulationTester!==true;
}
export function assertAccountManageable(s:State,a:Account,targetId:string){
 assertAccountMutable(s,a,targetId);
 const target=s.accounts.find(x=>x.id===targetId);
 if(target&&!canManageAccount(s,a,target))fail('403: 长老只能管理普通道友的账号，副宗主和长老的账号请联系副宗主');
}
