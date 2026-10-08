# 安装图标

v4 采用可编辑的羽毛球剪影、金色挥拍轨迹与主题渐变底色。图标以方形全幅输出，由系统裁切圆角；核心羽毛球位于图标中心半径 40% 的安全圆内，避免安卓圆形/异形图标截掉主体。苹果使用独立 180px 不透明 PNG。

`scripts/brand-icon-art.mjs` 定义共享运动徽标与公共配色。运行 `node scripts/build-brand-icons.mjs` 重建主题 SVG 和 192/512/180px PNG。`themeBrand`、网页 head 与安装清单引用独立 v4 地址，同时更新旧 v3 与 Apple 根路径，供旧入口继续读取。主题切换仍使用同一应用 id `/`，不创建第二个应用。

验证：`node scripts/check-brand-icons.mjs` 检查每主题尺寸、不透明度、旧路径一致性，并把羽毛球主体实际栅格化，检查其不超出 Android 安全圆；PWA 测试检查主题安装清单与资源引用。现有桌面快捷方式的更新由手机系统控制，若仍显示旧图标，可在选好主题后重新添加到主屏幕。

依据：[Maskable icon safe zone](https://web.dev/articles/maskable-icon)、[Apple web application icons](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)。

## 安装主题同步修复

安装清单采用 `/manifest.webmanifest?theme=<known-theme>`，参数只接受已有主题；即使原生安装请求不带 Cookie，也能得到所选图标。没有合法参数时仍兼容设备主题 Cookie。应用 id、启动地址和作用域不变，避免生成重复应用。

服务端 `generateMetadata` 在首次 HTML 中输出同主题的 Apple 图标与安装清单，主题 Provider 默认值也读取设备选择，解决隔离的 App 存储中丢失主题后回到默认色的问题。客户端换主题同步图标链接，并清掉旧主题捕获的安装提示。主题改变后若浏览器不再提供快捷安装按钮，可使用浏览器菜单安装。

回归覆盖无 Cookie、旧 Cookie、参数冲突、非法参数、首屏服务端元信息与 UI 初始主题一致性、同地址不重复替换清单、换主题通知。已安装后的桌面图标仍遵守手机系统更新机制，不能强制即时切换：[Chrome 更新说明](https://developer.chrome.com/blog/improvements-to-web-app-updates)。
