import type {Event} from './types';

export const CANCELLATION_NOTICE=24*60*60*1000;
/** The shared policy always comes from the activity start, never a custom deadline. */
export function cancellationDeadline(e:Pick<Event,'start'>){return e.start-CANCELLATION_NOTICE}
export function cancellationNeedsApproval(e:Pick<Event,'start'>,now:number,manager=false){return !manager&&now>cancellationDeadline(e)}
