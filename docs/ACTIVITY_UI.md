# 活动流程与界面更新

网站名称改为“羽林大会”。活动是一次约球的整体安排；每场对局都属于一个活动和一个轮次。活动详情中的“分组 / 比赛”集中生成双打分组、查看轮休、确认发布、开始比赛和录入比分；底部不再提供独立比赛入口。首页和个人页的历史比赛只作摘要，点击可进入所属活动处理。

排名加入头像，取消最低场数资格门槛，统一显示所有启用球友。月份改为带日历图标的“2026年10月”按钮，可切上/下个月，也可打开月份面板选择年份和月份。

下拉菜单修复透明背景：白色独立浮层、深色16px文字、每项至少44px高度、选中高亮和勾选标记。统一修复球馆、状态等Select菜单；保持蓝紫配色。

改群名时保留已有邀请码兼容数据。管理员创建账号、账号密码登录和旧账号迁移详见 ACCOUNT_LOGIN.md；外层访问范围需明确授权后再切换。

验证：TypeScript通过；36项算法/权限回归通过，包括无入榜门槛、并列排名、改名保留邀请码。浮层、月份选择和活动内比赛流程需按本次浏览器验收结果核对。没有修改网站访问受众或支付流程。
浏览器验收已完成：球馆下拉计算背景为rgb(255,255,255)，文字16px，选项行44px；年月面板选9月后对应榜单更新；活动内“分组 / 比赛”展示本场轮次、轮休和比分，底部无独立比赛入口。36项回归通过。

## Direct event sharing

The signup summary now prioritizes sharing to WeChat groups. Inside WeChat it explains how to forward the current event using the top-right menu; outside WeChat it opens the device share sheet when available. Other apps and copying a link are fallback options. See [event sharing](EVENT_SHARING.md) for invitation fields, access requirements, and verification.
