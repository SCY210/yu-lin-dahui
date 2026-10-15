import type {Account} from './types';

/** Independent capability: a tester remains a member for every real-club action. */
export function canUseSimulation(account:Pick<Account,'role'|'simulationTester'>|null|undefined){
 return !!account&&(account.role==='admin'||account.simulationTester===true);
}
