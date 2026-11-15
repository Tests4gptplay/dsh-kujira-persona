安装 / 升级：在 DSH 插件管理器输入 `github:Tests4gptplay/dsh-kujira-persona#v2.4.3`，或使用下方发布资产中的 `dsh-kujira-persona-2.4.3.tgz`。完整步骤见 [README](https://github.com/Tests4gptplay/dsh-kujira-persona#安装与升级)。安装或更新前建议关闭桌宠与气泡，避免文件占用。

**npm 安装：** 本版发布到 npm 后，可在 **包名或地址** 中填入 `dsh-kujira-persona@2.4.3`；已安装带 scope 包名的用户使用 `@tests4gptplay/dsh-kujira-persona@2.4.3`。

GitHub 标签、Release 安装包与无 scope npm 包使用同一插件标识 `dsh-kujira-persona`，旧 GitHub 用户可继续原来源，或在 npm 发布后用同名包原地更新。已安装 `@tests4gptplay/dsh-kujira-persona` 的用户继续使用原包名。只保留一个 Kujira 安装项，不要同时安装两种包名。

**从 GitHub 预发布版升级：** 若已安装名为 `@tests4gptplay/dsh-kujira-persona`、版本为 `2.4.3-rc.*` 的测试项，先在插件管理器中移除该测试条目，再更新原有的 `dsh-kujira-persona` GitHub 条目；原条目已移除时，按上面的 GitHub 来源重新添加。保留角色、记忆、日记及数据目录，不需要手工清理用户数据。通过 npm 安装正式版的用户继续沿用 npm 来源。

## 2.4.3：账户费用与桌宠菜单修复

- 修复 OpenAI 本月费用遗漏当天记录的问题，按账户或项目汇总；查询详情显示统计月份和查询时间。
- 设置页专注账户查询，移除模型价格编辑；同账户切换模型时保留未保存内容和折叠状态。OpenAI 官方余额与账单入口位于设置页。
- 页面内右键菜单跟随点击位置和桌宠拖拽，靠近屏幕边缘时自动调整显示位置，保留原有样式与三项操作。
- 提升前台切换和账户设置的响应速度，切换后迟到的查询结果不会覆盖当前账户。
- 设置保存失败后自动清理临时文件，保留原配置；升级继续保留角色、记忆、日记与自定义目录。
- GitHub 与无 scope npm 包使用同一插件标识，兼容旧版原地更新；保留带 scope 包名的升级路径。

继续提供独立可编辑角色、共享世界观、可选 AI 日记与睡眠整理、中英文界面、模型联动桌宠、主题和用量统计。日记与整理消耗 Token；升级保留已有个性化设定。Windows、Linux 与 macOS 的运行条件见 README。

账户查询沿用实际已支持的官方与明确标记的第三方接入，余额、费用、用量及套餐额度分别标注。OpenAI 按 UTC 月份显示官方已记录费用，不将消费估算为余额。Codex 与 OpenAI API 已获用户验证；其他来源待用户验证反馈。

Account-query validation: Codex and OpenAI API have been user-verified; other sources await user validation and feedback.
