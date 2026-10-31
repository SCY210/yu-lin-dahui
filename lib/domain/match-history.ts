import type {Match,State} from './types';

/** Canonical identities ignore side labels and the order of partners. */
const teamKey=(ids:string[])=>JSON.stringify([...ids].sort());
export const matchupKey=(a:string[],b:string[])=>JSON.stringify([teamKey(a),teamKey(b)].sort());
const pairKey=(a:string,b:string)=>teamKey([a,b]);

/** Index once per scheduling operation, rather than scanning matches per candidate. */
export function matchHistory(s:Pick<State,'matches'|'rounds'>,eventId:string,startedOnly=false){
 const matches=new Map<string,number>(),groups=new Map<string,number>(),partners=new Map<string,number>(),opponents=new Map<string,number>(),lastPartner=new Map<string,string>(),lastGame=new Map<string,number>();let games=0;
 const starts=new Map(s.rounds.map(r=>[r.id,r.start]));
 const add=(m:Pick<Match,'a'|'b'>)=>{
  const key=matchupKey(m.a,m.b);matches.set(key,(matches.get(key)??0)+1);
  const group=teamKey([...m.a,...m.b]);groups.set(group,(groups.get(group)??0)+1);
  games++;for(const id of [...m.a,...m.b])lastGame.set(id,games);
  for(const team of [m.a,m.b])if(team.length===2){
   const key=teamKey(team);partners.set(key,(partners.get(key)??0)+1);
   lastPartner.set(team[0],team[1]);lastPartner.set(team[1],team[0]);
  }
  for(const a of m.a)for(const b of m.b){const key=pairKey(a,b);opponents.set(key,(opponents.get(key)??0)+1)}
 };
 const history=s.matches.filter(m=>m.eventId===eventId&&!['draft','cancelled'].includes(m.status)&&!m.noShow?.length&&(!startedOnly||m.start!==null));
 history.sort((a,b)=>(a.start??starts.get(a.roundId)??0)-(b.start??starts.get(b.roundId)??0)||a.id.localeCompare(b.id)).forEach(add);
 const unmet=(ids:string[])=>{
  let count=0;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
   const key=pairKey(ids[i],ids[j]);if(!(partners.get(key)??0)&&!(opponents.get(key)??0))count++;
  }
  return count;
 };
 return {
  add,
  rematches:(a:string[],b:string[])=>matches.get(matchupKey(a,b))??0,
  cohorts:(ids:string[])=>groups.get(teamKey(ids))??0,
  /** 1 when three or more of these players come straight from one game together: a block that would only swap partners
   * (docs/LIVE_PLAY.md, breaking up blocks). */
  blocks:(ids:string[])=>{const seen=new Map<number,number>();for(const id of ids){const g=lastGame.get(id);if(g!==undefined)seen.set(g,(seen.get(g)??0)+1)}return [...seen.values()].some(n=>n>=3)?1:0},
  unmet,
  /** Separate from whole-game rematches: repeating a pair against NEW opponents still counts.
   * Indexed lookups only. The live balance comparator caps the total at 40 Elo-equivalent points. */
  partnerPenalty:(a:string[],b:string[])=>{
   let uses=0,recent=0;
   for(const team of [a,b])if(team.length===2){
    uses+=partners.get(teamKey(team))??0;
    if(lastPartner.get(team[0])===team[1]||lastPartner.get(team[1])===team[0])recent++;
   }
   // Frequency cannot saturate every pairing and erase the consecutive-partner distinction on long evenings.
   return Math.min(16,uses*4)+recent*24;
  },
  variety:(a:string[],b:string[],lastWeight=350)=>{
   let cost=0;
   for(const team of [a,b])if(team.length===2){
    cost+=(partners.get(teamKey(team))??0)*75;
    if(lastPartner.get(team[0])===team[1]||lastPartner.get(team[1])===team[0])cost+=lastWeight;
   }
   for(const x of a)for(const y of b)cost+=(opponents.get(pairKey(x,y))??0)*12;
   // Meeting a new player matters whether they are a partner or an opponent.
   cost-=unmet([...a,...b])*600;
   return cost;
  },
 };
}
