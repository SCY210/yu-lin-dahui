import type {Form} from '../../app/form-fields';

const stableWrite=(action:string)=>action.startsWith('treasure')||action==='grantPoints'||action==='bondGift';
/** An ambiguous failure must not turn a second click into another purchase, gift or manual grant. */
export function prepareTreasureForm(form:Form,makeId:()=>string=()=>crypto.randomUUID()):Form&{writeRequestId?:string}{
 return stableWrite(form.action)?{...form,writeRequestId:makeId()}:form;
}
export function formWriteRequestId(form:Form|null,action:string,makeId:()=>string=()=>crypto.randomUUID()){
 if(form?.action===action&&stableWrite(action)&&'writeRequestId' in form&&typeof form.writeRequestId==='string')return form.writeRequestId;
 return makeId();
}
