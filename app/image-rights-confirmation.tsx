'use client';

export default function ImageRightsConfirmation({checked,onChange,disabled=false}:{checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){
 return <div className="image-rights">
  <label><input type="checkbox" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/><span>我有权上传这张照片，并已获得可识别人物同意在群内分享。</span></label>
  <p>照片仅供已登录群成员查看。不要上传未经同意的人像、未成年人的照片或含敏感信息的图片。<a href="/privacy" target="_blank" rel="noreferrer">隐私说明</a> · <a href="/terms" target="_blank" rel="noreferrer">使用规则</a></p>
 </div>;
}
