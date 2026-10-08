import {RequestError} from './request-body';
import {imageRightsVersion} from './legal-notice';

/** An uploader's statement, not consent collected from depicted people. */
export function assertImageRights(form:FormData){
 if(form.getAll('rightsConfirmed').length!==1||form.get('rightsConfirmed')!=='true'){
  throw new RequestError('请确认你有权上传照片，并已获得可识别人物同意在群内分享',400);
 }
 return {rightsConfirmed:true,rightsVersion:imageRightsVersion};
}
