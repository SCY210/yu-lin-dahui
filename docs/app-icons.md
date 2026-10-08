# 安装图标

v4 采用可编辑的羽毛球剪影、金色挥拍轨迹与主题渐变底色。图标以方形全幅输出，由系统裁切圆角；核心羽毛球位于图标中心半径 40% 的安全圆内，避免安卓圆形/异形图标截掉主体。苹果使用独立 180px 不透明 PNG。

`scripts/brand-icon-art.mjs` 定义共享运动徽标与公共配色。运行 `node scripts/build-brand-icons.mjs` 重建主题 SVG 和 192/512/180px PNG。`themeBrand`、网页 head 与安装清单引用独立 v4 地址，同时更新旧 v3 与 Apple 根路径，供旧入口继续读取。主题切换仍使用同一应用 id `/`，不创建第二个应用。

验证：`node scripts/check-brand-icons.mjs` 检查每主题尺寸、不透明度、旧路径一致性，并把羽毛球主体实际栅格化，检查其不超出 Android 安全圆；PWA 测试检查主题安装清单与资源引用。现有桌面快捷方式的更新由手机系统控制，若仍显示旧图标，可在选好主题后重新添加到主屏幕。

依据：[Maskable icon safe zone](https://web.dev/articles/maskable-icon)、[Apple web application icons](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)。
