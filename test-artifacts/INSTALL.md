# Kujira 13 候选安装与增量验收

当前版本：`2.3.1-acceptance.20261030.13`。12 候选方案已被替代，不再安装或发布；11 候选只保留为资产及既有验证基线。

安装包：`dsh-kujira-persona-2.3.1-acceptance.20261030.13.tgz`。核对本次交付或同一候选 Release 附件中的 `SHA256SUMS.txt`；不要采用11/12或旧正式版的哈希、大小与文件名。

## 获取状态

候选附件已发布并通过匿名完整下载核验。以下为固定版本下载地址；仍为prerelease，不替代正式latest：

```text
https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.3.1-acceptance.20261030.13/dsh-kujira-persona-2.3.1-acceptance.20261030.13.tgz
```

## 安装

先在桌宠右键菜单选择“全部关闭”，正常卸载旧包后安装新包。不要删除已有设定、记忆、日记库、桌宠配置或自定义目录。

DSH Desktop：插件 → 添加插件，选择已核验的本地 TGZ。Web 对应 profile 示例：

```bash
dsh plugin --profile web add '/完整路径/dsh-kujira-persona-2.3.1-acceptance.20261030.13.tgz'
```

Web 和 Desktop 分别安装，启用后正常重启 DSH。首次安装和升级均先生成当前档案下的更新包与通知，不在启动时硬覆盖活动设定。空档案由 AI 读取包后创建对应基础文件；已有档案以自身为主体，小增量合并新版，只替换旧默认对应片段，自定义优先。保存并读回确认后仅清理本次更新包与通知。

## 验证范围

云端已通过相关44项、实际入口3项、最终TGZ生命周期15项。扩大日记/睡眠矩阵的旧文案断言失败单独记录，不宣称全矩阵通过。Windows 10 x64 / DSH Desktop 0.2.1-rc.5 已完成 [13候选规定7项增量](../docs/testing/CANDIDATE13-WINDOWS.md)，7/7通过；无需重复本轮，历史已通过项继续采用。其他历史范围见 [发布准备判断](../docs/testing/RELEASE-READINESS.md)，不是自动新增的任务清单。

[11 候选历史验收记录](../docs/testing/ACCEPTANCE.md)和[历史用例证据](../docs/testing/CASEBOOK.md)不是本候选的安装入口，也不替代13限定范围的最新验证摘要。当前行为变化见 [改动说明](../docs/testing/CHANGES.md)。

固定安装包源码为 `654a65816573f02e0799466a81c23ff863ad7596`。本页及其他后续文档修订不改变已发布TGZ、tag或其源码身份；不要把最新文档提交当成安装包源码提交。
