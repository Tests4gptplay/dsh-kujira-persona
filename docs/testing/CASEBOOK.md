> **历史记录：11 候选。** 下文版本、包身份、矩阵计数和当时停止点仅记录原验证，不是当前13候选安装/待办。当前安装见 [13候选说明](../../test-artifacts/INSTALL.md)，最新Windows采用状态与本轮六项增量见 [LOCAL-VALIDATION](LOCAL-VALIDATION.md)。不要据此页的旧包信息安装当前候选。

# 可查验用例与结果

候选 `2.3.1-acceptance.20261029.11`，2026-10-30；自有云端 Linux、官方 DSH Web Host、独立空 profile、合成模型/日记/人物文件，执行真实插件工具与落盘，不使用真实账号账单。包247文件身份见[manifest](../../test-artifacts/manifest.json)。完整33行仍为 **13通过、18部分完成、2项列入实机要求**，下列通过不泛化整包。

| 用例 | 操作/预期 | 实际观察及证据 |
|---|---|---|
| 普通睡眠与Persona | 日记开关OFF、整理ON，提供昨天及更早两日来源，实际read/replace/newfile；预期只处理对应历史记录并保存人物理解 | 07:00:11完成，实际日期10-27/10-29，当日sleep不存在；protectedMismatches=[]，修订与新增标记可见。公开JSON第1项。 |
| 并发修改冲突 | sleep_persona读取后，在合成文件追加并发内容，再提交旧读取修改；预期拒旧版本、重读后保留并发内容 | 07:08:11返回“档案在读取后已改变；请重新读取，再按最新内容修改”，后续read/replace恢复，concurrentPreserved=true。第2项保留请求/结果顺序，product247 unchanged。 |
| 角色切换取消 | 在已read、未sleep_write的实际等待点切换角色，释放旧等待后再恢复原角色；预期旧任务取消且不晚写、恢复后正常落盘 | 08:03:18 gate-aborted=true，08:08:44 reentered→released，actualRecoveryPass=true/protectedMismatches=[]。第3项；开关关闭和前台任务取消也已实测，不能扩称每个文件写入微边界都测过。 |
| 正常退出恢复 | 在同一等待边界正常TERM自身Host，再同profile官方重启；预期已保存内容保留、仅处理待完成来源 | 退出前99文件不变；重启完成待处理记录，5项旧processed记录完全一致。第4项。恢复依赖持久记录重读，不是恢复未保存推理。 |
| 异常退出恢复 | 第一段已持久化、第二段已read未write时KILL精确测试Host，再同profile重启 | 恢复列表仅1待处理项，7项旧processed与其他97合成文件hash保持；第二段完成。第5项。不代表在所有原子文件写入指令上逐点断电测试。 |

[公开结果片段 JSON](../../test-artifacts/public-evidence.json)含实际时间、终态与部分合成请求/结果；来源报告SHA用于版本对应。没有账号、cookie、私人日记或原始Host日志。另见[33行覆盖清单](../../test-artifacts/coverage-summary.json)、[验收范围](ACCEPTANCE.md)、[实机操作与验收标准](LOCAL-VALIDATION.md)。

组件166项/81组语言键与实际Host证据分开：组件通过不替代账户、权限及其他OS实机。最后Host正常停止，文件保留；Sleep OFF设置未写入，不能把进程退出当设置恢复。
