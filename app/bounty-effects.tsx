'use client';
import type {CSSProperties,ReactNode} from 'react';
import type {BountyKind} from '../lib/domain/bounties';
import './bounty-effects.css';

/** The seal word and scene name of each bounty's popup (docs/BOUNTIES.md). */
export const bountyEffects:Record<BountyKind,{word:string;name:string}>={
 streak:{word:'连',name:'万剑连环'},
 rout:{word:'破',name:'雷霆破军'},
 upset:{word:'逆',name:'鲤跃龙门'},
 deuce:{word:'鏖',name:'两仪鏖战'},
};
const n=(i:number,extra?:Record<string,string|number>)=>({'--i':i,...extra}) as CSSProperties;
const motes=[[22,110],[58,124],[96,116],[150,128],[192,112],[226,122]];

/** One animated scene per bounty kind. The resting style of every element is the final frame, so reduced motion shows it still. */
export default function BountyEffect({kind}:{kind:BountyKind}){
 const fx=bountyEffects[kind];
 return <div className={'bounty-fx bounty-fx-'+kind} data-kind={kind} aria-hidden="true">
  <svg viewBox="0 0 240 132" preserveAspectRatio="xMidYMid slice" focusable="false">
   <g className="fx-motes">{motes.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%2?1.4:2} style={n(i)}/>)}</g>
   {scenes[kind]}
  </svg>
  <span className="bounty-fx-name">{fx.name}</span>
  <span className="bounty-fx-seal">{fx.word}</span>
 </div>;
}

const sword=<><path className="fx-trail" d="M-96 0H-32"/><path className="fx-blade" d="M-18 -2.2H25L34 0L25 2.2H-18Z"/><path className="fx-guard" d="M-19 -7H-15V7H-19Z"/><path className="fx-hilt" d="M-31 -1.6H-19V1.6H-31Z"/><circle className="fx-guard" cx={-32} cy={0} r={2.4}/></>;

const scenes:Record<BountyKind,ReactNode>={
 // 万剑连环: five flying swords arrive one after another, one per game of the streak, inside a turning sword ring.
 streak:<>
  <circle className="fx-ring" cx={124} cy={66} r={50}/>
  <circle className="fx-ring is-inner" cx={124} cy={66} r={38}/>
  {[[118,26],[132,46],[140,66],[132,86],[118,106]].map(([x,y],i)=><g key={i} transform={`translate(${x} ${y})`}><g className="fx-sword" style={n(i)}>{sword}</g></g>)}
 </>,
 // 雷霆破军: storm clouds, a bolt that splits the ground, a flash, shock rings and flying rock.
 rout:<>
  <g className="fx-clouds"><ellipse cx={70} cy={10} rx={58} ry={18}/><ellipse cx={150} cy={6} rx={66} ry={20}/><ellipse cx={214} cy={14} rx={44} ry={16}/></g>
  <g className="fx-cracks"><path d="M118 104L92 112L70 109"/><path d="M118 104L146 113L170 110"/><path d="M118 104L112 124"/><path d="M118 104L134 124"/></g>
  <ellipse className="fx-shock" cx={118} cy={104} rx={64} ry={14}/>
  <ellipse className="fx-shock is-late" cx={118} cy={104} rx={92} ry={20}/>
  <path className="fx-bolt-glow" d="M140 6L120 46L136 49L114 104"/>
  <path className="fx-bolt" d="M140 6L120 46L136 49L114 104"/>
  <path className="fx-bolt is-branch" d="M120 46L100 64"/>
  {[[-34,-26],[30,-30],[-48,-12],[44,-14],[-14,-36],[18,-38]].map(([x,y],i)=><path key={i} className="fx-shard" d="M118 101l4 -5l3 5z" style={n(i,{'--dx':x+'px','--dy':y+'px'})}/>)}
  <rect className="fx-flash" width={240} height={132}/>
 </>,
 // 鲤跃龙门: a golden koi leaps from the waves over the dragon gate and blazes at the top.
 upset:<>
  <g className="fx-rays">{Array.from({length:12},(_,i)=><path key={i} d="M0 -14L3 -58L-3 -58Z" transform={`rotate(${i*30})`}/>)}</g>
  <g className="fx-gate"><path d="M150 40H206M146 34H210L204 40H152Z"/><rect x={156} y={40} width={7} height={70}/><rect x={193} y={40} width={7} height={70}/><path d="M163 52H193"/></g>
  <g className="fx-koi"><path className="fx-koi-body" d="M-15 0C-8 -8 8 -9 15 -2C17 0 17 1 15 2C8 9 -8 8 -15 0ZM-14 0L-24 -8L-21 0L-24 8Z"/><circle className="fx-koi-eye" cx={10} cy={-1.5} r={1.4}/><path className="fx-koi-fin" d="M-2 -6Q2 -13 6 -6"/></g>
  {[[-16,-30],[-4,-40],[10,-34],[20,-24]].map(([x,y],i)=><circle key={i} className="fx-drop" cx={48} cy={112} r={2.2} style={n(i,{'--dx':x+'px','--dy':y+'px'})}/>)}
  <g className="fx-waves"><path d="M-60 112Q-45 102 -30 112T0 112T30 112T60 112T90 112T120 112T150 112T180 112T210 112T240 112T270 112T300 112T330 112V132H-60Z"/><path className="is-back" d="M-60 120Q-45 112 -30 120T0 120T30 120T60 120T90 120T120 120T150 120T180 120T210 120T240 120T270 120T300 120T330 120V132H-60Z"/></g>
 </>,
 // 两仪鏖战: two qi orbs rush in and clash; from the clash a taiji turns with both orbs circling it, neither giving way.
 deuce:<>
  <circle className="fx-orb-in is-yang" cx={120} cy={62} r={7}/>
  <circle className="fx-orb-in is-yin" cx={120} cy={62} r={7}/>
  <g className="fx-sparks">{Array.from({length:10},(_,i)=><path key={i} d="M0 -8V-20" transform={`translate(120 62) rotate(${i*36})`} style={n(i)}/>)}</g>
  <g className="fx-taiji-wrap"><g className="fx-taiji">
   <circle className="is-yang" cx={120} cy={62} r={28}/>
   <path className="is-yin" d="M120 34A28 28 0 0 1 120 90A14 14 0 0 1 120 62A14 14 0 0 0 120 34Z"/>
   <circle className="is-yin" cx={120} cy={48} r={4}/><circle className="is-yang" cx={120} cy={76} r={4}/>
  </g></g>
  <g className="fx-orbit"><circle className="fx-orb is-yang" cx={72} cy={62} r={6}/><circle className="fx-orb is-yin" cx={168} cy={62} r={6}/></g>
 </>,
};
