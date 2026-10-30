# Kujira 11 候选安装与验收

**版本：2.3.1-acceptance.20261029.11**。这是候选交付，不是正式Release；本轮限定范围收束，原矩阵 **13通过、18部分完成、2未运行**。

安装包：`dsh-kujira-persona-2.3.1-acceptance.20261029.11-copyclarity.tgz`

大小：198,790,063字节。SHA-256：
```text
3a19e29db0409b31c88bea2f0eae91e0072976d2e996548cd92d8853a741f3e6
```

## 下载

[完整候选安装包](https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.3.1-acceptance.20261029.11/dsh-kujira-persona-2.3.1-acceptance.20261029.11-copyclarity.tgz)。下载后核对上述SHA，再安装。

## 安装

更新前，右键桌宠选择“全部关闭”，关闭桌宠及提示气泡；然后正常卸载旧包并安装新版。保留world、persona/personas、人物目录的 `.kujira-catalog.json`、宠物/日记/睡眠设置文件及已配置日记库；自定义路径以实际设置为准，不清空设定与记忆。

- Desktop：插件 → 添加插件，填写下载后 `.tgz` 的完整本地路径。
- Web：在自己的对应profile执行：
```bash
dsh plugin --profile web add '/完整路径/dsh-kujira-persona-2.3.1-acceptance.20261029.11-copyclarity.tgz'
```

Web与Desktop分别安装，启用后正常重启DSH。

## 本轮修复与证据

两项功能修正：深色原生选择列表使用Host主题颜色；桌宠关闭时，设置中的模型联动仍跟随当前选择，后台仍不启用查询、轮询或渲染。奶油色气泡、后台和美术资源保持原样。

冻结源码166项组件测试通过，81组中英文键核对通过。真实Host已验证普通睡眠整理、并发冲突后重读保留修改、busy阻止及恢复、角色/开关/前台任务取消，以及正常退出和异常退出后的进度恢复。真实三主题选择列表、透明区域提交等已有操作记录，不再要求补截图。

退出恢复保留已完成记录，仅补未完成段。本轮最后Host已正常停止，数据和profile保留；Sleep OFF设置未写入，不将进程停止表述为设置已复原。

## 实机验证要求

请在实机补完整英→中界面切换、世界/人物目录入口；若干开关/显示位置/行为组合、全模型家族映射、重试中断、账户价格与权限细分、检索优先级、重新安装及其他操作系统原生绑定仅部分覆盖。具体操作与验收标准见源码 `docs/testing/LOCAL-VALIDATION.md`，逐项记录见 `test-artifacts/coverage-summary.json`。

已通过的云端结果直接采用，不要求本机全量重跑；后续只补实际需要的未覆盖项，功能变更只回归受影响范围。本轮不再追加测试。

## 最终包关系

最终包与实际测试的冻结11仅README、package.description及中英文meta.description不同；247文件中其余243文件、全部运行JS和美术资产逐字节相同，版本未变。纯介绍文案已做内容及包收录核验，不重跑功能。源码与验收文档已推送测试分支，完整包已上传候选预发布附件；main及正式latest不变。
