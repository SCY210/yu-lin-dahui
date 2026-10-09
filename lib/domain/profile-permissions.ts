import {fail,type State,type Account} from './types';
import {isClubOwner} from './ownership';

/** Runtime policy is resolved by the server using stable player identities. */
export function genderOnlyProfile(s:Pick<State,'profileRestrictions'>,playerId:string){
 return s.profileRestrictions?.genderOnlyPlayerIds.includes(playerId)??false;
}
export function profileEditMode(s:State,playerId:string,actor?:Pick<Account,'id'>):'full'|'gender-only'{
 return genderOnlyProfile(s,playerId)&&!(actor&&isClubOwner(s,actor))?'gender-only':'full';
}
export function assertFullProfileEditable(s:State,playerId:string,actor:Pick<Account,'id'>){
 if(profileEditMode(s,playerId,actor)==='gender-only')fail('403: 此球友的资料仅可修改性别');
}
