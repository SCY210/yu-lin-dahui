import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Photo} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
import {genderOnlyProfile} from '../lib/domain/profile-permissions';
import {profileRestrictionsFromConfig} from '../lib/profile-policy-config';
import {canDeletePhoto,removePhoto} from '../lib/domain/photo-deletion';
import {projectClubState} from '../lib/club-view';
import {createClubReadCache} from '../lib/club-read-cache';

function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 for(const id of ['owner','restricted','other']){
  s.accounts.push({id,email:'',role:id==='owner'?'admin':'member',playerId:id+'-player'});
  s.players.push({id:id+'-player',ownerId:id,name:'Fictional '+id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'',profile:{gender:'undisclosed',years:5,hand:'left',preference:'mixed',style:'existing style',equipment:'existing equipment',racket:'existing racket',strings:'existing strings',motto:'existing motto'}});
 }
 s.profileRestrictions={genderOnlyPlayerIds:['restricted-player']};
 return s;
}
const fullProfile={playerId:'restricted-player',gender:'female',years:9,hand:'right',preference:'doubles',style:'changed',equipment:'changed',racket:'changed'};
test('gender-only policy binds stable identity and preserves every existing field during a gender update',async()=>{
 const s=fixture(),a=s.accounts[1],p=s.players[1],before=structuredClone(p);
 p.name='A different display name';s.players[2].name=before.name;
 assert.equal(genderOnlyProfile(s,p.id),true);assert.equal(genderOnlyProfile(s,s.players[2].id),false);
 await apply(s,a,'profileGender',{playerId:p.id,gender:'female',reason:'Routine form audit metadata'},1);
 assert.deepEqual(p.profile,{...before.profile,gender:'female'});
 assert.equal(p.name,'A different display name');assert.equal(s.audits.at(-1)?.action,'profileGender');
});
test('direct full-profile, rename and extra-field gender requests are blocked without mutation, including owner requests',async()=>{
 for(const actor of [0,1])for(const [action,payload]of [['profileDetails',fullProfile],['profile',{playerId:'restricted-player',name:'changed'}],['profileGender',{playerId:'restricted-player',gender:'female',racket:'injected'}]] as const){
  const s=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[actor],action,payload,1));assert.deepEqual(s,before);
 }
 const s=fixture();await assert.rejects(()=>apply(s,s.accounts[2],'profileGender',{playerId:'restricted-player',gender:'male'},1),/403/);
 await apply(s,s.accounts[2],'profileDetails',{...fullProfile,playerId:'other-player'},1);assert.equal(s.players[2].profile?.racket,'changed');
});
test('restricted avatar and racket deletion is denied while ordinary activity-photo permissions remain',()=>{
 const s=fixture();
 for(const kind of ['avatar','racket'] as const){
  const p:Photo={id:kind,key:'fictional/'+kind,kind,eventId:null,matchId:null,playerIds:['restricted-player'],ownerId:'restricted',caption:'existing',created:1,type:'image/png',size:1};s.photos.push(p);
  for(const a of s.accounts){assert.equal(canDeletePhoto(s,a,p),false);const before=structuredClone(s);assert.throws(()=>removePhoto(s,a,p.id,'request',1),/403/);assert.deepEqual(s,before)}
 }
 const photo:Photo={...s.photos[0],id:'activity',kind:'photo',eventId:'event'};assert.equal(canDeletePhoto(s,s.accounts[1],photo),true);
 const view=projectClubState(s,s.accounts[1],'2026-10',2026,1);
 assert.equal(view.players.find(p=>p.id==='restricted-player')?.profileEditMode,'gender-only');assert.equal(view.players.find(p=>p.id==='other-player')?.profileEditMode,'full');assert.ok(view.photos.every(p=>!p.canDelete));
});
test('runtime policy parsing is bounded and fail-closed; validators invalidate when only the policy changes',()=>{
 assert.deepEqual(profileRestrictionsFromConfig('["b","a","b"]'),{genderOnlyPlayerIds:['a','b']});
 for(const value of [undefined,'','[]'])assert.equal(profileRestrictionsFromConfig(value),undefined);
 for(const value of ['null','{}','[null]','["secret-value"',42])assert.throws(()=>profileRestrictionsFromConfig(value),error=>error instanceof Error&&!error.message.includes('secret-value'));
 const s=fixture(),a=s.accounts[1],version={revision:s.revision,settings:s.settings,account:a,profileRestrictions:s.profileRestrictions},identity={userId:a.id,method:'password',username:'fixture'},cache=createClubReadCache();
 const token=cache.remember(version,identity,'2026-10',2026,10000,1);
 assert.equal(cache.matches(token,version,identity,'2026-10',2026,2),true);
 assert.equal(cache.matches(token,{...version,profileRestrictions:undefined},identity,'2026-10',2026,2),false);
});
