import {euro} from './form-fields';
import type {Event} from '../lib/domain/types';
export default function PracticeInfo({e}:{e:Event}){return <section className="card practice-info"><div className="row"><h2>练习内容</h2><span className="badge">练球 · 不计积分</span></div><p className="prewrap">{e.note}</p><p className="hint">场地默认上限 {e.capacity} 人 · 单颗球价 {euro(e.practiceShuttleCents??200)}。费用按接龙参加时段分摊，耗球可在费用页补录。</p></section>}
