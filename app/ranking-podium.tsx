'use client';

import {useId} from 'react';
import {Crown,Sparkles} from 'lucide-react';
import {Avatar} from './avatar';
import './ranking-podium.css';

const METALS: Record<number, string[]> = {
  1: ['#fff6c8', '#f0cb63', '#c99a2e', '#8a5f12', '#5c3d08'],
  2: ['#ffffff', '#e3e8ef', '#aeb8c7', '#6f7d92', '#46526a'],
  3: ['#ffe2cc', '#dca57a', '#b67449', '#7f4628', '#552c18'],
};
const TITLES: Record<number, string> = {1: '冠军', 2: '亚军', 3: '季军'};

/** A championship-style medal: a broad two-strap ribbon with an edge stripe and a metal clasp, a thick
 * rim, the place (冠军 / 亚军 / 季军) written above a small embossed shuttlecock, a beaded inner ring,
 * with light sweeping across the metal. No event marks are used. */
function Medal({rank}: {rank: number}) {
  const id = useId().replace(/:/g, '');
  const m = METALS[rank] ?? METALS[3];
  const rim = 'rp-rim-' + id, face = 'rp-face-' + id, clip = 'rp-clip-' + id;
  return <svg className="rp-medal" viewBox="0 0 84 96" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={m[0]}/><stop offset=".35" stopColor={m[1]}/><stop offset=".62" stopColor={m[3]}/><stop offset=".8" stopColor={m[1]}/><stop offset="1" stopColor={m[3]}/>
      </linearGradient>
      <radialGradient id={face} cx=".38" cy=".32" r=".8">
        <stop offset="0" stopColor={m[0]}/><stop offset=".45" stopColor={m[1]}/><stop offset="1" stopColor={m[2]}/>
      </radialGradient>
      <clipPath id={clip}><circle cx="42" cy="64" r="27.5"/></clipPath>
    </defs>
    <path className="rp-ribbon" d="M10 0h22l14 37-12 4z"/>
    <path className="rp-ribbon rp-ribbon-back" d="M52 0h22L50 41l-12-4z"/>
    <path className="rp-ribbon-stripe" d="M18 0h6l13.5 35.6-3 1.1zM60 0h6L46.5 36.7l-3-1.1z"/>
    <circle cx="42.6" cy="65.2" r="28" fill="#00000026"/>
    <circle cx="42" cy="64" r="28" fill={`url(#${rim})`} stroke={m[4]} strokeWidth=".8"/>
    <rect x="35" y="31.5" width="14" height="6.5" rx="2" fill={`url(#${rim})`} stroke={m[4]} strokeWidth=".7"/>
    <path d="M37.5 34.7h9" stroke={m[0]} strokeWidth=".8" strokeLinecap="round" opacity=".8"/>
    <circle cx="42" cy="64" r="21" fill={`url(#${face})`} stroke={m[3]} strokeWidth="1"/>
    <circle cx="42" cy="64" r="19.2" fill="none" stroke={m[3]} strokeWidth="1.1" strokeDasharray=".1 2.4" strokeLinecap="round" opacity=".75"/>
    <text className="rp-face-text" x="42" y="57.2" textAnchor="middle" fill={m[4]}>{TITLES[rank] ?? '第' + rank + '名'}</text>
    <g className="rp-shuttle" strokeLinecap="round" strokeLinejoin="round" transform="translate(42 70) scale(.62) translate(-42 -66)">
      <g transform="translate(.5 .6)" stroke={m[4]} fill="none" opacity=".45"><path d="M36 58 L42 74 L48 58 M39 57.2 L42 74 M45 57.2 L42 74 M42 56.8 V74"/><path d="M35.5 58 Q42 54.2 48.5 58"/></g>
      <g stroke={m[3]} fill="none" strokeWidth="1.25"><path d="M36 58 L42 74 L48 58 M39 57.2 L42 74 M45 57.2 L42 74 M42 56.8 V74"/><path d="M35.5 58 Q42 54.2 48.5 58"/><path d="M37.5 63 Q42 61.6 46.5 63"/></g>
      <path d="M37.6 72.6 Q42 70.6 46.4 72.6 Q46.4 78.4 42 78.4 Q37.6 78.4 37.6 72.6Z" fill={m[3]}/>
      <path d="M39 73.2 Q42 72 45 73.2" fill="none" stroke={m[0]} strokeWidth=".9" opacity=".8"/>
    </g>
    <path d="M26 52 A19 19 0 0 1 46 45.5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".55"/>
    <g clipPath={`url(#${clip})`}><rect className="rp-medal-shine" x="6" y="30" width="12" height="70" fill="#fff" opacity=".45"/></g>
  </svg>;
}

function Feather({side}:{side:'left'|'right'}) {
  return <svg className={`rp-feather rp-feather-${side}`} viewBox="0 0 48 96" aria-hidden="true" focusable="false">
    <path d="M24 88C12 67 6 38 26 7c17 24 16 48-2 81Z" fill="currentColor" opacity=".12"/>
    <path d="M24 88c-1-27 1-53 2-75M24 70 12 48m13 9 13-18M25 43 16 26m10 4 7-12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".65"/>
  </svg>;
}

/** The supplied rows retain their domain ranks, including competition ties. */
export default function RankingPodium({leaders, rankingRows, players, onProfile, loading=false}: any) {
  const podium = (leaders ?? []).slice(0, 3);
  const slots = ['center', 'left', 'right'];

  return <section className="rp-root" aria-label="积分领奖台" aria-busy={loading}>
    {!podium.length&&<p className="rp-empty-status" role={loading?'status':undefined}>{loading?'正在读取排名…':'等待球友登台'}</p>}
    <div className="rp-stage">
      {slots.map((slot, index) => {
        const row = podium[index];
        if (!row) return <div key={slot} className={`rp-slot rp-${slot} rp-empty`} aria-label="此位置暂无计分球友">
          <div className="rp-empty-line" aria-hidden="true"/>
          <div className="rp-pedestal"><span aria-hidden="true">—</span></div>
        </div>;
        const player = (players ?? []).find((p: any) => p.id === row.playerId) ?? {name: row.name};
        const tied = (rankingRows??podium).filter((r: any) => r.rank === row.rank).length > 1;
        const title = row.rank === 1 ? '冠军' : row.rank === 2 ? '亚军' : row.rank === 3 ? '季军' : `第 ${row.rank} 名`;
        const rankLabel = `${tied ? '并列' : ''}${title}`;
        const info = <>
          <span className="rp-crown-space" aria-hidden="true">{row.rank === 1 && <Crown className="rp-crown"/>}</span>
          <Avatar p={player} size="rp-avatar"/>
          <strong className="rp-name">{row.name}</strong>
        </>;
        return <article key={row.playerId} className={`rp-slot rp-${slot} rp-metal-${row.rank}`} aria-label={`${row.name}，${rankLabel}，${row.points} 积分`}>
          <div className="rp-person">
            <div className="rp-aura" aria-hidden="true"><span className="rp-halo"/><span className="rp-orbit"/><Feather side="left"/><Feather side="right"/><Sparkles className="rp-spark rp-spark-left"/><Sparkles className="rp-spark rp-spark-right"/></div>
            {onProfile ? <button type="button" className="rp-profile" onClick={() => onProfile(row.playerId)} aria-label={`查看${row.name}的球员档案`}>{info}</button> : <div className="rp-profile rp-profile-static">{info}</div>}
            <div className="rp-score"><b>{row.points}</b><span>积分</span></div>
            <p className="rp-record">{row.wins}胜 <span>·</span> {row.losses}负</p>
          </div>
          <div className="rp-pedestal">
            <Medal rank={row.rank}/>
            <span className="rp-place">{rankLabel}</span>
            <b className="rp-number" aria-hidden="true">{row.rank}</b>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
