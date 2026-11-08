'use client';

import RealmBadge, {PlacementBadge} from './realm-badge';
import RealmProgress from './realm-progress';
import RealmHistoryButton from './realm-history-button';

type RealmScore = Parameters<typeof RealmProgress>[0]['value'];

export default function MyRealmCard({stats,playerId,accountId}: {
  stats?: {tier?: string | null; provisional?: boolean; realmScore?: RealmScore};
  playerId?:string;accountId?:string;
}) {
  const realmScore = stats?.realmScore;
  const placement = !!(realmScore?.placement ?? stats?.provisional);
  const realm = realmScore?.realm ?? stats?.tier;
  const badge=placement?<PlacementBadge className="me-realm-badge" games={realmScore?.ratedGames} total={realmScore?.placementGames}/>:realm?<RealmBadge className="me-realm-badge" realm={realm} stage={realmScore?.stage ?? undefined}/>:null;

  return <section className="card me-realm-card" aria-label="我的修仙境界">
    <span>修仙境界</span>
    {badge?<div className="me-realm-badge-wrap">{playerId&&accountId?<RealmHistoryButton playerId={playerId} accountId={accountId}>{badge}</RealmHistoryButton>:badge}</div>:<strong>暂无境界</strong>}
    <small>{placement ? '定级期间暂不显示境界，修为照常加减' : '境界由修为决定，赢强队多加、输弱队多扣'}</small>
    <RealmProgress compact value={realmScore}/>
  </section>;
}
