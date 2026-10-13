import type {TournamentFixture} from '../domain/tournament';

export type BracketNode={fixture:TournamentFixture;x:number;y:number;side:'left'|'right'|'final';label:string};
export const bracketCard={width:184,height:112};
/** Mirror the two halves of the same persisted bracket toward a central final. */
export function tournamentBracketLayout(fixtures:TournamentFixture[]){
 const matches=fixtures.filter(f=>f.stage==='knockout').slice().sort((a,b)=>a.round-b.round||a.slot-b.slot);
 const rounds=Math.max(1,...matches.map(f=>f.round)),column=236,padding=24,top=76;
 const first=matches.filter(f=>f.round===1).length,body=Math.max(300,first/2*152);
 const width=padding*2+(rounds*2-2)*column+bracketCard.width,height=top+body+28;
 const label=(round:number)=>round===rounds?'决赛':round===rounds-1?'半决赛':round===rounds-2?'四分之一决赛':Math.pow(2,rounds-round+1)+' 强赛';
 const nodes:BracketNode[]=matches.map(f=>{
  const count=matches.filter(x=>x.round===f.round).length,half=Math.max(1,count/2),side=f.round===rounds?'final':f.slot<half?'left':'right';
  const x=side==='final'?(width-bracketCard.width)/2:side==='left'?padding+(f.round-1)*column:width-padding-bracketCard.width-(f.round-1)*column;
  const center=side==='final'?top+body/2:top+(f.slot%half+.5)*body/half;
  return {fixture:f,x,y:center-bracketCard.height/2,side,label:label(f.round)};
 });
 const links=nodes.flatMap(parent=>[parent.fixture.fromA,parent.fixture.fromB].flatMap(id=>{
  const child=nodes.find(n=>n.fixture.id===id);if(!child)return [];
  const forward=child.x<parent.x,fromX=child.x+(forward?bracketCard.width:0),toX=parent.x+(forward?0:bracketCard.width),fromY=child.y+bracketCard.height/2,toY=parent.y+bracketCard.height/2;
  const middle=(fromX+toX)/2;
  return [{from:child.fixture.id,to:parent.fixture.id,path:`M ${fromX} ${fromY} H ${middle} V ${toY} H ${toX}`}];
 }));
 return {width,height,nodes,links};
}
