'use client';
import {useState} from 'react';
import {styleTags} from '../lib/domain/social';
import {awardCandidateIds,canCastAwardVote,isAwardVotingOpen} from '../lib/domain/activity-voting';

export default function EventStyleVotes({e,ctx,now}:{e:any;ctx:any;now:number}){
 const {data,name,send}=ctx,[selected,setSelected]=useState('');
 const candidates=awardCandidateIds(data,e.id,now),playerId=candidates.includes(selected)?selected:candidates[0];
 const open=isAwardVotingOpen(data,e,now),canVote=canCastAwardVote(data,e,data.me,now);
 const votes=data.tagVotes.filter((v:any)=>v.eventId===e.id&&v.playerId===playerId);
 return <section className="card"><h3>本场打法印象</h3><p className="hint">打完本次活动后，为参与的球友选择打法标签。个人档案只展示结果，投票在本活动内进行。</p>
  {candidates.length>0?<>
   <label>选择本场球友<select className="pick native-form-select" value={playerId} onChange={event=>setSelected(event.target.value)}>{candidates.map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>
   <div className="tag-votes" style={{marginTop:16}}>{styleTags.map(tag=>{const tagged=votes.filter((v:any)=>v.tag===tag),active=tagged.some((v:any)=>v.voterId===data.me.id);return <button type="button" key={tag} className={'tag-button '+(active?'active':'')} aria-pressed={active} disabled={!canVote||ctx.busy} onClick={()=>send('tagVote',{eventId:e.id,playerId,tag,active:!active})}>{tag} · {tagged.length}票</button>})}</div>
   {!open&&<p className="hint" role="status">{e.status==='cancelled'?'活动已取消，投票已关闭。':'活动打完后开放投票。'}</p>}
   <p className="hint">本活动内，每个账号对每位球友的每个标签一票，再次点击可撤回。</p>
  </>:<p className="muted">暂无参与本场活动的候选球友。</p>}
 </section>;
}
