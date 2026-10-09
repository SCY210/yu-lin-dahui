'use client';

import RealmBadge from './realm-badge';
import RealmProgress from './realm-progress';

type RealmScore = Parameters<typeof RealmProgress>[0]['value'];

export default function MyRealmCard({stats}: {
  stats?: {tier?: string; realmScore?: RealmScore};
}) {
  const realmScore = stats?.realmScore;
  const realm = realmScore?.realm ?? stats?.tier;

  return <section className="card me-realm-card" aria-label="我的修仙境界">
    <span>修仙境界</span>
    {realm ? <div className="me-realm-badge-wrap">
      <RealmBadge className="me-realm-badge" realm={realm} stage={realmScore?.placement ? '定级中' : realmScore?.stage}/>
    </div> : <strong>暂无境界</strong>}
    <small>境界由段位分决定，赢强队多加、输弱队多扣</small>
    <RealmProgress compact value={realmScore}/>
  </section>;
}
