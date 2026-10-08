'use client';
import {useRef,useState} from 'react';
import {toast} from 'sonner';
import PhotoDeleteButton from './photo-delete-button';
import FeatureGuide from './feature-guide';
import ImageRightsConfirmation from './image-rights-confirmation';
import {Pick} from './ui';
import {canManageEvent} from '../lib/domain/permissions';
import type {projectClubState} from '../lib/club-view';

export type GalleryContext={
 data:ReturnType<typeof projectClubState>;
 admin:boolean;
 name:(id:string)=>string;
 refresh:()=>Promise<unknown>;
};
export type GalleryPhoto=GalleryContext['data']['photos'][number];

export default function PhotoGallery({ctx,eventId,playerId,avatar=false}:{ctx:GalleryContext;eventId?:string;playerId?:string;avatar?:boolean}){
 const {data,name,refresh}=ctx;
 const fileInput=useRef<HTMLInputElement>(null);
 const [file,setFile]=useState<File|null>(null);
 const [matchId,setMatchId]=useState('none');
 const [person,setPerson]=useState('none');
 const [caption,setCaption]=useState('');
 const [rightsConfirmed,setRightsConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const player=data.players.find(item=>item.id===playerId);
 const avatarPhoto=data.photos.find(photo=>photo.id===player?.avatarId);
 const photos=data.photos.filter(photo=>photo.kind==='photo'&&(eventId?photo.eventId===eventId:photo.playerIds.includes(playerId??'')));
 const eventMatches=data.matches.filter(match=>match.eventId===eventId&&match.status!=='cancelled');
 const attended=data.players.filter(item=>data.attendance.some(record=>record.eventId===eventId&&record.playerId===item.id));
 const event=data.events.find(item=>item.id===eventId);
 const canUpload=avatar
  ?!!player&&(playerId===data.me.playerId||(ctx.admin&&(!player.protectedOwner||data.me.isOwner)))
  :!!event&&(canManageEvent(data.me,event)||data.attendance.some(record=>record.eventId===eventId&&record.playerId===data.me.playerId));

 async function upload(){
  if(!file||!rightsConfirmed||busy)return;
  setBusy(true);
  try{
   const form=new FormData();
   form.set('file',file);
   form.set('kind',avatar?'avatar':'photo');
   form.set('rightsConfirmed','true');
   form.set('requestId',crypto.randomUUID());
   form.set('revision',String(data.revision));
   form.set('caption',caption);
   if(avatar)form.set('playerId',playerId??'');
   else{
    form.set('eventId',eventId??'');
    form.set('matchId',matchId==='none'?'':matchId);
    form.set('playerIds',JSON.stringify(person==='none'?[]:[person]));
   }
   const response=await fetch('/api/photos',{method:'POST',body:form});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error??'上传未完成，请重试');
   setFile(null);setCaption('');setRightsConfirmed(false);
   if(fileInput.current)fileInput.current.value='';
   toast.success(avatar?'头像已更新':'照片已关联到活动、比赛及球友主页');
   try{await refresh()}catch{toast.error('照片已上传，请刷新页面查看')}
  }catch(error){toast.error(error instanceof Error?error.message:'上传未完成，请重试')}
  finally{setBusy(false)}
 }

 return <section className={avatar?'avatar-upload':'card'}>
  {!avatar&&<div className="section-title"><h3>{eventId?'活动相册':'球友相册'}</h3><FeatureGuide rules={data.settings.rules} topic="photos" label="照片关联说明"/></div>}
  {canUpload&&<div className="upload-form">
   <label>{avatar?'选择头像':'上传活动照片'}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{setFile(event.target.files?.[0]??null);setRightsConfirmed(false)}}/></label>
   {!avatar&&<>
    <label>关联比赛<Pick value={matchId} onChange={setMatchId} options={[
     ['none','仅关联活动'],...eventMatches.map(match=>[match.id,`${match.a.map(name).join('/')} 对阵 ${match.b.map(name).join('/')}`]),
    ]}/></label>
    {matchId==='none'&&<label>关联球友（可选）<Pick value={person} onChange={setPerson} options={[
     ['none','暂不关联球友'],...attended.map(item=>[item.id,item.name]),
    ]}/></label>}
    <label>照片说明<input value={caption} maxLength={300} disabled={busy} onChange={event=>setCaption(event.target.value)}/></label>
    <p className="hint">选择比赛后，自动关联该场四名参赛者。支持JPEG、PNG和WebP，最多5兆字节。</p>
   </>}
   <ImageRightsConfirmation checked={rightsConfirmed} onChange={setRightsConfirmed} disabled={busy}/>
   <button className="secondary" disabled={!file||!rightsConfirmed||busy} onClick={upload}>{busy?'上传中…':avatar?'保存头像':'上传并关联'}</button>
  </div>}
  {avatar&&avatarPhoto&&<PhotoDeleteButton photo={avatarPhoto} ctx={ctx} label="删除头像"/>}
  {!avatar&&<div className="photo-grid">{photos.map(photo=><figure key={photo.id}>
   <a href={'/api/photos/'+photo.id} target="_blank" rel="noreferrer"><img src={'/api/photos/'+photo.id} alt={photo.caption||'活动照片'} loading="lazy"/></a>
   <figcaption>{photo.caption}<small>{photo.playerIds.map(name).join(' · ')}</small><PhotoDeleteButton photo={photo} ctx={ctx}/></figcaption>
  </figure>)}{!photos.length&&<p className="muted">还没有关联照片。</p>}</div>}
 </section>;
}
