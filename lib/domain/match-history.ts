import type {Match,State} from './types';

/** Canonical identities ignore side labels and the order of partners. */
const teamKey=(ids:string[])=>JSON.stringify([...ids].sort());
export const matchupKey=(a:string[],b:string[])=>JSON.stringify([teamKey(a),teamKey(b)].sort());
const pairKey=(a:string,b:string)=>teamKey([a,b]);

/** Index once per scheduling operation, rather than scanning matches per candidate. */
export function matchHistory(s:Pick<State,'matches'|'rounds'>,eventId:string,startedOnly=false){
 const matches=new Map<string,number>(),groups=new Map<string,number>(),partners=new Map<string,number>(),opponents=new Map<string,number>(),lastPartner=new Map<string,string>();
 const starts=new Map(s.rounds.map(r=>[r.id,r.start]));
 const add=(m:Pick<Match,'a'|'b'>)=>{
  const key=matchupKey(m.a,m.b);matches.set(key,(matches.get(key)??0)+1);
  const group=teamKey([...m.a,...m.b]);groups.set(group,(groups.get(group)??0)+1);
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
  unmet,
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
