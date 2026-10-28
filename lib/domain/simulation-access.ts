import type {Account} from './types';

/** Independent capability: testers retain their member role, with simulation and their own ranked activities. */
export function canUseSimulation(account:Pick<Account,'role'|'simulationTester'>|null|undefined){
 return !!account&&(account.role==='admin'||account.simulationTester===true);
}
