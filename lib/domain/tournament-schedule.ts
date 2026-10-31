/** Group-stage scheduling for the system arrangement (docs/TOURNAMENTS.md). Group opponents are fixed, so the fixture
 * that looks fairest now can leave someone without a free opponent for a long time later. Each candidate is therefore
 * played out to the end of the group stage, every match taking the average length so far, and the candidate whose
 * longest wait is shortest wins; ties go to the smallest sum of squared waits. Pure and allocation-light: it runs on
 * every result. */
export type Pairing={a:number;b:number};
/** How many of the longest-waiting ready fixtures are played out; the rest are rarely better and cost CPU. */
export const playOuts=4;

/** Longest-waiting first: the fixture whose earlier-free team has waited longest, then whose later-free team has. */
function waitedLonger(x:Pairing,y:Pairing,free:number[]){
 return Math.min(free[x.a],free[x.b])-Math.min(free[y.a],free[y.b])||Math.max(free[x.a],free[x.b])-Math.max(free[y.a],free[y.b]);
}

/** Picks the fixture to put on the court free at `now`. `teamFree[i]` is when team i is (or was) free, `courtFree` when
 * each court booked now is free (at least one is `now`), `pending` every unstarted group fixture and `ready` the ones
 * among them whose teams are free now. */
export function bestGroupFixture<T extends Pairing>(ready:T[],pending:Pairing[],teamFree:number[],courtFree:number[],now:number,length:number):T{
 const candidates=[...ready].sort((x,y)=>waitedLonger(x,y,teamFree)).slice(0,playOuts);
 let best=candidates[0],bestWorst=Infinity,bestSquares=Infinity;
 for(const first of candidates){
  const free=[...teamFree],courts=[...courtFree],left=pending.filter(p=>p!==first);let worst=0,squares=0;
  const start=(p:Pairing,court:number,at:number)=>{for(const team of [p.a,p.b]){const wait=at-free[team];worst=Math.max(worst,wait);squares+=wait*wait;free[team]=at+length}courts[court]=at+length};
  start(first,courts.indexOf(Math.min(...courts)),now);
  while(left.length&&worst<=bestWorst){
   const court=courts.indexOf(Math.min(...courts)),at=courts[court];
   let next=-1;for(let i=0;i<left.length;i++){const p=left[i];if(free[p.a]<=at&&free[p.b]<=at&&(next<0||waitedLonger(p,left[next],free)<0))next=i}
   // Nobody can play here yet: the court stays empty until the first pending fixture has both teams free.
   if(next<0){courts[court]=Math.min(...left.map(p=>Math.max(free[p.a],free[p.b])));continue}
   start(left[next],court,at);left.splice(next,1);
  }
  if(worst<bestWorst||(worst===bestWorst&&squares<bestSquares)){best=first;bestWorst=worst;bestSquares=squares}
 }
 return best;
}
