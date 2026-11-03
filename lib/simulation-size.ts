/** The sandbox activity's size, chosen on reset and kept when an expired sandbox renews (docs/ADMIN_SIMULATION.md).
 * available: how many real members could be copied when it was made, the upper bound the reset form offers. Kept
 * apart from lib/admin-simulation.ts so the client form does not bundle the command layer. */
export type SimulationSize={players:number;courts:number;format:'doubles'|'singles';available?:number};
export const simulationLimits={players:{min:2,max:64},courts:{min:1,max:8}};
export const defaultSimulationSize:SimulationSize={players:12,courts:2,format:'doubles'};
