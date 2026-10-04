'use client';

import {useId} from 'react';
import {Crown} from 'lucide-react';
import {Avatar} from './social-hub';
import './ranking-podium.css';

function Medal({rank}: {rank: number}) {
  const id = useId().replace(/:/g, '');
  const metals = rank === 1
    ? ['#fff3b4', '#d9ad46', '#b88321', '#815714']
    : rank === 2
      ? ['#ffffff', '#d0d7e2', '#9aa6bb', '#58677e']
      : ['#f9dbc7', '#cc976c', '#ab7047', '#77452d'];
  return <svg className="rp-medal" viewBox="0 0 84 96" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={metals[0]}/>
        <stop offset="38%" stopColor={metals[1]}/>
        <stop offset="67%" stopColor={metals[0]}/>
        <stop offset="100%" stopColor={metals[2]}/>
      </linearGradient>
    </defs>
    <path d="M24 5h15l9 30-17 9z" fill="#5e54a8"/>
    <path d="M45 5h15L53 44l-17-9z" fill="#8177c5"/>
    <path d="M28 5h4l9 29-4 2zM50 5h4l-7 31-4-2z" fill="#c6bfe9" opacity=".65"/>
    <circle cx="42" cy="58" r="31" fill={metals[2]} opacity=".2"/>
    <circle cx="42" cy="55" r="30" fill={`url(#${id})`} stroke={metals[2]} strokeWidth="1.2"/>
    <circle cx="42" cy="55" r="24" fill="none" stroke={metals[3]} strokeOpacity=".35"/>
    <path d="m42 39 3 6.2 6.8 1-4.9 4.8 1.1 6.8-6-3.2-6 3.2 1.1-6.8-4.9-4.8 6.8-1z" fill={metals[3]} opacity=".68"/>
    <path d="M26 63q16 18 32 0" fill="none" stroke={metals[0]} strokeWidth="1.5" strokeLinecap="round" opacity=".8"/>
  </svg>;
}

/** The supplied rows retain their domain ranks, including competition ties. */
export default function RankingPodium({leaders, players, onProfile}: any) {
  const podium = (leaders ?? []).slice(0, 3);
  if (!podium.length) return null;
  const slots = ['center', 'left', 'right'];

  return <section className="rp-root" aria-label="积分领奖台">
    <div className="rp-stage">
      {slots.map((slot, index) => {
        const row = podium[index];
        if (!row) return <div key={slot} className={`rp-slot rp-${slot} rp-empty`} aria-label="此位置暂无计分球友">
          <div className="rp-empty-line" aria-hidden="true"/>
          <div className="rp-pedestal"><span aria-hidden="true">—</span></div>
        </div>;
        const player = (players ?? []).find((p: any) => p.id === row.playerId) ?? {name: row.name};
        const tied = podium.filter((r: any) => r.rank === row.rank).length > 1;
        const title = row.rank === 1 ? '冠军' : row.rank === 2 ? '亚军' : row.rank === 3 ? '季军' : `第 ${row.rank} 名`;
        const rankLabel = `${tied ? '并列' : ''}${title}`;
        const info = <>
          <span className="rp-crown-space" aria-hidden="true">{row.rank === 1 && <Crown className="rp-crown"/>}</span>
          <Avatar p={player} size="rp-avatar"/>
          <strong className="rp-name">{row.name}</strong>
        </>;
        return <article key={row.playerId} className={`rp-slot rp-${slot} rp-metal-${row.rank}`} aria-label={`${row.name}，${rankLabel}，${row.points} 积分`}>
          <div className="rp-person">
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
