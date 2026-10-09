'use client';
import Deferred from './deferred';
import Disclosure from './disclosure';
import RealmProgress from './realm-progress';
import RealmBadge, {PlacementBadge} from './realm-badge';
import {Avatar} from './avatar';
import {lazy} from 'react';
import {Activity, Camera, Flame, Pencil, Trophy, UserRound} from 'lucide-react';
import {choice, number, text} from './ui';
const PhotoGallery=lazy(()=>import('./photo-gallery'));
const AvatarEditor=lazy(()=>import('./avatar-editor'));
import FeatureGuide from './feature-guide';
const RacketGallery=lazy(()=>import('./racket-gallery'));
import './player-profile.css';
const AchievementCollection=lazy(()=>import('./achievement-collection'));
import {tensionRange,tensionLabel} from '../lib/domain/tension';
import CultivationOrnament from './cultivation-ornament';
import {genderOptions,genderLabels,type ProfileGender} from '../lib/player-profile-options';

const defaults = {gender:'undisclosed',years:0, hand:'right', preference:'doubles', style:'', motto:'', equipment:'', racket:'', strings:''};
const hands:Record<string,string> = {right:'右手', left:'左手', both:'双手'};
const preferences:Record<string,string> = {doubles:'双打', singles:'单打', mixed:'混双', all:'都可以'};
const optional = (key:string, label:string) => ({...text(key, label), optional:true});

function ProfileAvatar({p}:any) {return <Avatar p={p} size="pp-avatar"/>;}

function Fact({label, value}: {label:string; value:unknown}) {
  const filled = value !== null && value !== undefined && String(value).trim() !== '';
  return <div className="pp-fact"><dt>{label}</dt><dd className={filled ? '' : 'pp-unfilled'}>{filled ? String(value) : '尚未填写'}</dd></div>;
}

export default function PlayerProfile({p, stats, ctx}:any) {
  if (!p) return null;
  const profile = {...defaults, ...p.profile};
  const isOwn = p.id === ctx.data.me.playerId;
  const canEdit = isOwn || (ctx.admin && (!p.protectedOwner || ctx.data.me.isOwner));
  const genderOnly=p.profileEditMode==='gender-only';
  const rules = ctx.data.settings.rules;
  const state = stats ?? {};
  const range=tensionRange(p.profile);
  const unparsedLegacy=!range&&p.profile?.tension&&!('tensionMin' in p.profile||'tensionMax' in p.profile);
  const edit = () => genderOnly?ctx.open('修改性别','profileGender',{playerId:p.id,gender:p.profile?.gender??'undisclosed'},[choice('gender','性别（可不透露）',genderOptions.map(([value,label])=>[value,label]))]):ctx.open('球友档案', 'profileDetails', {playerId:p.id, ...defaults, ...p.profile,tensionMin:range?.min??'',tensionMax:range?.max??''}, [
    choice('gender', '性别（可不透露）', genderOptions.map(([value,label])=>[value,label])),
    {...number('years', '球龄（年）'),min:0,max:80,step:'any'},
    choice('hand', '惯用手', [['right','右手'], ['left','左手'], ['both','双手']]),
    choice('preference', '参赛偏好', [['doubles','双打'], ['singles','单打'], ['mixed','混双'], ['all','都可以']]),
    optional('motto', (isOwn ? '我的口号' : '这位球友的口号')+'（最多80字）'),
    optional('style', (isOwn ? '我的打法' : '这位球友的打法')+'（最多300字）'),
    optional('racket', '战拍品牌 / 型号（最多120字）'),
    optional('strings', '拍线品牌 / 型号（最多120字）'),
    {...number('tensionMin','穿线磅数范围 · 最低（磅）'),optional:true,step:'any',min:1,max:80},
    {...number('tensionMax','穿线磅数范围 · 最高（磅）'),optional:true,step:'any',min:1,max:80},
    optional('equipment', '其他装备与备注（最多500字）'),
  ], (v:any)=>{const {grip,shoes,tension,tensionMin,tensionMax,...rest}=v;if(unparsedLegacy&&tensionMin===''&&tensionMax==='')return rest;return {...rest,tensionMin:tensionMin===''?null:Number(tensionMin),tensionMax:tensionMax===''?null:Number(tensionMax)}}, '填写最低和最高磅数，如24–28磅；两项同时留空可不填写。其他已登录群友可以查看档案。');

  return <section className="pp-card" aria-label={p.name+'的球友档案'}>
    <header className="pp-header">
      <ProfileAvatar p={p}/>
      <div className="pp-identity">
        <p className="pp-eyebrow"><span className="pp-perspective">{isOwn ? '我的档案' : p.name+'的档案'}</span></p>
        <h2>{p.name}</h2>
        <div className="pp-badges">
          {state.provisional || state.realmScore?.placement ? <PlacementBadge className="pp-tier" games={state.realmScore?.ratedGames} total={state.realmScore?.placementGames} /> : state.tier ? <RealmBadge className="pp-tier" realm={state.tier} stage={state.realmScore?.stage} /> : <span className="pp-tier">暂无境界</span>}
          <span className="pp-state">{state.form || '样本不足'}{state.formValue != null ? ` · ${state.formValue}/100` : ''}</span>
        </div>
        <RealmProgress value={state.realmScore}/>
        {profile.motto&&<p className="pp-motto-preview">{profile.motto}</p>}
      </div>
      {canEdit && <div className="pp-header-actions"><Deferred><AvatarEditor ctx={ctx} playerId={p.id} className="pp-edit"/></Deferred>
        <button type="button" className="pp-edit" onClick={edit}><Pencil size={16} aria-hidden="true"/>{genderOnly?'修改性别':'编辑档案'}</button>
        {ctx.admin && canEdit && !genderOnly && <button type="button" className="pp-rename" onClick={()=>ctx.open('修改球友姓名', 'profile', {playerId:p.id, name:p.name}, [text('name', '球友姓名')])}>修改姓名</button>}
      </div>}
    </header>
    <CultivationOrnament variant="ribbon"/>

    <Disclosure label="个人资料与打法"><section className="pp-section" aria-label="个人信息">
      <h3 className="pp-section-title"><UserRound size={18} aria-hidden="true"/>认识一下</h3>
      <dl className="pp-facts pp-personal-facts">
        <Fact label="性别" value={genderLabels[(p.profile?.gender??'undisclosed') as ProfileGender]}/>
        <Fact label="球龄" value={p.profile?.years != null ? `${p.profile.years}年` : null}/>
        <Fact label="惯用手" value={hands[p.profile?.hand]}/>
        <Fact label="参赛偏好" value={preferences[p.profile?.preference]}/>
      </dl>
      <p className="hint">球龄与性别仅作档案展示，不影响修为或自动分组。</p>
      <div className="pp-style"><span>{isOwn ? '我的口号' : '这位球友的口号'}</span><p className={profile.motto ? '' : 'pp-unfilled'}>{profile.motto || '尚未填写'}</p></div>
      <div className="pp-style"><span>{isOwn ? '我的打法' : '这位球友的打法'}</span><p className={profile.style ? '' : 'pp-unfilled'}>{profile.style || '尚未填写'}</p></div>
    </section></Disclosure>

    <Disclosure label="战拍与装备"><section className="pp-section" aria-label="装备信息">
      <div className="pp-section-heading"><h3 className="pp-section-title">{isOwn ? '我的战拍' : '这位球友的战拍'}</h3><span className="pp-section-note">球拍 · 拍线 · 磅数范围</span></div>
      <dl className="pp-facts pp-equipment-facts">
        <Fact label="战拍品牌 / 型号" value={profile.racket}/>
        <Fact label="拍线品牌 / 型号" value={profile.strings}/>
        <Fact label="穿线磅数范围" value={tensionLabel(p.profile)}/>
      </dl>
      <div className="pp-equipment-note"><span>其他装备与备注</span><p className={profile.equipment ? '' : 'pp-unfilled'}>{profile.equipment || '尚未填写'}</p></div>
      <Deferred><RacketGallery ctx={ctx} playerId={p.id}/></Deferred>
    </section></Disclosure>

    <Disclosure label="比赛统计"><section className="pp-section" aria-label="比赛统计">
      <div className="pp-section-heading"><h3 className="pp-section-title">球场记录</h3><div className="pp-guide-actions"><FeatureGuide rules={rules} topic="rating" label="境界说明"/><FeatureGuide rules={rules} topic="state" label="状态说明"/></div></div>
      <div className="pp-stats">
        <section className="pp-stat"><Trophy size={18} aria-hidden="true"/><span>累计小局</span><strong>{state.games ?? 0}<small>局</small></strong><p>{state.wins ?? 0}胜 · {state.losses ?? 0}负</p></section>
        <section className="pp-stat"><Activity size={18} aria-hidden="true"/><span>最近 {state.formGames ?? 0} 局状态</span><strong>{state.formValue == null ? '—' : `${state.formValue}%`}</strong><p>胜率形成状态值；少于5局显示样本不足</p></section>
        <section className="pp-stat"><Flame size={18} aria-hidden="true"/><span>最长连胜 / 连败</span><strong>{state.maxWins ?? 0} / {state.maxLosses ?? 0}</strong><p>来自有效完整比赛</p></section>
      </div>
    </section></Disclosure>

    <Disclosure label={'成就 · 已点亮 '+(ctx.data.achievements?.[p.id]?.unlockedCount??0)}><Deferred><AchievementCollection summary={ctx.data.achievements?.[p.id]} players={ctx.data.players} own={isOwn}/></Deferred></Disclosure>
    {canEdit && !genderOnly && <details className="pp-avatar-tools"><summary><Camera size={17} aria-hidden="true"/>更换头像</summary><Deferred><PhotoGallery key={p.id} ctx={ctx} playerId={p.id} avatar/></Deferred></details>}
  </section>;
}
