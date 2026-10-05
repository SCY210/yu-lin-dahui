import {RequestError} from './request-body';
import {removePhoto} from './domain/photo-deletion';
import type {State} from './domain/types';

export type DeletePhotoInput={userId:string;photoId:string;requestId:string;revision:number};
export type DeletePhotoStore={load:()=>Promise<State>;committed:(key:string)=>Promise<boolean>;save:(state:State,key:string,previous:State)=>Promise<void>;deleteObject:(key:string)=>Promise<void>};

export async function deleteStoredPhoto(input:DeletePhotoInput,store:DeletePhotoStore,now=Date.now()){
 const s=await store.load(),a=s.accounts.find(a=>a.id===input.userId);
 if(!a)throw new RequestError('请先加入群组',403);
 const key=a.id+':'+input.requestId;let storageKey:string;
 if(await store.committed(key)){
  const audit=s.audits.find(audit=>audit.actor===a.id&&audit.action==='photoDelete'&&(audit.changes as any)?.requestId===input.requestId);
  const changes=audit?.changes as {photoId?:string;storageKey?:string}|undefined;
  if(changes?.photoId!==input.photoId||!changes.storageKey)throw new RequestError('操作记录不匹配，请重新删除',409);
  storageKey=changes.storageKey;
 }else{
  if(!s.photos.some(p=>p.id===input.photoId))throw new RequestError('照片不存在或已删除',404);
  if(input.revision!==s.revision)throw new RequestError('数据已更新，请刷新后重试删除',409);
  const previous=structuredClone(s);storageKey=removePhoto(s,a,input.photoId,input.requestId,now);
  // Delete shared references first. A failed revision gate must never erase the
  // stored image while another request still legitimately refers to it.
  await store.save(s,key,previous);
 }
 try{await store.deleteObject(storageKey)}catch{throw new RequestError('照片已从相册移除，文件清理暂未完成，请重试删除',503)}
 return {ok:true};
}
