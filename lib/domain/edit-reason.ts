import {z} from 'zod';
/** Audit actor, time and before/after facts remain mandatory; user prose does not. */
export const editReason=z.string().trim().max(500).optional().transform(value=>value||'常规修改');
