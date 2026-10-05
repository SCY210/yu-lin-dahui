import {fail,type Account,type State} from './types';

// Verified against the existing Site's live account and player records.
// Never resolve the owner from a display name or a browser-supplied flag.
const legacyOwnerAccountId='uoVo7RaSrpRMqVTmKzLB3vvo0m9s8pOKfx7c6JAUxtROd5NVdL4z7B';
const legacyOwnerPlayerId='17799d9d-ca2d-4da1-aedb-bd1459030557';
export function clubOwnerId(s:State){return s.settings.ownerAccountId??legacyOwnerAccountId}
export function clubOwnerPlayerId(s:State){return s.accounts.find(a=>a.id===clubOwnerId(s))?.playerId??(clubOwnerId(s)===legacyOwnerAccountId?legacyOwnerPlayerId:undefined)}
export function isClubOwner(s:State,a:Pick<Account,'id'>){return a.id===clubOwnerId(s)}
export function canModifyAccount(s:State,a:Pick<Account,'id'|'role'>,targetId:string){
 return a.role==='admin'&&(targetId!==clubOwnerId(s)||isClubOwner(s,a));
}
export function assertAccountMutable(s:State,a:Account,targetId:string){
 if(targetId===clubOwnerId(s)&&!isClubOwner(s,a))fail('403: 群主账号受保护，只有群主本人可以修改');
}
export function assertPlayerMutable(s:State,a:Account,playerId:string){
 if(clubOwnerPlayerId(s)===playerId)assertAccountMutable(s,a,clubOwnerId(s));
}
export function ensureClubOwner(s:State){
 const id=clubOwnerId(s),owner=s.accounts.find(a=>a.id===id);if(!owner)return false;
 let changed=false;
 if(s.settings.ownerAccountId!==owner.id){s.settings.ownerAccountId=owner.id;changed=true}
 if(owner.role!=='admin'){owner.role='admin';changed=true}
 return changed;
}
