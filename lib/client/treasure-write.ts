import type {Form} from '../../app/form-fields';

/** An ambiguous network failure must not turn a second click into a second purchase. */
export function prepareTreasureForm(form:Form,makeId:()=>string=()=>crypto.randomUUID()):Form&{writeRequestId?:string}{
 return form.action.startsWith('treasure')?{...form,writeRequestId:makeId()}:form;
}
export function formWriteRequestId(form:Form|null,action:string,makeId:()=>string=()=>crypto.randomUUID()){
 if(form?.action===action&&action.startsWith('treasure')&&'writeRequestId' in form&&typeof form.writeRequestId==='string')return form.writeRequestId;
 return makeId();
}
