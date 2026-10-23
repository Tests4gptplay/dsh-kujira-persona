# 2.0.0 功能代码收尾

功能候选已通过本轮隔离检查；不是发布或美术验收。

- 未知模型默认星璃，实际模型身份不被更名；已有用户角色和明确绑定优先。
- 对话创建／修改／解除绑定通过原有工具保存，桌宠随目录变更即时更新，不额外轮询。
- 页面／Windows 原生单只桌宠，开关、大小、气泡、减少动态、声音、位置与刷新设置。
- DSH 工作统计、DeepSeek 余额、Codex Native 套餐分区显示；没有数据时不伪造。
- Windows 显示程序由同一候选的 C# 源码编译并测试，已替换旧二进制。

本轮：41 项单测、17 项 Web 场景通过；原生窗口、缩放文本范围、单窗口、跨模型同进程、关闭与快速重开通过。
测试运行：https://github.com/Tests4gptplay/dsh-kujira-persona/actions/runs/39975902936
图文证据：https://github.com/Tests4gptplay/dsh-kujira-persona/blob/qa/v2-code-completion-20261023/qa/V2_CODE_REPORT.md

限定：假额度／模拟推理，真实 DSH、真实工具与文件、真实 Windows WPF 窗口；不是各品牌模型自主表现或真实账户账单验收，也未覆盖完整 Electron Host、多屏 DPI 或长期运行。

用户要求先完成代码，美术以后单独讨论。全部现有图片仍是未验收占位；星璃沿用占位，不宣称完成其最终立绘。测试和模拟不进入产品主线或安装包；主线、正式版本和市场不改。
