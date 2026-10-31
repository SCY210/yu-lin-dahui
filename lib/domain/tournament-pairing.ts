import type {TournamentCategory} from './tournament';

export type PairingCandidate={id:string;score:number;gender?:string};
type Team=[PairingCandidate,PairingCandidate];
/** A team the organisers should look at: a player standing in for the other gender in mixed doubles, or a team total
 * far from the others. The pairing is still made; the page highlights it for a manual change. */
export type PairingFlag={team:number;reason:string};
/** How far a team total may be from the average before it is flagged. */
export const pairingSpread=150;

/** Balanced fixed partners (docs/TOURNAMENTS.md): the strongest is paired with the weakest by 修为, then members are
 * swapped between teams while that brings the team totals closer together, so every team has a fair chance. Everyone
 * is paired; only an odd player out waits in `left`. Mixed doubles pair one man with one woman; when there are more
 * men than women, the men with the lowest 修为 take the women's places (and the other way round), flagged. Men's
 * doubles only take men. */
export function balancedPairs(players:PairingCandidate[],category?:TournamentCategory):{teams:string[][];left:string[];flags:PairingFlag[]}{
 const byScore=(x:PairingCandidate,y:PairingCandidate)=>y.score-x.score||x.id.localeCompare(y.id);
 let teams:Team[]=[],left:PairingCandidate[]=[];
 if(category==='mixed-doubles'){
  const pool=players.filter(p=>p.gender==='male'||p.gender==='female');left=players.filter(p=>!pool.includes(p));
  const usable=pool.slice(0,pool.length-pool.length%2);left.push(...pool.slice(usable.length));
  const men=usable.filter(p=>p.gender==='male').sort(byScore),women=usable.filter(p=>p.gender==='female').sort(byScore),half=usable.length/2;
  // The weakest men stand in for women when men are more; the strongest women for men when women are more.
  while(men.length>half)women.push(men.pop()!);
  while(women.length>half)men.push(women.shift()!);
  men.sort(byScore);women.sort(byScore).reverse();
  teams=men.map((x,i)=>[x,women[i]]);
 }else{
  const pool=category==='mens-doubles'?players.filter(p=>p.gender==='male'):players;left=players.filter(p=>!pool.includes(p));
  const n=pool.length-pool.length%2,sorted=pool.slice(0,n).sort(byScore);left.unshift(...pool.slice(n));
  for(let i=0;i<n/2;i++)teams.push([sorted[i],sorted[n-1-i]]);
 }
 const total=(t:Team)=>t[0].score+t[1].score,mean=teams.reduce((sum,t)=>sum+total(t),0)/(teams.length||1),cost=(t:Team)=>(total(t)-mean)**2;
 // In mixed doubles a swap keeps each team's two places: the men's place with a men's place, the women's likewise.
 for(let improved=true,guard=0;improved&&guard<200;guard++){
  improved=false;
  for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++)for(let x=0;x<2;x++)for(let y=0;y<2;y++){
   if(category==='mixed-doubles'&&x!==y)continue;
   const a=teams[i],b=teams[j],na:Team=x?[a[0],b[y]]:[b[y],a[1]],nb:Team=y?[b[0],a[x]]:[a[x],b[1]];
   if(cost(na)+cost(nb)<cost(a)+cost(b)-1e-9){teams[i]=na;teams[j]=nb;improved=true}
  }
 }
 return {teams:teams.map(t=>[t[0].id,t[1].id]),left:left.map(p=>p.id),flags:pairingFlags(teams,category)};
}
/** Teams to look at again, for any pairs (auto-balanced or edited by hand): in mixed doubles two players of the same
 * gender (one stands in), and any team whose 修为 total is more than pairingSpread from the average. */
export function pairingFlags(teams:PairingCandidate[][],category?:TournamentCategory):PairingFlag[]{
 const full=teams.filter(t=>t.length===2),total=(t:PairingCandidate[])=>t.reduce((n,p)=>n+p.score,0),mean=full.reduce((n,t)=>n+total(t),0)/(full.length||1),flags:PairingFlag[]=[];
 teams.forEach((t,i)=>{
  if(t.length!==2)return;
  if(category==='mixed-doubles'&&t[0].gender===t[1].gender)flags.push({team:i,reason:(t[0].gender==='male'?'两位男球友，一位顶女位':'两位女球友，一位顶男位')+'，可手动调整'});
  else if(full.length>1&&Math.abs(total(t)-mean)>pairingSpread)flags.push({team:i,reason:'修为合计'+(total(t)>mean?'偏高':'偏低')+' '+Math.round(Math.abs(total(t)-mean))+'，可手动调整'});
 });
 return flags;
}
