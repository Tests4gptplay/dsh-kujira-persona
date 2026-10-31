# Kujira 2.4.1

## 安装、下载与升级 / Install, download & upgrade

DSH Desktop：**插件 → 添加插件 → 包名或地址**，填写：

```text
github:Tests4gptplay/dsh-kujira-persona#v2.4.1
```

[下载可安装包 dsh-kujira-persona-2.4.1.tgz](https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.4.1/dsh-kujira-persona-2.4.1.tgz)。也可将该下载地址直接填入“包名或地址”，无需解压。核对版本后启用；按宿主提示重启。

安装或更新前，建议先关闭桌面上已显示的桌宠和提示气泡（桌宠右键菜单 → “全部关闭”）；未关闭时，文件占用有可能导致安装失败。用新版来源升级；若宿主要求先卸载，只卸载插件条目，不删除 DSH 数据、角色、世界、记忆或日记目录。现有自定义保留。

Web：在运行服务的环境停止对应 profile 后执行，完成后重启：

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v2.4.1'
```

Desktop: add the GitHub source above in Plugins → Add plugin. The `.tgz` URL is an alternative install source. Enable after checking the version; preserve all user data when upgrading. Before installing or updating, we recommend closing the visible desktop pet and bubbles; open files may cause installation to fail. No npm account required.

## 账户查询验证范围 / Account-query validation

**Codex 与 OpenAI API 已获用户验证；其他来源待用户验证反馈。**

**Codex and OpenAI API have been user-verified; other sources await user validation and feedback.**

## 本次更新 / Changes

- 设置最底部按已有模型与接入来源提供公司/方式选择、对应配置字段、指南与查询按钮。独立密钥通过宿主安全凭据服务保存，不覆盖推理密钥。
- OpenAI 正确显示官方本月消费和 Completions 用量，不将其称为余额。自动宿主账户与普通兼容查询保留；无匹配方案隐藏账户信息栏。
- 查询按服务商返回的周期、币种和适用模型展示。第三方选项明确标识，只向已配置同源服务查询。
- Model-scoped setup, Host-managed independent credentials, and clearly labeled account costs, usage and plan quotas.

## 延续的功能 / Retained features

保留 2.4.0 的模型联动角色、共享世界、独立档案/记忆、可选 AI 日记与睡眠整理、中英文设置和桌宠动作。更新以用户已有设定为主体增量合并，不重置角色、记忆、日记、美术或配置。日记与睡眠整理分别默认关闭，开启会消耗模型用量。

CC BY-NC-SA 4.0；保留原有署名与第三方权利边界。非模型厂商官方项目。
