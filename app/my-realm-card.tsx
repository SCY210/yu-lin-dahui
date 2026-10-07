'use client';

import RealmBadge from './realm-badge';
import RealmProgress from './realm-progress';

type Cultivation = Parameters<typeof RealmProgress>[0]['value'];

export default function MyRealmCard({stats}: {
  stats?: {tier?: string; cultivation?: Cultivation};
}) {
  const cultivation = stats?.cultivation;
  const realm = cultivation?.realm ?? stats?.tier;

  return <section className="card me-realm-card" aria-label="我的修仙境界">
    <span>修仙境界</span>
    {realm ? <div className="me-realm-badge-wrap">
      <RealmBadge className="me-realm-badge" realm={realm} stage={cultivation?.stage}/>
    </div> : <strong>暂无境界</strong>}
    <small>修为随实际计分比赛累积</small>
    <RealmProgress compact value={cultivation}/>
  </section>;
}
