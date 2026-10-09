# 功能说明界面

`app/feature-guide.tsx` 提供统一上下文入口：

```tsx
import FeatureGuide from './feature-guide';
<FeatureGuide topic="ranking" rules={viewedSeasonRules} />
<FeatureGuide topic="accounts" label="账号说明" />
```

Props：`topic: GuideTopic`（必填）、`rules?: Rules`（该页面当前 / 所查看月份的真实规则）、`label?: string`（默认“功能说明”）。`GuideTopic`、`guideTopics`、`guideLabels`、`getFeatureGuide(topic, rules?)` 从 `lib/feature-guides.ts` 导出。未传 rules 时使用领域 `defaultRules`；排行榜与历史比赛页面必须传实际赛季规则，避免历史口径被默认值覆盖。

主题：ranking、rating、titles、activities、signup、grouping、matches、fees、partners、challenges、state、modes、photos、annual、accounts。每个入口打开自身主题，同时可以通过原生主题选择框和相关说明按钮访问全部说明。每次重新打开回到入口主题。无需新依赖或全局 CSS；沿用白色、靛紫色和现有 CSS 变量。

Radix Dialog 提供模态焦点管理、Escape 关闭、关闭后恢复触发按钮焦点；使用 DialogTitle / DialogDescription 建立无障碍名称与说明。关闭按钮中文命名，所有按钮 type=button。对话框最大高度跟随动态视口，正文单独滚动，正文 16px，表格有 caption 和行列标题，滚动区可键盘聚焦，触控目标至少 44px。需由集成者在 390px 视口验证最终页面的入口排列与弹窗布局。

## 内容依据

所有规则从当前仓库领域与 API 实现推导，界面本身不改变计分或业务行为：

- `lib/domain/ranking.ts`：按小局统计，积分 = 1000（`periodPointsBase`）+ 各计分小局段位分变化之和（另加群主调整），每个周期从 1000 起算、不显示负积分，旧的 win/loss/cap 不再使用；无最低场数限制；积分→小局胜率→局均净胜，仍同则并列；Elo 按结束时间重放、双方均值、K 与 400 分尺度。
- `lib/domain/types.ts`：目标21/领先2/封顶30、隐藏实力K32（win/loss/cap 仅为兼容旧数据保留）；Madrid 月份；rules.minimum 是兼容字段，说明不将其作为门槛。
- `lib/domain/realm-rating.ts`：可见境界由段位分（Elo，从1000起）决定，炼气<900、筑基900、金丹1000、元婴1100、化神1200，降级缓冲15分，已结算计分小局少于10局时只显示“定级中 · N/10 局”、不显示境界；`lib/domain/social.ts` 最近最多10小局胜率、搭档和对位按小局统计。隐藏Elo独立用于匹配，规则与迁移见 REALM_PROGRESSION.md。
- `lib/domain/commands.ts`：正式容量、候补顺序与递补、截止后取消申请、签到状态、轮次草稿→发布→开赛、合法每局终局比分、三局两胜、赛季规则留存、结算版本。
- `lib/domain/grouping.ts`、`play.ts`：机会差额与连续等待优先；队伍平均 Elo、重复搭档与对手权重；锁定草稿保留；擂主二人固定与新挑战者条件；个人轮转更优先换搭档；队内实力决定师徒/大腿标签；双方均值差≥120 时建议让分，round(gap/60)、上限8。
- `lib/domain/social-commands.ts`：标签一账号 / 球友 / 标签一票，可撤回；赛后每类别一票可改投，不能投自己；真实出勤候选者；历史落败才能挑战，管理员安排未开始比赛，双方分居两队；应用让分关闭月榜与 Elo。
- `lib/domain/money.ts`：均摊 / 按时长 / 时段切分；真实出勤，不以报名预计时段代替；整数分最大余数分配；个人、补贴、待分配总额对账。当前界面范围只解释每人分摊，无收付款跟踪承诺。
- `app/api/photos/route.ts`、`app/photo-gallery.tsx`：最多5MB JPEG/PNG/WebP；选择真实比赛关联四人，手选关联须实际参加；无自动识人。
- `lib/domain/social.ts`、`app/social-hub.tsx`：年度已完成比赛按Madrid开赛年份；活动数来自有完整比赛的活动，累计分钟是比赛时长；年度最克制取至少3场中最高胜率者，与全期“你最克谁”>50%门槛不同。
- `app/api/auth/route.ts`、`app/api/club/route.ts`：管理员创建账号与重置密码、现有档案保留、账号名密码且无需邮箱、群组数据需认证；精确 Elo 向普通成员隐藏。

计算示例均为明确的例子而非伪造的当前数据。默认比分示例显式说明实际校验服从所查看赛季规则。月榜公式示例会在 cap<5 时说明五场例子的上限差异。

## 接入与验收

已接入首页说明条、月榜“积分怎么算”、个人页积分/段位/称号/账号说明、活动详情的接龙/分组/比分/玩法、费用计算、球友/关系图/复仇/趣味榜/年度总结、相册和管理员账号管理。入口打开对应主题，也可直接切换全部主题。

排行榜以及首页/个人页使用所查看月份规则；活动详情使用活动开赛月份的规则；其余入口传群组当前默认规则。积分说明先展示公式和排序，段位展示段位分门槛表和每局加减分表，并说明隐藏Elo仍独立用于匹配。

390×844手机浏览器逐一切换全部15个主题，标题均正确显示，弹窗和表格无页面横向溢出。Escape关闭后焦点回到原说明按钮。按钮修复为紫底白字，正文16px，关闭/切换/相关入口可触控。积分、段位和球拍装饰已保存验收截图。TypeScript与生产构建由根代理验证。没有改动计分或业务权限。
