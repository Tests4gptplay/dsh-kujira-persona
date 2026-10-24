# Kujira 2.0.0-alpha.2 人物预设与目录验收

日期：2026-10-25。执行范围：2.0.0 开发分支；正式 main／Release／市场版本未修改。

## 人物档案

- 已清理原先由助手自行加入的非星璃角色固定性格、口癖、自称昵称和关系。GPT、DeepSeek、Gemini、Claude 等保留有来源的外形和社区资料；个人性格空白由用户通过对话养成。
- 共享世界观保留 DeepSeek 的“大肥鱼／蓝色大肥鱼”、Gemini 的“猫猫／哈基米”，以及有出处的作品互动。DeepSeek 默认使用 DeepSeek，Gemini 默认使用 Gemini；“星猫”为用户指定的界面显示名。
- 星璃的原创人物与视觉资产未改；用户自己修改的人设、记忆、模型绑定不作为批量清理目标。
- 资料依据：[ai-gijinka 社区记录](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/main/COMMUNITY_IMPRESSIONS.md)、[来源台账](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/main/research/2026-10-24/SOURCE_LEDGER.md)。

## 数据与打包

- 15 个内置角色在插件启动时准备预设，设置页面直接看到已有档案及大小。
- DeepSeek 新目录为 `<personasDir>/deepseek`；旧 `<personaDir>` 内容首次复制迁入，保留原文件、已有新目录文件、备份、删除标记。
- 迁移完成后保存状态标记，不会在后续启动时恢复新目录里已删除的文件。
- `package.json` 正式列入运行模块 `persona-migration.js`，排除 `scripts/qa`。
- 版本号 `2.0.0-alpha.2`，安装来源指向固定版本分支。

## 验证记录

- `node --test scripts/qa/persona-defaults-check.mjs`：3 个聚焦案例通过（15 角色初始化、共享世界观注入、自称、一次性迁移与删除保护、默认性格清理、打包白名单）。
- JS 语法检查：19 个源码 JS 文件通过。
- 使用 npm 生成并解开候选运行包：122 个运行文件、40 张 PNG 图集、迁移模块齐全，没有打入 QA 文件。
- 本轮运行验证采用隔离 Node.js 测试宿主和文件操作；此前真实 DSH Web 链路的验证记录保留在 `REMOTE_DSH_QA_20261024.json`。这次没有改动任何用户已安装的 DSH profile。

## 本轮包内核对

候选文件名：`dsh-kujira-persona-2.0.0-alpha.2.tgz`（本地 QA）。
大小：83,734,394 字节。
SHA256：`f6d9602a96a52b6005a787d555e8901d3ff6e845ef9fb01cbbeddd5f2c586a07`。

正式安装源：`github:Tests4gptplay/dsh-kujira-persona#v2.0.0-alpha.2`。
