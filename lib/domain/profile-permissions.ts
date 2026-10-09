import {fail,type State} from './types';

/** Runtime policy is resolved by the server using stable player identities. */
export function genderOnlyProfile(s:Pick<State,'profileRestrictions'>,playerId:string){
 return s.profileRestrictions?.genderOnlyPlayerIds.includes(playerId)??false;
}
export function profileEditMode(s:Pick<State,'profileRestrictions'>,playerId:string):'full'|'gender-only'{
 return genderOnlyProfile(s,playerId)?'gender-only':'full';
}
export function assertFullProfileEditable(s:Pick<State,'profileRestrictions'>,playerId:string){
 if(genderOnlyProfile(s,playerId))fail('403: 此球友的资料仅可修改性别');
}
