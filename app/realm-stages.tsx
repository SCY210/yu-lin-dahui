import RealmBadge from './realm-badge';
import {realmPolicy} from '../lib/domain/realm-rating';
import {realmStageRows} from '../lib/client/realm-stages';

const rows=realmStageRows();
export default function RealmStages(){
 return <section className="realm-stage-catalog" aria-label="全部修为境界与阶段"><p className="hint">前 {realmPolicy.placementGames} 个已结算计分小局为定级期。达到下列门槛晋升；已持有的境界有 {realmPolicy.demotionBuffer} 分保级缓冲。</p>
  <ul>{rows.map(row=><li key={row.realm}><div className="realm-stage-heading"><RealmBadge realm={row.realm}/><span>{row.range}</span></div><dl>{row.stages.map(stage=><div key={stage.stage}><dt>{stage.stage}</dt><dd>{stage.from===null?stage.to+' 及以下':stage.to===Infinity?stage.from+' 及以上':stage.from+'–'+stage.to}</dd></div>)}</dl></li>)}</ul>
 </section>;
}
