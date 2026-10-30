'use client';
import './admin-simulation.css';
import {canUseSimulation} from '../lib/domain/simulation-access';
export function SimulationEntry({role,simulationTester=false,onOpen}:{role:'admin'|'member';simulationTester?:boolean;onOpen:()=>void}){
 if(!canUseSimulation({role,simulationTester}))return null;
 // A small button at the bottom of the activities page; the simulation page then asks: activity or competition.
 return <div className="simulation-entry"><button type="button" className="ghost" onClick={onOpen} title="群主 / 管理员 / 测试员可用，不影响真实记录">模拟排场</button></div>;
}
