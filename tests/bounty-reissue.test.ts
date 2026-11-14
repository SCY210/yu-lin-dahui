import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {bountyOffer,bountyOfferAt,bountyOutcome,bountyReissueCandidates,drawnBounty} from '../lib/domain/bounties';
import {projectClubState} from '../lib/club-view';
import {remindersForChange} from '../lib/reminder-contract';
import type {State} from '../lib/domain/types';
import {coinEpoch as at,coinEvent,coinFixture,coinMatch,coinSignup} from './helpers/automatic-coins-fixture';

const minute=60000,day=86400000;
/** An activity in which fictional member p1 draws the streak bounty (the draw is a fixed hash of activity and player). */
function setup(){
 let id='';for(let i=0;;i++)if(drawnBounty('reissue-'+i,'p1')==='streak'){id='reissue-'+i;break}
 const s=coinFixture(),e=coinEvent(s,id,at+120*minute);for(const p of s.players)coinSignup(s,e,p.id);
 // p1's first game started before they answered: the offer is gone.
 coinMatch(s,e,'first',{a:['p1','p0'],b:['p2','p3'],start:e.start+minute,end:e.start+13*minute});
 return {s,e,owner:s.accounts[0],member:s.accounts.find(a=>a.playerId==='p1')!,other:s.accounts.find(a=>a.playerId==='p2')!};
}

test('an offer lost when the first game started can be reissued by the owner or an administrator, and the member answers it',async()=>{
 const {s,e,owner,member,other}=setup(),now=e.start+20*minute;
 assert.equal(bountyOffer(s,e,'p1',bountyOfferAt(e))?.kind,'streak','before the first game the offer was open');
 assert.equal(bountyOffer(s,e,'p1',now),null,'gone once the first game started');
 assert.deepEqual(bountyReissueCandidates(s,e,now),[{playerId:'p1',kind:'streak'}],'only the member who drew one and lost it');
 await assert.rejects(()=>apply(s,other,'bountyReissue',{eventId:e.id,playerId:'p1'},now),/403/,'members cannot reissue');
 const before=structuredClone(s);
 await apply(s,owner,'bountyReissue',{eventId:e.id,playerId:'p1',reason:'第一局被自动开打'},now);
 assert.deepEqual(e.bountyReissued?.map(r=>[r.playerId,r.by,r.reason]),[['p1','owner','第一局被自动开打']]);
 assert.ok(s.audits.some(a=>a.action==='bountyReissue'&&(a.changes as {playerId:string}).playerId==='p1'));
 // The member hears of it, the same way as a first offer.
 const notices=remindersForChange(s,before,'owner','reissue',now).filter(n=>n.kind==='bounty');
 assert.deepEqual(notices.map(n=>[n.accountIds,n.title,n.playerId]),[[[member.id],'悬赏令','p1']]);assert.match(notices[0].body,/补发连胜悬赏/);
 // Open again past the first game and the end, until answered; nobody else's is.
 assert.equal(bountyOffer(s,e,'p1',now)?.kind,'streak');assert.equal(bountyOffer(s,e,'p1',e.end+day)?.kind,'streak');assert.equal(bountyOffer(s,e,'p2',now),null);
 assert.deepEqual(bountyReissueCandidates(s,e,now),[],'reissued once');
 await assert.rejects(()=>apply(s,owner,'bountyReissue',{eventId:e.id,playerId:'p1'},now),/没有可补发的悬赏令/);
 // Others do not learn who had an offer reissued; administrators do.
 assert.equal(projectClubState(s,other,'2035-01',2035,now).events.find(x=>x.id===e.id)?.bountyReissued,undefined);
 assert.deepEqual(projectClubState(s,member,'2035-01',2035,now).events.find(x=>x.id===e.id)?.bountyReissued?.map(r=>r.playerId),['p1']);
 assert.deepEqual(projectClubState(s,owner,'2035-01',2035,now).events.find(x=>x.id===e.id)?.bountyReissued?.map(r=>r.playerId),['p1']);
 // Accepted after the end, it settles on the activity's games as usual.
 await apply(s,member,'bountyRespond',{eventId:e.id,playerId:'p1',accept:true},e.end+day);
 const record=e.bounties!.find(b=>b.playerId==='p1')!;assert.equal(record.status,'accepted');assert.equal(record.kind,'streak');
 assert.equal(bountyOutcome(s as State,e,record,e.end+day),'failed','one win is no streak of five');
 assert.equal(bountyOffer(s,e,'p1',e.end+day),null,'answered once');
});

test('nothing to reissue before the start, for a member who never drew one or still can answer, or once the activity has ended',async()=>{
 const {s,e,owner}=setup();
 assert.deepEqual(bountyReissueCandidates(s,e,e.start-minute),[],'not before the activity starts');
 const unplayed=s.players.map(p=>p.id).filter(id=>!['p0','p1','p2','p3'].includes(id));
 for(const id of unplayed)assert.ok(!bountyReissueCandidates(s,e,e.start+20*minute).some(x=>x.playerId===id),id+' has not played yet, so a drawn offer is still open');
 assert.ok(bountyReissueCandidates(s,e,e.end-minute).some(x=>x.playerId==='p1'),'while the activity runs');
 assert.deepEqual(bountyReissueCandidates(s,e,e.end),[],'not once it has ended');
 await assert.rejects(()=>apply(s,owner,'bountyReissue',{eventId:e.id,playerId:'p1'},e.end),/没有可补发的悬赏令/);
 for(const id of ['p0','p2','p3'])if(!drawnBounty(e.id,id))await assert.rejects(()=>apply(s,owner,'bountyReissue',{eventId:e.id,playerId:id},e.start+20*minute),/没有可补发的悬赏令/);
});
