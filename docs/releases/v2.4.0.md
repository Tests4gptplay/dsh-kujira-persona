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

当前版本：**2.4.0**。安装包与固定标签均已包含运行文件，无需编译。

**首次安装（Desktop）：** 打开侧栏 **插件 → 添加插件**（箭头菜单的 **安装第三方插件** 也可进入），把下面一整行填入 **包名或地址**，点击 **安装**，核对版本后点击 **立即启用**。

```text
github:Tests4gptplay/dsh-kujira-persona#v2.4.0
```

**升级已有插件：** 同样填写上面的新版来源，成功后核对版本并启用；已有设置与用户文件保留。若宿主提示已安装或要求先卸载，再按提示仅卸载该插件条目并安装新版，不清除 DSH 数据或手工删除插件目录。是否需要重启以 DSH 提示为准；需要时完全退出并重新打开（Desktop 包括托盘）。

升级前在桌宠右键菜单选择“全部关闭”，关闭桌宠和提示气泡。保留世界观、人物档案、记忆、日记与自定义目录；新版基础内容按通知增量合入。

**备用安装包：** 将下面的 `.tgz` 直链填入同一个 **包名或地址**；也可下载后填写文件的完整绝对路径，无需解压。该路径应属于运行 DSH 的电脑。

```text
https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.4.0/dsh-kujira-persona-2.4.0.tgz
```

**Web：** 在运行服务的环境中执行。升级前停止对应 Web profile，成功后重新启动；Web 与 Desktop 分别安装。

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v2.4.0'
```

备用时将命令中的来源换成上面的 `.tgz` 直链或下载文件的完整绝对路径。

睡眠整理仍会后台调用模型并消耗 token。以本次 Release 的 `SHA256SUMS.txt` 核验下载的安装包。
