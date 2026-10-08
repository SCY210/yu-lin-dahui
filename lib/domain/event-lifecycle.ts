import type {Event} from './types';

/** The clock is authoritative for an opened activity. Keep the stored status
 * intact so extending its court bookings does not require a manual reopen. */
export function eventStatusAt(e:Event,now=Date.now()):Event['status']{
 return e.deletedAt===undefined&&['open','locked','live'].includes(e.status)&&now>=e.end?'ended':e.status;
}
