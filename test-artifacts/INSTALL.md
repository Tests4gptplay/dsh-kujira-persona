# Kujira 13 候选安装与增量验收

当前版本：`2.3.1-acceptance.20261030.13`。12 候选方案已被替代，不再安装或发布；11 候选只保留为资产及既有验证基线。

安装包：`dsh-kujira-persona-2.3.1-acceptance.20261030.13.tgz`。核对本次交付或同一候选 Release 附件中的 `SHA256SUMS.txt`；不要采用11/12或旧正式版的哈希、大小与文件名。

## 获取状态

当前打包/审核阶段尚未发布候选附件。可以使用审核交付的本地同名 TGZ。计划发布地址如下，只有候选 Release 实际上传同名附件后才可下载，当前不声称此地址已经可用：

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

云端已通过相关44项、实际入口3项、最终TGZ生命周期15项。扩大日记/睡眠矩阵的旧文案断言失败单独记录，不宣称全矩阵通过。Windows 尚需 [13 候选的六项增量检查](../docs/testing/LOCAL-VALIDATION.md)；最新11候选已通过项直接采用，不重跑旧全表。

[11 候选历史验收记录](../docs/testing/ACCEPTANCE.md)和[历史用例证据](../docs/testing/CASEBOOK.md)不是本候选的安装入口，也不证明13已完成实机验收。当前行为变化见 [改动说明](../docs/testing/CHANGES.md)。
