import {z} from 'zod';
import {DomainError} from './domain/types';
import {RequestError} from './request-body';

/** Keep expected validation errors useful; never return raw database errors. */
export function publicApiError(e:unknown){
 if(e instanceof RequestError)return {error:e.message,status:e.status};
 if(e instanceof z.ZodError)return {error:'输入无效：'+e.issues.map(i=>i.path.join('.')+' '+i.message).join('；'),status:400};
 if(e instanceof SyntaxError)return {error:'请求格式无效，请检查填写内容',status:400};
 if(e instanceof DomainError)return {error:e.message,status:e.message.startsWith('403')?403:e.message.startsWith('409')?409:400};
 if(String(e).includes('UNIQUE constraint failed: commits'))return {error:'409: 数据已更新，请重试',status:409};
 return {error:'服务暂不可用，请稍后重试',status:503};
}
