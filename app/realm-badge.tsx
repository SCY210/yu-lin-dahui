'use client';
import {useEffect,useId,useRef,useState,type CSSProperties,type RefObject,type SVGProps} from 'react';
import {realmPolicy, realms} from '@/lib/domain/realm-rating';
import './realm-badge.css';

export interface RankInfo {
  n: string;
  p: string;
  /** Main pigment, its light wash and deep ink. */
  c: string;
  l: string;
  d: string;
  /** Rim colour; the highest realm is edged in gold. */
  r: string;
  t: string;
  k: number;
}

/** Mineral pigments chosen to sit on rice paper, lavender and pink surfaces alike; 化神 is ink and gold. */
export const RANKS: RankInfo[] = [
  {n: '炼气', p: 'LIÀN QÌ', c: '#5b7684', l: '#a9bcc4', d: '#34474f', r: '#34474f', t: '一缕灵气入体', k: 1},
  {n: '筑基', p: 'ZHÙ JĪ', c: '#3c8564', l: '#93ccac', d: '#24563f', r: '#24563f', t: '层层夯实道基', k: 2},
  {n: '金丹', p: 'JĪN DĀN', c: '#b9862c', l: '#f1d28a', d: '#7d5314', r: '#7d5314', t: '灵力凝结成丹', k: 3},
  {n: '元婴', p: 'YUÁN YĪNG', c: '#7558a6', l: '#bfaadf', d: '#4a3473', r: '#4a3473', t: '丹碎婴生，神游', k: 4},
  {n: '化神', p: 'HUÀ SHÉN', c: '#45423b', l: '#9a9484', d: '#16150f', r: '#d6ae5c', t: '神念通天，睁眼开天', k: 5}
];

export function getRankByRealm(realm: string): {rank: RankInfo; level: number} {
  const norm = realm.trim().replace(/^练气$/, '炼气');
  const index = realms.findIndex(r => r.name === norm);
  const level = index >= 0 ? index : 0;
  return {rank: RANKS[level] ?? RANKS[0], level};
}

const PAPER = '#fffaf0';
// Rounded coordinates keep server and browser markup identical across JS engines.
const f = (n: number) => Math.round(n * 10) / 10;
const polar = (r: number, deg: number) => [f(100 + r * Math.cos(deg * Math.PI / 180)), f(100 + r * Math.sin(deg * Math.PI / 180))];
const polygon = (sides: number, radius: number, offset: number) =>
  Array.from({length: sides}, (_, i) => polar(radius, offset + i * 360 / sides).join(',')).join(' ');
const star = (tips: number, outer: number, inner: number) =>
  Array.from({length: tips * 2}, (_, i) => polar(i % 2 ? inner : outer, -90 + i * 180 / tips).join(',')).join(' ');
/** Eight scalloped lotus petals around the centre. */
function lotus(scale: number) {
  const valley = 64 * scale, tip = 92 * scale;
  const points = Array.from({length: 8}, (_, i) => ({v: polar(valley, -67.5 + i * 45), c: polar(tip, -90 + i * 45)}));
  return `M${points[7].v.join(' ')}` + points.map(p => ` Q${p.c.join(' ')} ${p.v.join(' ')}`).join('') + 'Z';
}

type SealPaint = Pick<SVGProps<SVGElement>, 'fill' | 'stroke' | 'strokeOpacity' | 'strokeWidth' | 'strokeLinejoin'>;
/** Each realm has its own seal silhouette, echoing the reference medallions. */
function Seal({level, scale = 1, ...paint}: {level: number; scale?: number} & SealPaint) {
  if (level === 0) return <polygon points={polygon(8, 76 * scale, 22.5)} {...paint} />;
  if (level === 1) return <polygon points={polygon(6, 79 * scale, -90)} {...paint} />;
  if (level === 2) return <polygon points={star(12, 80 * scale, 69 * scale)} {...paint} />;
  if (level === 3) return <path d={lotus(scale)} {...paint} />;
  return <circle cx="100" cy="100" r={f(74 * scale)} {...paint} />;
}

/** Orbit ring with one node per realm level: the tier count stays readable at a glance.
 * It rests at 炼气 and turns faster with every realm; 化神 nodes are gold. */
function Orbit({level, rank}: {level: number; rank: RankInfo}) {
  return (
    <>
      <circle cx="100" cy="100" r="93" fill="none" stroke={level === 4 ? rank.r : rank.c} strokeOpacity={level === 4 ? 0.7 : 0.32} strokeWidth="2.5" />
      <g className="rb-o rb-orbit">
        {Array.from({length: rank.k}, (_, i) => {
          const [cx, cy] = polar(93, -90 + i * 360 / rank.k);
          return <circle key={i} cx={cx} cy={cy} r="7.5" fill={level === 4 ? rank.r : rank.c} stroke={PAPER} strokeWidth="3" />;
        })}
      </g>
    </>
  );
}

/**
 * Core art, drawn in paper colour on the pigment seal. Every realm moves:
 * 0 · 炼气: 灵气入体螺旋
 * 1 · 筑基: 逐层夯实的道基
 * 2 · 金丹: 缓转丹环 + 呼吸金丹
 * 3 · 元婴: 莲台中的元婴法相
 * 4 · 化神: 万丈神光 + 天眼 + 雷弧
 */
function Core({level, rank}: {level: number; rank: RankInfo}) {
  if (level === 0) {
    const spiral = 'M100 100 A5 5 0 0 1 110 100 A10 10 0 0 1 90 100 A15 15 0 0 1 120 100 A20 20 0 0 1 80 100 A25 25 0 0 1 130 100 A30 30 0 0 1 70 100';
    return (
      <>
        <path d={spiral} fill="none" stroke={PAPER} strokeOpacity="0.3" strokeWidth="7" strokeLinecap="round" />
        <path d={spiral} fill="none" stroke={PAPER} strokeWidth="7" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" className="rb-draw" />
        <circle cx="100" cy="100" r="6" fill={PAPER} className="rb-pl" />
      </>
    );
  }

  if (level === 1) {
    const bars = [{w: 72, y: 119}, {w: 56, y: 102}, {w: 40, y: 85}];
    return (
      <>
        {bars.map((bar, i) => (
          <rect key={i} x={100 - bar.w / 2} y={bar.y} width={bar.w} height="12" rx="2.5" fill={PAPER} className="rb-rise" style={{'--rb-delay': `${i * 0.6}s`} as CSSProperties} />
        ))}
        <path d="M100 62 L100 74" stroke={PAPER} strokeWidth="6" strokeLinecap="round" className="rb-pl" />
      </>
    );
  }

  if (level === 2) {
    return (
      <>
        <circle cx="100" cy="100" r="42" fill="none" stroke={PAPER} strokeOpacity="0.85" strokeWidth="4.5" strokeDasharray="11 7" className="rb-o rb-spinr" />
        <g className="rb-breathe">
          <circle cx="100" cy="100" r="25" fill={PAPER} />
          <circle cx="100" cy="100" r="15" fill={rank.l} />
          <path d="M100 85 A7.5 7.5 0 0 1 100 100 A7.5 7.5 0 0 0 100 115" fill="none" stroke={rank.d} strokeOpacity="0.6" strokeWidth="3.5" strokeLinecap="round" className="rb-o rb-fast" />
        </g>
      </>
    );
  }

  if (level === 3) {
    return (
      <>
        <circle cx="100" cy="100" r="47" fill="none" stroke={PAPER} strokeOpacity="0.55" strokeWidth="3.5" strokeDasharray="4 8" strokeLinecap="round" className="rb-o rb-spinr" />
        <g className="rb-breathe">
          <circle cx="100" cy="79" r="12" fill={PAPER} />
          <path d="M100 96 C115 96 123 116 127 129 L73 129 C77 116 85 96 100 96Z" fill={PAPER} />
          <circle cx="100" cy="114" r="5" fill={rank.c} />
        </g>
      </>
    );
  }

  return (
    <>
      <g className="rb-o rb-rays">
        {Array.from({length: 24}, (_, i) => {
          const angle = -90 + 7.5 + i * 15, end = i % 2 ? 87 : 92;
          const [x1, y1] = polar(81, angle), [x2, y2] = polar(end, angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={rank.r} strokeWidth={i % 2 ? 3 : 4.5} strokeLinecap="round" className="rb-ray" style={{'--rb-delay': `${(i % 6) * 0.3}s`} as CSSProperties} />;
        })}
      </g>
      <path d="M56 100 Q100 64 144 100 Q100 136 56 100Z" fill={PAPER} stroke={rank.r} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="100" cy="100" r="17" fill={rank.r} className="rb-pl" />
      <ellipse cx="100" cy="100" rx="4" ry="12" fill={rank.d} />
      <circle cx="106" cy="94" r="3.2" fill={PAPER} />
      {ARCS.map((d, i) => (
        <g key={i} className="rb-arc" style={{'--rb-arc': `${ARC_RHYTHM[i][0]}s`, '--rb-delay': `${ARC_RHYTHM[i][1]}s`} as CSSProperties}>
          <path d={d} className="rb-arc-glow" fill="none" stroke={rank.r} strokeOpacity="0.55" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} className="rb-arc-core" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </>
  );
}

/** Short lightning arcs that crackle on the 化神 orbit. */
const ARCS = ['M34 54 L24 46 L31 43 L19 31', 'M168 106 L182 102 L177 95 L193 89', 'M94 172 L101 183 L94 187 L102 198'];
/** Duration and delay per arc, so the crackle never falls into a regular beat. */
const ARC_RHYTHM = [[2.3, 0], [3.1, -1.2], [3.7, -2.6]];

export function RealmInsigniaSvg({level, rank}: {level: number; rank: RankInfo}) {
  const id = useId().replace(/[^\w-]/g, '');
  const gradient = `rb-g-${id}`, glow = `rb-h-${id}`;
  return (
    <svg viewBox="0 0 200 200" className="rb-svg" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0" stopColor={rank.l} />
          <stop offset="0.5" stopColor={rank.c} />
          <stop offset="1" stopColor={rank.d} />
        </linearGradient>
        {level >= 2 && (
          <radialGradient id={glow}>
            <stop offset="0.6" stopColor={level === 4 ? rank.r : rank.c} stopOpacity="0.55" />
            <stop offset="1" stopColor={level === 4 ? rank.r : rank.c} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      {level >= 2 && <circle cx="100" cy="100" r="100" fill={`url(#${glow})`} className="rb-glow" />}
      <Orbit level={level} rank={rank} />
      <g className={level === 2 ? 'rb-o rb-sun' : level === 3 ? 'rb-o rb-lotus' : undefined}>
        <Seal level={level} fill={`url(#${gradient})`} stroke={rank.r} strokeWidth={level === 4 ? 5 : 4} strokeLinejoin="round" />
        <Seal level={level} fill="none" scale={0.86} stroke={PAPER} strokeOpacity="0.45" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <Core level={level} rank={rank} />
    </svg>
  );
}

// One observer serves every badge on the page; long ranking lists stay cheap.
const visibilityCallbacks = new Map<Element, (visible: boolean) => void>();
let sharedObserver: IntersectionObserver | null = null;
function observeVisibility(element: Element, callback: (visible: boolean) => void) {
  if (typeof IntersectionObserver === 'undefined') {
    callback(true);
    return () => {};
  }
  sharedObserver ??= new IntersectionObserver(entries => {
    for (const entry of entries) visibilityCallbacks.get(entry.target)?.(entry.isIntersecting);
  });
  visibilityCallbacks.set(element, callback);
  sharedObserver.observe(element);
  return () => {
    visibilityCallbacks.delete(element);
    sharedObserver?.unobserve(element);
  };
}

/** Decorative motion only runs while the badge is on screen and the page is visible. */
function useOnScreenMotion(ref: RefObject<Element | null>) {
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let inView = false;
    const update = () => setMoving(inView && !document.hidden);
    const stop = observeVisibility(element, visible => {
      inView = visible;
      update();
    });
    document.addEventListener('visibilitychange', update);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', update);
    };
  }, [ref]);
  return moving;
}

const moteCount = [0, 0, 2, 4, 0];
const dots = (count: number) => Array.from({length: count}, (_, i) => <i key={i} />);

/** 化神's storm: drifting clouds inside the tag, two lightning bolts and the light they cast. */
function Storm() {
  return (
    <>
      <span className="rb-storm" aria-hidden="true">
        {dots(4)}
        <b className="rb-flash rb-flash-a" />
        <b className="rb-flash rb-flash-b" />
        <svg className="rb-bolts" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path className="rb-bolt rb-bolt-a" d="M62 -2 L57 8 L61 10 L54 19 L58 21 L51 32 M61 10 L68 15" />
          <path className="rb-bolt rb-bolt-b" d="M90 -2 L86 7 L89 9 L83 17 L87 19 L81 32" />
        </svg>
      </span>
      <span className="rb-mist" aria-hidden="true">{dots(5)}</span>
    </>
  );
}

/** Neutral ink for the placement chip: no realm pigment until the realm is known. */
const PLACEMENT: Pick<RankInfo, 'c' | 'l' | 'd' | 'r'> = {c: '#8a8174', l: '#ddd5c5', d: '#4f4a42', r: '#6d665b'};

/** An uncarved seal: a dashed outline that slowly turns, one bead per placement game (filled once
 * settled) and the next bead pulsing; the centre breathes. */
export function PlacementSealSvg({games, total}: {games: number; total: number}) {
  return (
    <svg viewBox="0 0 200 200" className="rb-svg" aria-hidden="true">
      <circle cx="100" cy="100" r="88" fill={PAPER} stroke={PLACEMENT.c} strokeOpacity="0.18" strokeWidth="5" />
      <circle cx="100" cy="100" r="88" fill="none" stroke={PLACEMENT.r} strokeWidth="5" strokeDasharray="15 11" strokeLinecap="round" className="rb-o rb-trace" />
      {Array.from({length: total}, (_, i) => {
        const [cx, cy] = polar(60, -90 + i * 360 / total), done = i < games;
        return <circle key={i} cx={cx} cy={cy} r="11" fill={done ? PLACEMENT.r : PAPER} stroke={PLACEMENT.r} strokeOpacity={done ? 1 : 0.5} strokeWidth="4" className={i === games ? 'rb-pl' : undefined} />;
      })}
      <g className="rb-breathe">
        <circle cx="100" cy="100" r="22" fill={PLACEMENT.l} />
        <circle cx="100" cy="100" r="9" fill={PLACEMENT.c} />
      </g>
    </svg>
  );
}

/**
 * Shown instead of a realm while a player has fewer than placementGames settled rated games:
 * a plain paper tag with the uncarved seal, "定级中" and the settled count.
 */
export function PlacementBadge({games, total = realmPolicy.placementGames, className = ''}: {games?: number; total?: number; className?: string}) {
  const badge = useRef<HTMLSpanElement>(null);
  const moving = useOnScreenMotion(badge);
  const done = Math.max(0, Math.min(total, Math.floor(games ?? 0)));
  return (
    <span
      ref={badge}
      data-motion={moving ? 'running' : 'paused'}
      className={`realm-badge realm-badge-placement${className ? ' ' + className : ''}`}
      style={{'--rb-c': PLACEMENT.c, '--rb-l': PLACEMENT.l, '--rb-d': PLACEMENT.d, '--rb-r': PLACEMENT.r} as CSSProperties}
      title={`定级中：已结算 ${done}/${total} 个计分小局，满 ${total} 局后显示境界`}
    >
      <span className="rb-insignia-wrap" aria-hidden="true">
        <PlacementSealSvg games={done} total={total} />
      </span>
      <span className="rb-txt">
        <strong className="rb-name">定级中</strong>
        <span className="rb-stage">· {done}/{total} 局</span>
      </span>
    </span>
  );
}

/**
 * Animated realm badge: a pigment seal on a paper tag that takes its surface from the active theme.
 * Every realm moves, and each realm adds splendour: 金丹 a gold-leaf tag with embers and a warm glowing
 * name; 元婴 a starlit tag, spirit ripples and motes; 化神 a thundercloud sky with drifting mist and lightning.
 */
export default function RealmBadge({realm, stage, className = ''}: {realm: string; stage?: string; className?: string}) {
  const {rank, level} = getRankByRealm(realm);
  const badge = useRef<HTMLSpanElement>(null);
  const moving = useOnScreenMotion(badge);
  return (
    <span
      ref={badge}
      data-motion={moving ? 'running' : 'paused'}
      className={`realm-badge realm-badge-${level}${className ? ' ' + className : ''}`}
      style={{'--rb-c': rank.c, '--rb-l': rank.l, '--rb-d': rank.d, '--rb-r': rank.r} as CSSProperties}
    >
      {(level === 2 || level === 3) && <span className="rb-sheen" aria-hidden="true" />}
      {level === 4 && <Storm />}
      <span className="rb-insignia-wrap" aria-hidden="true">
        {level === 3 && <span className="rb-ripple" />}
        <RealmInsigniaSvg level={level} rank={rank} />
        {moteCount[level] > 0 && <span className="rb-motes">{dots(moteCount[level])}</span>}
      </span>
      <span className="rb-txt">
        <strong className="rb-name">{realm}</strong>
        {stage && <span className="rb-stage">· {stage}</span>}
      </span>
    </span>
  );
}
