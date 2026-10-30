import {fixtureSides,fixtureWinner,groupStandings,tournamentChampion,tournamentFormat,type Tournament,type TournamentData} from './tournament';

/** One team's final place and record (docs/TOURNAMENTS.md). Teams knocked out in the same round share a place. */
export type TournamentResult={teamId:string;players:string[];place:number;label:string;played:number;wins:number;losses:number;gamesWon:number;gamesLost:number;pointsFor:number;pointsAgainst:number};
/** The frozen summary kept when a competition is archived: names as they were then. */
export type TournamentArchive={at:number;by:string;results:(Omit<TournamentResult,'players'>&{players:{id:string;name:string}[]})[]};

export function placeLabel(place:number,shared:boolean){
 if(place===1)return '冠军';if(place===2&&!shared)return '亚军';if(place===3&&!shared)return '季军';
 return shared?'并列第 '+place+' 名':'第 '+place+' 名';
}

/** Final places and records once the champion is known; null before. Knockout places follow the round a team went
 * out in (final loser 2nd, semi-final losers 3rd, quarter-final losers 5th, ...). In groups-then-knockout, teams that
 * did not qualify follow by their group place. A round robin keeps its table order. */
export function tournamentResults(t:Tournament,s:TournamentData):TournamentResult[]|null{
 const champion=tournamentChampion(t,s);if(!champion)return null;
 const record=new Map(t.teams.map(team=>[team.id,{played:0,wins:0,losses:0,gamesWon:0,gamesLost:0,pointsFor:0,pointsAgainst:0}]));
 for(const f of t.fixtures){
  const m=s.matches.find(m=>m.id===f.matchId);if(m?.status!=='complete')continue;
  const {a,b}=fixtureSides(t,s,f);if(!a||!b)continue;
  const games=m.games.length?m.games:[{a:m.scoreA??0,b:m.scoreB??0}],aWon=(m.scoreA??0)>(m.scoreB??0);
  for(const [id,own,won] of [[a,'a',aWon],[b,'b',!aWon]] as const){
   const r=record.get(id)!,opp=own==='a'?'b':'a';r.played++;if(won)r.wins++;else r.losses++;
   for(const g of games){r.pointsFor+=g[own];r.pointsAgainst+=g[opp];if(g[own]>g[opp])r.gamesWon++;else r.gamesLost++}
  }
 }
 const places=new Map<string,number>(),format=tournamentFormat(t);
 if(format==='round-robin')groupStandings(t,s,0).forEach((row,i)=>places.set(row.id,i+1));
 else{
  const knockout=t.fixtures.filter(f=>f.stage==='knockout'),rounds=Math.max(...knockout.map(f=>f.round));
  places.set(champion,1);
  for(const f of knockout){
   const {a,b}=fixtureSides(t,s,f),winner=fixtureWinner(t,s,f);if(!a||!b||!winner)continue;
   places.set(winner===a?b:a,2**(rounds-f.round)+1);
  }
  if(format==='groups'){
   const tables=t.groups.map((_,g)=>groupStandings(t,s,g)),depth=Math.max(...tables.map(table=>table.length));
   let next=places.size+1;
   for(let rank=0;rank<depth;rank++){const out=tables.map(table=>table[rank]?.id).filter((id):id is string=>!!id&&!places.has(id));for(const id of out)places.set(id,next);next+=out.length}
  }
 }
 const counts=new Map<number,number>();for(const place of places.values())counts.set(place,(counts.get(place)??0)+1);
 return t.teams.filter(team=>places.has(team.id)).map(team=>{const place=places.get(team.id)!;return {teamId:team.id,players:team.players,place,label:placeLabel(place,(counts.get(place)??0)>1),...record.get(team.id)!}})
  .sort((x,y)=>x.place-y.place||y.wins-x.wins||(y.pointsFor-y.pointsAgainst)-(x.pointsFor-x.pointsAgainst));
}
