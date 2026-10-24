import {eventRankingEnabled} from '../lib/domain/event-ranking';
import type {Event} from '../lib/domain/types';
import './points-match-badge.css';

/** The 积分赛 mark: a gold hexagonal seal with a shuttlecock and a star, shown beside the activity state badge on
 * activity cards, the activity page and the home page's running card. Ordinary and practice activities show nothing. */
export function PointsMatchMark({size=16}:{size?:number}){
 return <svg className="points-match-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M12 1.6 21 6.8v10.4L12 22.4 3 17.2V6.8Z" fill="#7a4f05" stroke="#fff6d8" strokeWidth="1.4" strokeLinejoin="round"/>
  <path d="M8.3 7.4 10.6 14h2.8l2.3-6.6" fill="none" stroke="#fff6d8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M12 7v7" stroke="#fff6d8" strokeWidth="1.3" strokeLinecap="round"/>
  <circle cx="12" cy="16.3" r="2.2" fill="#fff6d8"/>
  <path d="m18.4 2.4.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" fill="#ffe27a"/>
 </svg>;
}
export default function PointsMatchBadge({e}:{e:Pick<Event,'matchFormat'|'ranked'>}){
 if(!eventRankingEnabled(e))return null;
 return <span className="badge points-match-badge" title="积分赛：计入积分与修为"><PointsMatchMark/>积分赛</span>;
}
