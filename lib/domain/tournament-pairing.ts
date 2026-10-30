import type {TournamentCategory} from './tournament';

export type PairingCandidate={id:string;score:number;gender?:string};
type Team=[PairingCandidate,PairingCandidate];

/** Balanced fixed partners (docs/TOURNAMENTS.md): the strongest is paired with the weakest by 修为, then members are
 * swapped between teams while that brings the team totals closer together, so every team has a fair chance. Mixed
 * doubles pair one man with one woman and only swap within a gender. Players without a partner (an odd count, or more
 * of one gender) are returned in `left`, taken from the end of the given order. Organisers can still edit the result. */
export function balancedPairs(players:PairingCandidate[],category?:TournamentCategory):{teams:string[][];left:string[]}{
 const byScore=(x:PairingCandidate,y:PairingCandidate)=>y.score-x.score||x.id.localeCompare(y.id);
 let teams:Team[]=[],left:PairingCandidate[]=[];
 if(category==='mixed-doubles'){
  const men=players.filter(p=>p.gender==='male'),women=players.filter(p=>p.gender==='female'),n=Math.min(men.length,women.length);
  left=[...men.slice(n),...women.slice(n),...players.filter(p=>p.gender!=='male'&&p.gender!=='female')];
  const m=men.slice(0,n).sort(byScore),w=women.slice(0,n).sort(byScore).reverse();
  teams=m.map((x,i)=>[x,w[i]]);
 }else{
  const n=players.length-players.length%2,sorted=players.slice(0,n).sort(byScore);left=players.slice(n);
  for(let i=0;i<n/2;i++)teams.push([sorted[i],sorted[n-1-i]]);
 }
 const total=(t:Team)=>t[0].score+t[1].score,mean=teams.reduce((sum,t)=>sum+total(t),0)/(teams.length||1),cost=(t:Team)=>(total(t)-mean)**2;
 for(let improved=true,guard=0;improved&&guard<200;guard++){
  improved=false;
  for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++)for(let x=0;x<2;x++)for(let y=0;y<2;y++){
   const a=teams[i],b=teams[j];if(category==='mixed-doubles'&&a[x].gender!==b[y].gender)continue;
   const na:Team=x?[a[0],b[y]]:[b[y],a[1]],nb:Team=y?[b[0],a[x]]:[a[x],b[1]];
   if(cost(na)+cost(nb)<cost(a)+cost(b)-1e-9){teams[i]=na;teams[j]=nb;improved=true}
  }
 }
 return {teams:teams.map(t=>[t[0].id,t[1].id]),left:left.map(p=>p.id)};
}
