# Kujira 2.0.0 功能代码与截图测试报告

本轮完成代码候选，**没有验收美术，没有发布或更新市场**。全部截图是实际执行画面，图片仍为占位。

源码：[bb527797408b73fa4ee5e3c67b4a2b304ed238e4](https://github.com/Tests4gptplay/dsh-kujira-persona/commit/bb527797408b73fa4ee5e3c67b4a2b304ed238e4)；基线 `55611ec683902edad5873c21f9196a1f500d8790`。
运行：[GitHub Actions 39975902936](https://github.com/Tests4gptplay/dsh-kujira-persona/actions/runs/39975902936)。

## 结果

41 项单测通过；17 项真实 DSH Web 场景通过；Windows 实际窗口、统计文本、放大气泡边界、同一窗口换模型、单实例、关闭与快速重开均通过。页面异常 0 项，控制台异常 0 项。保存 19 张截图。

| 场景 | 结果与范围 |
|---|---|
| 默认关闭 | 真实插件详情页显示桌宠设置；没有宠物节点；pass |
| DeepSeek 余额 | 真实设置/凭据路径接入 QA 假服务 ¥57.25，不是真实账户；pass |
| DSH原生统计一致 | 与真实底栏的步骤/速度/Token/缓存一致；上下文不是完成进度；pass |
| 真实任务状态 | 模拟推理请求实际执行 DSH read 工具；完成后宠物显示 completed；pass |
| 单只宠物和套餐联动 | 通过真实模型选择器切换；同一DOM节点换白龙图，套餐显示模拟65%/33%；pass |
| 同家族版本 | gpt-4o→gpt-4.1不另建形象或宠物；pass |
| GLM与未知用量 | 切狐形象；不继承Codex套餐或DeepSeek金额；pass |
| Gemini形象 | 通过真实选择器切换为猫耳形象；pass |
| 未知模型默认星璃 | 同一只桌宠转为星璃；图片仍为未验收占位；pass |
| 星璃人设实际加载 | 真实请求中出现星璃基础档案；不是只改桌宠标题；pass |
| 对话改绑定立即联动 | 真实 persona_manage 执行后直接换成 GPT，不手动切模型；pass |
| 解除绑定恢复星璃 | 未知模型恢复默认角色，仍只有一个宠物节点；pass |
| 刷新与位置设置 | 可关闭余额定时刷新；页面与桌面位置可一起重置；pass |
| 工作统计可独立关闭 | 关闭显示不影响角色、任务和余额；pass |
| 减少动态 | 实际UI修改立即停止CSS动画；pass |
| 关闭与持久化 | 实际UI关闭；宠物节点移除，配置文件可读回；pass |
| 重载后保持关闭 | 重新载入真实DSH仍不生成宠物；pass |

## 数据与验收边界

模型回复与余额／套餐为 QA 模拟。真实的是 DSH 安装与界面、模型选择器、read/persona_manage 工具执行、文件持久化、提示词组装和 Windows WPF 程序。截图中的速度由模拟响应计算，不能用于模型性能比较；额度不是用户的真实余额。

未知模型的真实请求已含星璃档案；修改／解除绑定后桌宠无须切换模型就更新。既有用户自定义星璃记录、明确 none 选项和其他显式绑定优先。

工作统计直接取 DSH 的已有投影。上下文占用不是任务完成度、不是套餐剩余量。读数对照如下：

```json
{
  "stats": {
    "turns": 1,
    "steps": 2,
    "tokensPerSecond": 2948.4029484029484,
    "totalTokens": 25200,
    "cacheHitPercent": "93",
    "contextPercent": 9,
    "contextUsedTokens": 12015,
    "contextWindow": 128000,
    "lines": [
      "1 轮 2 步 · 2948 tok/s",
      "25.2K tok · 缓存命中 93%",
      "上下文已用 9%"
    ]
  },
  "petText": "1 轮 2 步 · 2948 tok/s\n25.2K tok · 缓存命中 93%\n上下文已用 9%",
  "dockActivity": "1 turns 2 steps·2948 tok/s",
  "dockUsage": "25.2K tok·Cache hit 93%",
  "usageSource": "simulated provider SSE usage; real DSH projections and real tools"
}
```

## Windows 与安装包

Windows 运行的是本候选 C# 源码直接编译的显示程序，放大后通过 UI Automation 检查统计文字处于窗口内。窗口按气泡高度伸缩，保持角色下缘位置；原始结果中 positionStable 对应本轮脚本的角色右下锚点检查，不表示窗口顶边不变。截屏是独立窗口捕获，不等于用户真实多屏桌面的合成效果。

没有在用户本机安装，没有使用真实账户；完整 Electron Host、多屏/DPI、长期运行仍不在本轮范围。当前美术明确未通过，留待用户之后讨论。

包清单：

```json
{
  "version": "2.0.0",
  "status": "development-candidate-not-release",
  "test_run": 39975902936,
  "unit_tests": 41,
  "web_cases": 17,
  "package_files": 104,
  "package_size": 867417,
  "sha256": "ea576c38ffadbd7cbb218cd973fdb47f73902546ba48bd204fdb38addc57bb6e",
  "native_sha256": "098a61eb49fa4a1428bb281027773e9f280e28fd43b45ff06f53a44a778960aa",
  "qa_files": 0,
  "runtime_dependencies": 0,
  "install_scripts": 0,
  "artwork": "unapproved-placeholders"
}
```

## 本轮修正与历史记录

本轮补上未知模型默认星璃、绑定变化即时通知、位置保存与重置、可选刷新频率、重复查询失败时保留最后结果，以及气泡高度适配。没有把 QA、模拟服务或验证脚本加入运行包。

本轮首次 UI 测试在重复的当前模型标签／菜单文字处触发严格定位错误；已有九个场景通过，星璃已显示。修正 QA 菜单定位后重跑，原记录保存在 [first-final-ui-failure.json](first-final-ui-failure.json)。归档首轮因 Node 输出使用 spec 而非 TAP 格式停止，修正报告解析后复用同一批通过证据，没有改动产品或重写测试结果。

之前工作统计复测第一次在 Windows QA 中文编码处失败；后续已修复测试脚本，成功运行 39972559844。更早的 Preview Notice 阻塞和固定等待导致的窗口检查失败，保留在旧 QA 分支。本报告只陈述本轮结果，不抹去旧失败。

## 截图

### 01-settings-off

![01-settings-off](reports/v2-code-39975902936/web/01-settings-off.png)

### 02-settings-on

![02-settings-on](reports/v2-code-39975902936/web/02-settings-on.png)

### 03-deepseek-balance

![03-deepseek-balance](reports/v2-code-39975902936/web/03-deepseek-balance.png)

### 04-task-running

![04-task-running](reports/v2-code-39975902936/web/04-task-running.png)

### 05-task-complete

![05-task-complete](reports/v2-code-39975902936/web/05-task-complete.png)

### 06-gpt-codex-quota

![06-gpt-codex-quota](reports/v2-code-39975902936/web/06-gpt-codex-quota.png)

### 07-gpt-same-family

![07-gpt-same-family](reports/v2-code-39975902936/web/07-gpt-same-family.png)

### 08-glm

![08-glm](reports/v2-code-39975902936/web/08-glm.png)

### 09-gemini

![09-gemini](reports/v2-code-39975902936/web/09-gemini.png)

### 10-disabled

![10-disabled](reports/v2-code-39975902936/web/10-disabled.png)

### 工作统计与真实 DSH 底栏对照

![工作统计与真实 DSH 底栏对照](reports/v2-code-39975902936/web/11-real-dsh-stats.png)

### 未知模型使用星璃（占位图）

![未知模型使用星璃（占位图）](reports/v2-code-39975902936/web/12-unknown-stella.png)

### 新会话的星璃档案实际进入请求

![新会话的星璃档案实际进入请求](reports/v2-code-39975902936/web/13-stella-prompt.png)

### 真实工具绑定后立即换角色

![真实工具绑定后立即换角色](reports/v2-code-39975902936/web/14-live-binding.png)

### 解除绑定后恢复星璃

![解除绑定后恢复星璃](reports/v2-code-39975902936/web/15-unbind-stella.png)

### 完整设置、刷新与位置重置

![完整设置、刷新与位置重置](reports/v2-code-39975902936/web/16-settings-final.png)

### native-deepseek

![native-deepseek](reports/v2-code-39975902936/windows/native-deepseek.png)

### native-gpt

![native-gpt](reports/v2-code-39975902936/windows/native-gpt.png)

### Windows 放大气泡与统计文字边界

![Windows 放大气泡与统计文字边界](reports/v2-code-39975902936/windows/native-stella-large.png)

