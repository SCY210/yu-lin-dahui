'use client';

import {useState} from 'react';
import {Activity, Camera, Flame, Pencil, Trophy, UserRound} from 'lucide-react';
import {choice, number, text} from './ui';
import PhotoGallery from './photo-gallery';
import FeatureGuide from './feature-guide';
import RacketGallery from './racket-gallery';
import './player-profile.css';

const defaults = {years:0, hand:'right', preference:'doubles', style:'', equipment:'', level:'beginner', racket:'', strings:'', tension:'', grip:'', shoes:''};
const hands:Record<string,string> = {right:'右手', left:'左手', both:'双手'};
const preferences:Record<string,string> = {doubles:'双打', singles:'单打', mixed:'混双', all:'都可以'};
const levels:Record<string,string> = {beginner:'萌新', intermediate:'进阶', advanced:'高手'};
const optional = (key:string, label:string) => ({...text(key, label), optional:true});

function ProfileAvatar({p}:any) {
  const [failedId, setFailedId] = useState<string|null>(null);
  const name:string = p.name || '球友';
  return p.avatarId && p.avatarId !== failedId
    ? <img className="pp-avatar" src={'/api/photos/'+p.avatarId} alt={p.name+'的头像'} onError={()=>setFailedId(p.avatarId)}/>
    : <span className="pp-avatar pp-avatar-fallback" aria-label={name+'的默认头像'}>{Array.from(name)[0]}</span>;
}

function Fact({label, value}: {label:string; value:unknown}) {
  const filled = value !== null && value !== undefined && String(value).trim() !== '';
  return <div className="pp-fact"><dt>{label}</dt><dd className={filled ? '' : 'pp-unfilled'}>{filled ? String(value) : '尚未填写'}</dd></div>;
}

export default function PlayerProfile({p, stats, ctx}:any) {
  if (!p) return null;
  const profile = {...defaults, ...p.profile};
  const canEdit = ctx.admin || p.ownerId === ctx.data.me.id;
  const rules = ctx.data.settings.rules;
  const state = stats ?? {};
  const edit = () => ctx.open('球友档案', 'profileDetails', {playerId:p.id, ...defaults, ...p.profile}, [
    number('years', '球龄（年）'),
    choice('hand', '惯用手', [['right','右手'], ['left','左手'], ['both','双手']]),
    choice('preference', '参赛偏好', [['doubles','双打'], ['singles','单打'], ['mixed','混双'], ['all','都可以']]),
    choice('level', '自评水平', [['beginner','萌新'], ['intermediate','进阶'], ['advanced','高手']]),
    optional('style', '我的打法（最多300字）'),
    optional('racket', '战拍品牌 / 型号（最多120字）'),
    optional('strings', '拍线品牌 / 型号（最多120字）'),
    optional('tension', '穿线磅数，如26磅（最多80字）'),
    optional('grip', '手胶 / 握把（最多80字）'),
    optional('shoes', '球鞋品牌 / 型号（最多120字）'),
    optional('equipment', '其他装备与备注（最多500字）'),
  ], undefined, '资料保存到球友档案，群内其他已登录成员可以查看。');

  return <section className="pp-card" aria-label={p.name+'的球友档案'}>
    <header className="pp-header">
      <ProfileAvatar p={p}/>
      <div className="pp-identity">
        <p className="pp-eyebrow">球友档案</p>
        <h2>{p.name}</h2>
        <div className="pp-badges">
          <span className="pp-tier">{state.tier || '暂无段位'}{state.provisional ? ' · 暂定' : ''}</span>
          <span className="pp-state">{state.form || '样本不足'}{state.formValue != null ? ` · ${state.formValue}/100` : ''}</span>
        </div>
      </div>
      {canEdit && <button type="button" className="pp-edit" onClick={edit}><Pencil size={16} aria-hidden="true"/>编辑档案</button>}
    </header>

    <section className="pp-section" aria-label="个人信息">
      <h3 className="pp-section-title"><UserRound size={18} aria-hidden="true"/>认识一下</h3>
      <dl className="pp-facts pp-personal-facts">
        <Fact label="球龄" value={p.profile?.years != null ? `${p.profile.years}年` : null}/>
        <Fact label="惯用手" value={hands[p.profile?.hand]}/>
        <Fact label="参赛偏好" value={preferences[p.profile?.preference]}/>
        <Fact label="自评水平" value={levels[p.profile?.level]}/>
      </dl>
      <div className="pp-style"><span>我的打法</span><p className={profile.style ? '' : 'pp-unfilled'}>{profile.style || '尚未填写'}</p></div>
    </section>

    <section className="pp-section" aria-label="装备信息">
      <div className="pp-section-heading"><h3 className="pp-section-title">我的球场装备</h3><span className="pp-section-note">球拍 · 拍线 · 球鞋</span></div>
      <dl className="pp-facts pp-equipment-facts">
        <Fact label="战拍品牌 / 型号" value={profile.racket}/>
        <Fact label="拍线品牌 / 型号" value={profile.strings}/>
        <Fact label="穿线磅数" value={profile.tension}/>
        <Fact label="手胶 / 握把" value={profile.grip}/>
        <Fact label="球鞋品牌 / 型号" value={profile.shoes}/>
      </dl>
      <div className="pp-equipment-note"><span>其他装备与备注</span><p className={profile.equipment ? '' : 'pp-unfilled'}>{profile.equipment || '尚未填写'}</p></div>
      <RacketGallery ctx={ctx} playerId={p.id}/>
    </section>

    <section className="pp-section" aria-label="比赛统计">
      <div className="pp-section-heading"><h3 className="pp-section-title">球场记录</h3><div className="pp-guide-actions"><FeatureGuide rules={rules} topic="rating" label="段位说明"/><FeatureGuide rules={rules} topic="state" label="状态说明"/></div></div>
      <div className="pp-stats">
        <section className="pp-stat"><Trophy size={18} aria-hidden="true"/><span>比赛场次</span><strong>{state.games ?? 0}<small>场</small></strong><p>{state.wins ?? 0}胜 · {state.losses ?? 0}负</p></section>
        <section className="pp-stat"><Activity size={18} aria-hidden="true"/><span>最近 {state.formGames ?? 0} 场状态</span><strong>{state.formValue == null ? '—' : `${state.formValue}%`}</strong><p>胜率形成状态值；少于5场显示样本不足</p></section>
        <section className="pp-stat"><Flame size={18} aria-hidden="true"/><span>最长连胜 / 连败</span><strong>{state.maxWins ?? 0} / {state.maxLosses ?? 0}</strong><p>来自有效完整比赛</p></section>
      </div>
    </section>

    {canEdit && <details className="pp-avatar-tools"><summary><Camera size={17} aria-hidden="true"/>更换头像</summary><PhotoGallery key={p.id} ctx={ctx} playerId={p.id} avatar/></details>}
  </section>;
}
