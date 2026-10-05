import {fail,type State,type Account,type Player,type Registration} from './types';
import {isClubOwner} from './ownership';
import {promoteLegacy,promoteBooking} from './booking-signups';

// Exact trial identities verified against the live Site; names alone never authorize removal.
export const trialTargets=[
 {playerId:'c93de032-a6b1-435d-9152-6368416c8ee6',accountId:'account:e29d64f3-868f-451e-8098-81c1cff46162',name:'试用球友01',username:'trial01'},
 {playerId:'4d0c1655-369e-4547-8efa-3c0b65e033ec',accountId:'account:0f36ebff-b6b3-4fba-924e-aa764ecd5dfa',name:'试用球友02',username:'trial02'},
 {playerId:'099e2b55-c020-4ca0-a616-08197476a578',accountId:'account:2012e6b1-6489-42a8-8499-c553e9c9059f',name:'试用球友03',username:'trial03'},
] as const;
type Backup={accounts:Account[];players:Player[];registrations:Registration[]};
const accountIds=new Set<string>(trialTargets.map(t=>t.accountId));
const playerIds=new Set<string>(trialTargets.map(t=>t.playerId));
function authorize(s:State,a:Account){if(!isClubOwner(s,a)||a.role!=='admin')fail('403: 只有群主可处理试用账号')}
function validBackup(b:Backup){return b?.accounts?.length===3&&b?.players?.length===3&&trialTargets.every(t=>b.accounts.some(a=>a.id===t.accountId&&a.playerId===t.playerId&&a.role==='member')&&b.players.some(p=>p.id===t.playerId&&p.ownerId===t.accountId&&p.name===t.name))}
export function trialBackup(s:State){
 const restored=new Set(s.audits.filter(a=>a.action==='restoreTrialAccounts').map(a=>(a.changes as {archiveId?:string})?.archiveId));
 const audit=s.audits.filter(a=>a.action==='archiveTrialAccounts'&&!restored.has(a.id)).at(-1);
 return audit&&validBackup(audit.changes as Backup)?audit:null;
}
export function trialCleanupStatus(s:State,a:Account){authorize(s,a);return {names:trialTargets.map(t=>t.name),canRemove:trialTargets.every(t=>s.players.some(p=>p.id===t.playerId)&&s.accounts.some(a=>a.id===t.accountId)),canRestore:!!trialBackup(s)}}
export function archiveTrials(s:State,a:Account,now:number){
 authorize(s,a);if(trialBackup(s))return false;
 const backup:Backup={accounts:s.accounts.filter(a=>accountIds.has(a.id)),players:s.players.filter(p=>playerIds.has(p.id)),registrations:s.registrations.filter(r=>playerIds.has(r.playerId))};
 if(!validBackup(backup))fail('409: 试用账号资料已变化，请先核对');
 if(backup.players.some(p=>p.ratedGames||p.avatarId))fail('试用账号已有比赛或头像，请先人工核对');
 // Refuse removal if a trial identity has acquired any historical or shared dependency.
 for(const key of ['events','rounds','matches','attendance','settlements','payments','ratingChanges','challenges','tagVotes','awardVotes','photos'] as const){
  if(s[key].some(row=>[...accountIds,...playerIds].some(id=>JSON.stringify(row).includes(id))))fail('试用账号已有比赛、费用、投票或其他关联记录，请先人工核对');
 }
 if(s.players.some(p=>!playerIds.has(p.id)&&accountIds.has(p.ownerId)))fail('试用账号还管理其他球友，请先转移档案');
 if(backup.registrations.some(r=>r.status!=='cancelled'&&(r.arrival<=now||!s.events.some(e=>e.id===r.eventId))))fail('试用账号已有开始的报名，请先人工核对');
 s.accounts=s.accounts.filter(a=>!accountIds.has(a.id));s.players=s.players.filter(p=>!playerIds.has(p.id));s.registrations=s.registrations.filter(r=>!playerIds.has(r.playerId));
 for(const eventId of new Set(backup.registrations.map(r=>r.eventId))){const e=s.events.find(e=>e.id===eventId);if(!e||e.deletedAt!==undefined)continue;promoteLegacy(s,e,now);for(const b of s.bookings.filter(b=>b.eventId===e.id))promoteBooking(s,e,b,now)}
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'archiveTrialAccounts',reason:'群主移除三个试用账号，档案备份可恢复，取消试用报名',changes:backup});return true;
}
export function restoreTrials(s:State,a:Account,now:number){
 authorize(s,a);const audit=trialBackup(s);if(!audit)return false;
 const backup=audit.changes as Backup;
 if(s.accounts.some(a=>accountIds.has(a.id)||playerIds.has(a.playerId))||s.players.some(p=>playerIds.has(p.id)||accountIds.has(p.ownerId)))fail('409: 账号或档案已存在，不能覆盖恢复');
 s.accounts.push(...structuredClone(backup.accounts));s.players.push(...structuredClone(backup.players));
 // Participation is booked through the normal signup flow; restoration never steals a promoted place.
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'restoreTrialAccounts',reason:'恢复试用账号及档案，原报名不自动恢复',changes:{archiveId:audit.id}});return true;
}
