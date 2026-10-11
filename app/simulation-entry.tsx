'use client';
import './admin-simulation.css';
export function SimulationEntry({role,onOpen}:{role:string;onOpen:()=>void}){
 if(role!=='admin')return null;
 return <section className="card simulation-entry"><div><span className="badge">仅群主 / 管理员可见</span><h2>模拟活动 · 12人 / 两场地</h2><p className="hint">12 位虚拟球友已正式接龙。测试排场、轮休、换人、比分和迟到扣分，不影响真实记录。</p></div><button type="button" className="secondary" onClick={onOpen}>进入模拟活动</button></section>;
}
