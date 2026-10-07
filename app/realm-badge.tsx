'use client';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import './realm-badge.css';

export interface RankInfo {
  n: string;
  p: string;
  c: string;
  t: string;
  k: number;
}

export const RANKS: RankInfo[] = [
  {n: '炼气', p: 'LIÀN QÌ', c: '#7fe3ff', t: '一缕灵气入体', k: 1},
  {n: '筑基', p: 'ZHÙ JĪ', c: '#6ee7a0', t: '层层夯实道基', k: 2},
  {n: '金丹', p: 'JĪN DĀN', c: '#ffc94d', t: '灵力凝结成丹', k: 3},
  {n: '元婴', p: 'YUÁN YĪNG', c: '#b69cff', t: '丹碎婴生，神游', k: 4},
  {n: '化神', p: 'HUÀ SHÉN', c: '#ff7a7a', t: '神念通天，睁眼开天', k: 5}
];

export function getRankByRealm(realm: string): {rank: RankInfo; level: number} {
  const norm = realm.trim().replace(/^练气$/, '炼气');
  const index = RANKS.findIndex(r => r.n === norm);
  const level = index >= 0 ? index : 0;
  return {rank: RANKS[level] ?? RANKS[0], level};
}

/**
 * Insignia frame: outer ring + inner dashed reverse-spinning ring + k orbiting nodes
 */
function InsigniaFrame({rank}: {rank: RankInfo}) {
  return (
    <>
      <circle cx="100" cy="100" r="90" fill="none" stroke={rank.c} strokeOpacity="0.48" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="84" fill="none" stroke={rank.c} strokeOpacity="0.72" strokeWidth="1.4" strokeDasharray="2 7" className="rb-o rb-spinr" />
      <g className={`rb-o ${rank.k > 3 ? 'rb-fast' : 'rb-spin'}`}>
        {Array.from({length: rank.k}).map((_, i) => {
          const a = (i / rank.k) * Math.PI * 2 - Math.PI / 2;
          const cx = 100 + 90 * Math.cos(a);
          const cy = 100 + 90 * Math.sin(a);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="4.2" fill={rank.c} />
              <circle cx={cx} cy={cy} r="8" fill="none" stroke={rank.c} strokeOpacity="0.55" strokeWidth="1.2" />
            </g>
          );
        })}
      </g>
    </>
  );
}

/**
 * Insignia core art:
 * 0 · 练气: 灵气入体螺旋
 * 1 · 筑基: 六角神坛 + 逐层筑基石
 * 2 · 金丹: 呼吸光晕 + 炽阳金丹核心
 * 3 · 元婴: 八方旋转莲瓣 + 神游元婴法相
 * 4 · 化神: 24道万丈神光射线 + 睁眼开天天眼
 */
function InsigniaCore({level, rank, gradId}: {level: number; rank: RankInfo; gradId: string}) {
  if (level === 0) {
    return (
      <>
        <path
          d="M100 100 C100 92 108 92 108 100 C108 112 92 112 92 100 C92 84 116 84 116 100 C116 122 84 122 84 100 C84 76 124 76 124 100 C124 132 76 132 76 100 C76 68 132 68 132 100"
          fill="none"
          stroke={rank.c}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="400"
          className="rb-draw-path"
        />
        <circle cx="100" cy="100" r="3.5" fill="#fff" stroke={rank.c} strokeWidth="1" className="rb-pl" />
      </>
    );
  }

  if (level === 1) {
    const bars = [
      {w: 118, y: 116, delay: 0},
      {w: 102, y: 100, delay: 0.7},
      {w: 86, y: 84, delay: 1.4}
    ];
    return (
      <>
        <polygon points="100,38 153,69 153,131 100,162 47,131 47,69" fill="none" stroke={rank.c} strokeWidth="2.4" strokeLinejoin="round" />
        {bars.map((v, i) => (
          <rect
            key={i}
            x={100 - v.w / 2}
            y={v.y}
            width={v.w}
            height="11"
            rx="2"
            fill={rank.c}
            className="rb-rise-rect"
            style={{'--rb-delay': `${v.delay}s`} as CSSProperties}
          />
        ))}
        <path d="M100 54 L100 72" stroke={rank.c} strokeWidth="2.4" strokeLinecap="round" className="rb-pl" />
      </>
    );
  }

  if (level === 2) {
    return (
      <>
        <defs>
          <radialGradient id={gradId}>
            <stop offset="0" stopColor="#fff6c8" />
            <stop offset="0.5" stopColor={rank.c} />
            <stop offset="1" stopColor="#b8741a" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="52" fill="none" stroke={rank.c} strokeWidth="1.5" strokeDasharray="14 6" className="rb-o rb-spin" />
        <circle cx="100" cy="100" r="42" fill="none" stroke={rank.c} strokeOpacity="0.5" className="rb-pl" />
        <circle cx="100" cy="100" r="30" fill={`url(#${gradId})`} className="rb-breathe-circle" />
        <path d="M100 70 A15 15 0 0 1 100 100 A15 15 0 0 0 100 130" fill="none" stroke="#7a4a0c" strokeOpacity="0.55" strokeWidth="2.4" className="rb-o rb-fast" />
      </>
    );
  }

  if (level === 3) {
    return (
      <>
        <g className="rb-o rb-spin">
          {Array.from({length: 8}).map((_, i) => (
            <ellipse
              key={i}
              cx="100"
              cy="64"
              rx="9"
              ry="22"
              fill={rank.c}
              fillOpacity="0.2"
              stroke={rank.c}
              strokeWidth="1.4"
              transform={`rotate(${i * 45} 100 100)`}
            />
          ))}
        </g>
        <g className="rb-nascent-soul">
          <circle cx="100" cy="112" r="17" fill={rank.c} />
          <circle cx="92" cy="92" r="8" fill={rank.c} />
          <path d="M78 118 A24 24 0 0 0 122 118" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
        </g>
      </>
    );
  }

  // level 4: 化神
  return (
    <>
      <g>
        {Array.from({length: 24}).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const L = i % 2 ? 12 : 22;
          return (
            <line
              key={i}
              x1={100 + 52 * Math.cos(a)}
              y1={100 + 52 * Math.sin(a)}
              x2={100 + (52 + L) * Math.cos(a)}
              y2={100 + (52 + L) * Math.sin(a)}
              stroke={rank.c}
              strokeWidth={i % 2 ? 1.5 : 2.6}
              strokeLinecap="round"
              className="rb-ray-line"
              style={{'--rb-delay': `${(i % 6) * 0.25}s`} as CSSProperties}
            />
          );
        })}
      </g>
      <circle cx="100" cy="100" r="46" fill="none" stroke={rank.c} strokeOpacity="0.45" className="rb-o rb-spinr" />
      <path d="M60 100 Q100 62 140 100 Q100 138 60 100Z" fill="#1e2822" stroke={rank.c} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="100" cy="100" r="15" fill={rank.c} className="rb-pl" />
      <ellipse cx="100" cy="100" rx="3" ry="13" fill="#fff" />
    </>
  );
}

export function RealmInsigniaSvg({level, rank}: {level: number; rank: RankInfo}) {
  const gradId = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 200 200" className="rb-svg" role="img" aria-label={`${rank.n}徽记`}>
      <InsigniaFrame rank={rank} />
      <InsigniaCore level={level} rank={rank} gradId={`rb-g3-${gradId}`} />
    </svg>
  );
}

/**
 * Animated realm badge directly rendering the design from `修行段位徽记 · 练气至化神.html`
 */
export default function RealmBadge({realm, stage, className = ''}: {realm: string; stage?: string; className?: string}) {
  const {rank, level} = getRankByRealm(realm);
  const badge=useRef<HTMLSpanElement>(null),[moving,setMoving]=useState(false);
  useEffect(()=>{
    let inView=false;
    const update=()=>setMoving(inView&&!document.hidden);
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{inView=entries.some(entry=>entry.isIntersecting);update();});
    if(observer&&badge.current)observer.observe(badge.current);
    else {inView=true;update();}
    document.addEventListener('visibilitychange',update);
    return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',update);};
  },[]);
  return (
    <span
      ref={badge}
      data-motion={moving?'running':'paused'}
      className={`realm-badge realm-badge-${level}${className ? ' ' + className : ''}`}
      style={{
        '--rb-c': rank.c,
      } as CSSProperties}
    >
      <span className="rb-insignia-wrap" aria-hidden="true">
        <RealmInsigniaSvg level={level} rank={rank} />
      </span>
      <span className="rb-txt">
        <strong className="rb-name">{realm}</strong>
        {stage && <span className="rb-stage">· {stage}</span>}
      </span>
    </span>
  );
}
