import {cultivationRealms} from '@/lib/domain/cultivation';
import './realm-badge.css';

/**
 * Animated realm badge — each cultivation rank gets its own visual style,
 * progressing from plain (炼气) to golden shimmer (化神).
 */
export default function RealmBadge({realm, stage, className = ''}: {realm: string; stage?: string; className?: string}) {
  const index = cultivationRealms.findIndex(r => r.name === realm);
  const level = index >= 0 ? index : 0;
  return (
    <span className={`realm-badge realm-badge-${level}${className ? ' ' + className : ''}`}>
      <span>{realm}{stage ? ' · ' + stage : ''}</span>
    </span>
  );
}
