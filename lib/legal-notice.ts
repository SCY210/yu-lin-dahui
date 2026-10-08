import {z} from 'zod';

export const imageRightsVersion='2026-10-05';
export const legalNoticeVersion='2026-10-05';
export type LegalConfig={
 operatorName:string;contactEmail:string;operatorAddress:string;jurisdiction:string;
 legalBases:string;retention:string;processorsAndTransfers:string;minorsPolicy:string;complaintAuthority:string;
};

export function legalNoticeState(config:LegalConfig){
 const missing=Object.entries(config).filter(([,value])=>!value.trim()).map(([key])=>key);
 const email=z.string().email().safeParse(config.contactEmail.trim());
 if(!email.success&&!missing.includes('contactEmail'))missing.push('contactEmail');
 return {configured:missing.length===0,missing,contactEmail:email.success?email.data:null};
}
