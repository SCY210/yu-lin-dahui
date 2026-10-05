import {clubOwnerPlayerId,isClubOwner} from './ownership';
import {fail,type State,type Account,type Photo} from './types';

export function canDeletePhoto(s:State,a:Account,photo:Photo){
 const ownerPlayer=clubOwnerPlayerId(s);
 const protectedTarget=ownerPlayer&&((photo.kind!=='photo'&&photo.playerIds.includes(ownerPlayer))||s.players.some(p=>p.id===ownerPlayer&&p.avatarId===photo.id));
 if(protectedTarget&&!isClubOwner(s,a))return false;
 return a.role==='admin'||photo.ownerId===a.id||(photo.kind!=='photo'&&photo.playerIds.includes(a.playerId));
}

export function removePhoto(s:State,a:Account,photoId:string,requestId:string,now:number){
 const photo=s.photos.find(p=>p.id===photoId)??fail('照片不存在或已删除');
 if(!canDeletePhoto(s,a,photo))fail('403: 只能删除自己上传或自己的档案照片，管理员按权限管理');
 s.photos=s.photos.filter(p=>p.id!==photoId);
 for(const player of s.players)if(player.avatarId===photoId)delete player.avatarId;
 // Keep the private object key in the existing admin audit trail so a retry can
 // finish physical cleanup after the atomic database deletion already committed.
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'photoDelete',reason:photo.kind==='avatar'?'删除头像':photo.kind==='racket'?'删除战拍照片':'删除活动照片',changes:{photoId,requestId,storageKey:photo.key}});
 return photo.key;
}
