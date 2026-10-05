import {getAppUser} from './auth';
import {raw} from './store';
import {canUseAquariumTheme,isAquariumQueen,legacyThemeOwnerId} from './theme-access';
export async function aquariumAccess(){
 const user=await getAppUser();if(!user)return {signedIn:false,allowed:false,queen:false};
 const results=await raw().batch([
  raw().prepare('SELECT id,player_id AS playerId,role FROM accounts WHERE id=?').bind(user.userId),
  raw().prepare('SELECT payload FROM settings WHERE id=?').bind('club'),
 ]);
 const account=results[0].results[0] as {id:string;playerId:string;role:string}|undefined;
 const row=results[1].results[0] as {payload:string}|undefined;
 const ownerId=row?JSON.parse(row.payload).ownerAccountId??legacyThemeOwnerId:legacyThemeOwnerId;
 return {signedIn:true,allowed:canUseAquariumTheme(account,ownerId),queen:isAquariumQueen(account)};
}
