import {z} from 'zod';

// Retain the existing Unix-epoch lower bound. The upper bound is the final
// millisecond of 2100 in Madrid (+01:00 in December), the club's business zone.
export const MAX_BUSINESS_TIMESTAMP=Date.UTC(2101,0,1)-60*60*1000-1;
export const businessTimestamp=z.number()
 .int('时间须为整数毫秒')
 .min(0,'时间不能早于1970年')
 .max(MAX_BUSINESS_TIMESTAMP,'时间不能晚于2100年底')
 .refine(Number.isSafeInteger,'时间超出安全整数范围');
