# Kujira 2.4.3

## 安装、下载与升级 / Install, download & upgrade

DSH Desktop：**插件 → 添加插件 → 包名或地址**，填写：

```text
github:Tests4gptplay/dsh-kujira-persona#v2.4.3
```

[下载可安装包 dsh-kujira-persona-2.4.3.tgz](https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.4.3/dsh-kujira-persona-2.4.3.tgz)。也可将该下载地址直接填入“包名或地址”，无需解压。核对版本后启用；按宿主提示重启。

**npm 安装（无 scope 包）：** 也可在同一个“包名或地址”中填写：

```text
dsh-kujira-persona@2.4.3
```

GitHub、Release 安装包与无 scope npm 包使用同一插件标识，可沿原条目升级。已安装带 scope 包的用户继续使用 `@tests4gptplay/dsh-kujira-persona@2.4.3`。两种包名选择一种，与已有安装保持一致。

升级前在桌宠菜单选择“全部关闭”。用新版来源升级；若宿主要求先卸载，只卸载插件条目，不删除 DSH 数据、角色、世界、记忆或日记目录。现有自定义保留。

若从 GitHub 的 `2.4.3-rc.*` 测试包转回原 GitHub 条目，先移除带 scope 的测试条目，再更新 `dsh-kujira-persona`；保留用户数据。

Web：在运行服务的环境停止对应 profile 后执行，完成后重启：

```sh
dsh plugin --profile web add 'dsh-kujira-persona@2.4.3'
```

也可将命令中的来源替换为上面的 GitHub 来源或 `.tgz` 下载地址；已安装带 scope 包的 Web profile 继续使用原包名。

Desktop: add the GitHub source, tarball URL or unscoped npm name above in Plugins → Add plugin. Existing scoped installations should keep that package name. Enable after checking the version and preserve all user data when upgrading. No npm account required.

## 账户查询验证范围 / Account-query validation

**Codex 与 OpenAI API 已获用户验证；其他来源待用户验证反馈。**

**Codex and OpenAI API have been user-verified; other sources await user validation and feedback.**

## 本次更新 / Changes

- 修复 OpenAI 本月费用遗漏当天记录的问题，按组织或项目汇总，详情显示统计月份与查询时间。官方已记录费用按 UTC 月份统计。
- 设置页移除模型价格编辑，费用查询无需另选对话模型；同账户切换模型时保留未保存内容和折叠状态。OpenAI 官方余额与账单入口位于设置页，气泡布局保持不变。
- 修复页面内右键菜单定位，使其跟随桌宠拖拽，兼容新旧 DSH 菜单接口。Windows 原生菜单保留开始拖拽时关闭的系统交互。
- 提升前台切换和账户设置的响应速度，切换后迟到的查询结果不会覆盖当前账户。
- 设置保存失败后自动清理临时文件，保留原配置及角色、记忆、日记与自定义目录。
- 提供无 scope 与带 scope 的 npm 包，保留各自的同名升级路径。
- Recorded monthly costs, account-scoped setup, responsive pet menus and settings, with existing user data preserved.

## 延续的功能 / Retained features

保留模型联动角色、共享世界、独立档案与记忆、可选 AI 日记与睡眠整理、中英文设置、桌宠动作、主题及用量统计。更新以用户已有设定为主体增量合并，不重置角色、记忆、日记、美术或配置。日记与睡眠整理分别默认关闭，开启会消耗模型用量。

余额、费用、用量及套餐额度分别标注。OpenAI 显示官方已记录的本月费用与 Completions 用量；官方余额页面入口位于设置页。各平台运行条件见 [README](https://github.com/Tests4gptplay/dsh-kujira-persona#安装与升级)。

## 工程验证边界

账户查询、模型切换、保存恢复与菜单定位通过针对性回归；在真实 DSH 中完成两种包名从 2.4.2 到 2.4.3 的升级，检查设置和用户文件保留。Linux 页面与 Electron 桌宠经过系统鼠标操作验证；macOS 验证范围为平台代码与共享控制器契约检查。账户查询的用户验证范围见上。

CC BY-NC-SA 4.0；保留原有署名与第三方权利边界。非模型厂商官方项目。
