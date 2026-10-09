# 费用确认状态

原界面保存成功后，活动管理者仍看到「预览」和原确认按钮，容易误以为没有保存。现在，当前费用结果与最新确认快照一致时，显示已确认、版本、确认时间及正式每人金额；确认按钮显示已确认并停用，可复制正式分摊。确认备注提供默认值，保存成功明确提示分摊已确认。

费用、参加时段或分摊明细修改后，管理者看到待重新确认及新预览；球友继续查看上一版正式结果。重新确认生成新版本，原版本保留。只改变备注或重复点击相同结果，不重复生成确认版本。比较时排除版本/时间/备注，并规范对象和记录顺序；金额、份额、参加分钟及说明明细均参与核对。

仍有待分配费用或活动尚未结束时维持原安全检查，不自动指定群补贴、不替群主确认新的费用。数据库已有的确认版本不会删改。确认新版本后自动生成站内提醒和已订阅设备的推送任务；代报名朋友的费用提醒发给代报名的人。每个版本每个成员只收到一次确认通知，确认者有本人分摊时也收到。球友付款后可点「标记已付款」；创建者或管理员可点「提醒未付款」再提醒还没标记的人，详见 [FEE_PAYMENTS.md](FEE_PAYMENTS.md)。重复点击不生成重复任务；未开启设备通知也可查看站内提醒。

验证包含六人分摊20.20欧元的精确到分对账、确认状态、重复确认、修改后新版本、成员看到旧版直到重确认、早于结束/待分配拒绝及真实 SQLite API 幂等与回滚。

## 同额与收款信息

相同参加区间、场地报名范围、费用豁免条件的球友按同额取整到分。20.20欧元的六人样例每人3.37欧元，分摊合计20.22欧元；原费用项目合计20.20欧元保留为expenseTotal，2分为roundingDifference，既不伪造原费用也不建立余款账户。逐项分配与逐时段分摊同步规范，个人及总额严格对账。不同时长继续按原权重计算，豁免及不同场地费用不会被强制合并。

费用页可由活动创建者或管理员填写收款人、电话号码；已授权成员查看、拨号或复制。号码按数字、区号及常用分隔符验证；无付款、已付/未付或收款流水。

## Latest settlement display

The fees page shows a single current per-person allocation. Managers see the current preview until they confirm it; members see the latest confirmed result. Previous versions and per-time-segment reconciliation are no longer displayed. Stored versions and calculation details remain available internally for confirmation comparisons and audit integrity.
