'use client';
import './admin-simulation.css';
import {canUseSimulation} from '../lib/domain/simulation-access';
export function SimulationEntry({role,simulationTester=false,onOpen}:{role:'admin'|'member';simulationTester?:boolean;onOpen:()=>void}){
 if(!canUseSimulation({role,simulationTester}))return null;
 return <section className="card simulation-entry"><div><span className="badge">群主 / 管理员 / 测试员可用</span><h2>模拟排场 · 真实球友 / 两场地</h2><p className="hint">选取最多12位正式球友的资料，测试排场、轮休、换人、比分和迟到扣分。模拟结果不影响真实记录。</p></div><button type="button" className="secondary" onClick={onOpen}>进入模拟排场</button></section>;
}
