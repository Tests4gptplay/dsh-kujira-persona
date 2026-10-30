# Kujira 2.4.0（2026-10-30）

- 基础默认更新采用独立更新包，以现有档案为主体增量合并，自定义设定优先；首次安装同样通过包创建缺失文件，不启动硬覆盖。
- 未完成迁移保留进度，保存并读回确认后只清理本次包和通知；同次更新完成后重启不复活。
- 扩展中英文设置、状态与错误提示，保留共享世界观、个人档案/记忆和独立日记的分层；桌宠、日记及睡眠整理分别可选，关闭桌宠不影响人设。
- 包含 Linux/macOS Electron 伴随窗口适配、账户用量适配、睡眠整理当前角色档案 与界面/恢复改进。Windows x64 原生后端保持；Linux/macOS 需可用 Electron，安装包不包含 Electron 运行时。
- 保留已有设定、记忆、日记与媒体资源；升级不要求重建角色。

## 验证范围

基础更新包 Windows 增量 7/7 通过；相关云端生命周期和真实插件入口测试通过。既有宽范围测试中的基线文案断言差异及其他历史覆盖边界继续如实保留。Linux Web 已验不等于 Linux Desktop 或 macOS 原生窗口实机通过，后两者仍需目标系统验证；不把 7 项结果扩展为全部功能或所有平台通过。

详见 [Windows 摘要](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/docs/testing/CANDIDATE13-WINDOWS.md) 与 [验证边界](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/docs/testing/RELEASE-READINESS.md)。

## 安装与升级

安装前右键选择“全部关闭”，关闭桌宠与气泡，避免文件占用。保留现有档案、记忆、日记和自定义目录；按更新通知把新版基础小增量合入旧档案，不整包覆盖用户积累。睡眠整理仍会后台调用模型并消耗 token。

固定附件：`dsh-kujira-persona-2.4.0.tgz`，以同一 Release 的 `SHA256SUMS.txt` 核验。源码对应 `v2.4.0` tag。
