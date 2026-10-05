# 界面与羽毛球装饰

## 装饰图片压缩（2026-10-05）

首页、登录页和活动列表使用轻量 WebP；原始 PNG 保留作生成源和图片上传验证的测试素材。仅做确定性 Lanczos 缩放与 WebP 编码（Pillow，quality=90、method=6、exact=True），没有重新生成或改变图案。页面 CSS 显示尺寸保持原样；固有宽高与 WebP 文件一致。

| 文件 | 原始 PNG | 页面使用 WebP | 体积变化 |
| --- | --- | --- | --- |
| 球拍 | 1312 × 1199，1,175,607 bytes | `public/crossed-rackets.webp`，360 × 329，50,536 bytes | 减少 95.70% |
| 羽毛球 | 1309 × 1202，1,051,507 bytes | `public/shuttlecock.webp`，512 × 470，36,866 bytes | 减少 96.49% |

两张装饰合计从 2,227,114 bytes 降为 87,402 bytes（减少 96.08%）。球拍最大显示宽度 116 CSS px，羽毛球最大 170 CSS px，两份 WebP 均保留约 3 倍像素以适配高密度屏幕。解码后的 alpha 与缩放后的源图逐像素一致，透明角点为 0。已对照原图检查实际显示尺寸及 2 倍放大，保留羽毛边缘、球线和白色手柄细节。原 PNG 不再由装饰组件请求，API 测试仍可使用原有路径。

蓝紫色按钮、深色文字、柔和灰白背景。统一按钮圆角、边框、悬停、按下和焦点；调整卡片间距、活动日期块、底部导航、活动页标签与表单。移动端保留主要操作，装饰不接收鼠标事件。

生成方式：内置 imagegen。文件：tests/fixtures/shuttlecock.png，1309 × 1202，1,051,507 bytes。PNG 带真实 alpha，透明角点已验证。首页和登录页引用项目内文件，装饰图 alt 为空，避免屏幕阅读器重复朗读。保持白色羽片、象牙白球头、靛紫球环，不使用绿色。

浏览器检查完成：390px手机首页无横向溢出；球馆选项为不透明白底、16px文字；月份面板清晰；账号登录页、管理员创建账号表单和桌面首页已保存本地验收截图。未输入或展示真实账号密码。

最终提示词：

> Use case: stylized-concept  
> Asset type: small homepage and login decoration for a polished badminton club web app named 羽林大会.  
> Primary request: exactly one elegant floating badminton shuttlecock, isolated on a genuinely transparent background.  
> Subject: white layered feather skirt, subtly textured ivory cork, thin indigo-violet collar. A natural single shuttlecock with clean readable feather anatomy.  
> Style/medium: restrained premium 3D studio illustration, refined and tactile.  
> Composition/framing: entire shuttlecock visible with ample transparent margin, diagonal gentle motion; clean silhouette readable at approximately 160px. Feather skirt points upper left and cork points lower right.  
> Lighting/mood: soft cool studio lighting, subtle cool shading on the object itself, elegant calm energy.  
> Color palette: white and ivory, restrained indigo-purple collar accent only.  
> Constraints: actual transparent PNG alpha, no text, no background, no frame, no other objects, no green, no watermark, no ground plane or cast shadow outside the object.

## 交叉球拍

文件：tests/fixtures/crossed-rackets.png，1312 × 1199，1,175,607 bytes。第二次委派装饰任务，由绘图 subagent 使用内置 imagegen 生成；根代理检查透明背景后复制到项目，并用于活动列表和球友圈。两个完整球拍以X交叉，象牙白手柄、银白框和靛紫球线；没有绿色、文字或标志。保留生成PNG的alpha，透明角点及中央留白已验证。

最终提示词：

> Use case: stylized-concept  
> Asset type: small decorative PNG for a polished badminton club web app named 羽林大会, matching an existing white/ivory premium 3D shuttlecock with an indigo-violet collar.  
> Primary request: exactly one asset consisting of an elegant pair of crossed badminton rackets isolated on a genuinely transparent background.  
> Subject: two full badminton rackets crossed gently at their shafts, with light silver and ivory slender oval rims, detailed restrained indigo string mesh, muted dark-indigo shafts and ivory wrapped grips. Correct badminton racket proportions: slender long shafts, compact oval string heads.  
> Style/medium: restrained premium 3D studio illustration, refined tactile materials, subtle realism. Both rackets form a balanced elegant X.  
> Composition/framing: entire two rackets visible, each grip and racket head fully inside frame, ample transparent margin; clean silhouette readable at approximately140px.  
> Lighting/mood: soft cool studio lighting and subtle shading on the objects themselves, calm and elegant.  
> Color palette: light silver, ivory, muted dark indigo, restrained violet detail.  
> Constraints: actual transparent PNG alpha, exactly two badminton rackets, no shuttlecock, no text, no logos, no green, no background, no ground plane, no outside cast shadow, no court, no border, no frame, no watermark, no loud sporty neon.

原始 PNG 现保存在 tests/fixtures，保留作为图片验收素材；public 仅包含用于页面的 WebP 和 SVG，原始大图不再进入网站部署产物。
