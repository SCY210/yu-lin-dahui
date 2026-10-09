import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canDeletePhoto,removePhoto} from '../lib/domain/photo-deletion';
import {deleteStoredPhoto,type DeletePhotoStore} from '../lib/delete-photo';
import {emptyState,type State,type Account,type Photo} from '../lib/domain/types';
import {projectClubState} from '../lib/club-view';

const now=Date.parse('2026-10-05T10:00:00Z'),requestId='f6320d9e-3d11-41f6-86f1-5cbb28cb3ca4';
function fixture(){
 const s=emptyState();s.settings.ownerAccountId='owner';s.revision=7;
 for(const [id,role] of [['owner','admin'],['admin','admin'],['uploader','member'],['subject','member'],['other','member']] as const){const a:Account={id,role,email:'',playerId:id+'-player'};s.accounts.push(a);s.players.push({id:a.playerId,ownerId:a.id,name:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})}
 const photo:Photo={id:'photo',key:'media/private-photo',kind:'photo',ownerId:'uploader',eventId:'event',matchId:'match',playerIds:['subject-player'],caption:'测试图片',created:now,type:'image/jpeg',size:100};
 s.photos.push(photo);s.events.push({id:'event',creatorId:'other',title:'测试活动',start:now,end:now+3600000,venue:'测试',address:'',capacity:8,signupDeadline:now,cancelDeadline:now,note:'',status:'open',courtMode:'interval',ballMode:'interval'});
 const a=(id:string)=>s.accounts.find(a=>a.id===id)!;return {s,photo,a};
}
function persistence(initial:State){
 let current=structuredClone(initial),failSave=false,failObject=false;const keys=new Set<string>(),objects:string[]=[];let saves=0;
 const store:DeletePhotoStore={load:async()=>structuredClone(current),committed:async key=>keys.has(key),save:async(next,key)=>{if(failSave)throw new Error('database unavailable');current=structuredClone(next);current.revision++;keys.add(key);saves++},deleteObject:async key=>{if(failObject)throw new Error('storage unavailable');objects.push(key)}};
 return {store,state:()=>structuredClone(current),objects,saves:()=>saves,failSave:(value=true)=>failSave=value,failObject:(value=true)=>failObject=value};
}

test('上传者与管理员可删除活动照片，关联人物和活动创建者无额外删除权限',()=>{
 const {s,photo,a}=fixture();assert.equal(canDeletePhoto(s,a('uploader'),photo),true);assert.equal(canDeletePhoto(s,a('admin'),photo),true);assert.equal(canDeletePhoto(s,a('subject'),photo),false);assert.equal(canDeletePhoto(s,a('other'),photo),false);
});
test('本人可删除管理员上传的战拍照片和头像；其他成员不能删除',()=>{
 const {s,photo,a}=fixture();for(const kind of ['racket','avatar'] as const){photo.kind=kind;photo.ownerId='admin';assert.equal(canDeletePhoto(s,a('subject'),photo),true);assert.equal(canDeletePhoto(s,a('other'),photo),false)}
});
test('群主档案照片受保护，其他管理员或上传者也不能删除',()=>{
 const {s,photo,a}=fixture();photo.playerIds=['owner-player'];for(const kind of ['racket','avatar'] as const){photo.kind=kind;photo.ownerId='admin';assert.equal(canDeletePhoto(s,a('admin'),photo),false);assert.equal(canDeletePhoto(s,a('owner'),photo),true)}
 photo.kind='photo';s.players[0].avatarId=photo.id;assert.equal(canDeletePhoto(s,a('admin'),photo),false);
});
test('删除当前头像恢复默认头像，删除旧头像不覆盖新头像，也不影响其他照片',()=>{
 const {s,photo,a}=fixture();photo.kind='avatar';photo.playerIds=['subject-player'];const subject=s.players.find(p=>p.id==='subject-player')!;subject.avatarId=photo.id;s.photos.push({...photo,id:'other-photo',key:'media/other-photo'});
 removePhoto(s,a('subject'),photo.id,requestId,now);assert.equal(subject.avatarId,undefined);assert.deepEqual(s.photos.map(p=>p.id),['other-photo']);
 const f=fixture();f.photo.kind='avatar';f.photo.playerIds=['subject-player'];f.s.players.find(p=>p.id==='subject-player')!.avatarId='new-avatar';removePhoto(f.s,f.a('subject'),f.photo.id,requestId,now);assert.equal(f.s.players.find(p=>p.id==='subject-player')!.avatarId,'new-avatar');
});
test('越权删除及不存在照片拒绝时不改变资料和审计记录',()=>{
 const {s,photo,a}=fixture(),before=structuredClone(s);assert.throws(()=>removePhoto(s,a('other'),photo.id,requestId,now),/403/);assert.deepEqual(s,before);assert.throws(()=>removePhoto(s,a('uploader'),'missing',requestId,now),/不存在/);assert.deepEqual(s,before);
});
test('数据库确认后才删除实际文件，照片及所有关联视图同时移除',async()=>{
 const {s}=fixture(),p=persistence(s);await deleteStoredPhoto({userId:'uploader',photoId:'photo',requestId,revision:7},p.store,now);
 assert.equal(p.state().photos.length,0);assert.equal(p.saves(),1);assert.deepEqual(p.objects,['media/private-photo']);assert.equal(p.state().audits[0].action,'photoDelete');
});
test('数据库失败或旧版本冲突不删除文件，也不保存部分资料',async()=>{
 const {s}=fixture(),p=persistence(s);p.failSave();await assert.rejects(()=>deleteStoredPhoto({userId:'uploader',photoId:'photo',requestId,revision:7},p.store,now),/database/);assert.deepEqual(p.objects,[]);assert.deepEqual(p.state(),s);
 p.failSave(false);await assert.rejects(()=>deleteStoredPhoto({userId:'uploader',photoId:'photo',requestId,revision:6},p.store,now),/已更新/);assert.deepEqual(p.objects,[]);assert.deepEqual(p.state(),s);
});
test('文件清理失败可用同一操作重试，不重复删除资料或产生重复审计',async()=>{
 const {s}=fixture(),p=persistence(s),input={userId:'uploader',photoId:'photo',requestId,revision:7};p.failObject();await assert.rejects(()=>deleteStoredPhoto(input,p.store,now),/重试删除/);assert.equal(p.state().photos.length,0);assert.equal(p.saves(),1);
 p.failObject(false);await deleteStoredPhoto(input,p.store,now);assert.equal(p.saves(),1);assert.equal(p.state().audits.length,1);assert.deepEqual(p.objects,['media/private-photo']);
 await deleteStoredPhoto(input,p.store,now);assert.equal(p.saves(),1);assert.equal(p.state().audits.length,1);
});
test('不能复用操作编号删除别的照片，也不能把原上传操作当成删除提交',async()=>{
 const {s,photo}=fixture();s.photos.push({...photo,id:'second',key:'media/second'});const p=persistence(s);await deleteStoredPhoto({userId:'uploader',photoId:'photo',requestId,revision:7},p.store,now);
 await assert.rejects(()=>deleteStoredPhoto({userId:'uploader',photoId:'second',requestId,revision:8},p.store,now),/不匹配/);assert.ok(p.state().photos.some(p=>p.id==='second'));assert.deepEqual(p.objects,['media/private-photo']);
 const f=fixture(),q=persistence(f.s);await q.store.save(f.s,'uploader:'+requestId,f.s);await assert.rejects(()=>deleteStoredPhoto({userId:'uploader',photoId:'photo',requestId,revision:8},q.store,now),/不匹配/);assert.deepEqual(q.objects,[]);
});
test('malformed historical deletion audit cannot trigger storage cleanup',async()=>{
 const {s}=fixture();s.audits.push({id:'invalid-audit',at:now,actor:'uploader',action:'photoDelete',reason:'fixture',changes:{requestId,photoId:'photo',storageKey:42}});
 const p=persistence(s);await p.store.save(s,'uploader:'+requestId,s);
 await assert.rejects(()=>deleteStoredPhoto({userId:'uploader',photoId:'photo',requestId,revision:8},p.store,now),/不匹配/);
 assert.deepEqual(p.objects,[]);
});

test('未知成员、越权账号或已删除照片不能触发文件清理',async()=>{
 const {s}=fixture(),p=persistence(s);await assert.rejects(()=>deleteStoredPhoto({userId:'unknown',photoId:'photo',requestId,revision:7},p.store,now),/加入群组/);await assert.rejects(()=>deleteStoredPhoto({userId:'other',photoId:'photo',requestId,revision:7},p.store,now),/403/);await assert.rejects(()=>deleteStoredPhoto({userId:'uploader',photoId:'missing',requestId,revision:7},p.store,now),/不存在/);assert.deepEqual(p.objects,[]);assert.equal(p.saves(),0);
});
test('共享资料提供服务端删除权限标记，保留原数据且不泄露照片存储键',()=>{
 const {s,a}=fixture();for(const who of ['uploader','subject','admin']){const before=structuredClone(s),view=projectClubState(s,a(who),'2026-10',2026,now);assert.equal(view.photos[0].canDelete,who!=='subject');assert.ok(!('key' in view.photos[0]));assert.deepEqual(s,before)}
});
