# dsh-kujira-persona

**AI 娘人设 · 随模型家族切换 · 在对话中持续补充。**

v1.5.0 内置资料库已有的 **11 个模型家族**的基础文字人设，也允许用户通过聊天创建自己的角色、添加模型别名和绑定关系。包名仍为 `dsh-kujira-persona`，插件 ID 仍为 `whale-persona`。无需 npm 账号。

## 安装后如何使用：直接和 AI 对话

启用插件并重启 DSH 后，选择模型发送一条消息。需要修改或补充人设，**直接在聊天中让 AI 保存**，不需要自己寻找或修改 Markdown 文件。例如：

> 请把说话风格改得更简洁，但保持目前的人设，保存到你的角色档案里。

> 刚才那个背景设定是我的私设，请补充到当前角色，并注明是用户设定。

> 把之前那条已经不适用的设定删掉，其他记忆不要动。

AI 应实际调用 `persona_edit` 完成读取、追加、替换或删除，并反馈写入的角色和位置。**只说“记住了”不等于已经保存。** 内容下次请求生效；不会训练模型权重，也不会清空既有聊天历史。

同样的说明与例句已经放进包内 **`locale/zh.json` / `locale/en.json` 的 `meta.description`**，供安装后 DSH 的插件详情和设置说明使用，不是只写在 GitHub README。

## 内置角色：同家族各版本是同一个角色

| 模型家族 | 稳定角色 ID | 基础角色 |
| --- | --- | --- |
| DeepSeek：V / R、chat / reasoner、flash / pro 等 | `deepseek` | 鲸鱼娘 |
| GPT / ChatGPT、o 系列、GPT-Codex / Codex 变体 | `gpt` | 白龙娘 |
| Gemini：不同版本、Pro / Flash 等 | `gemini` | 彩发猫娘 |
| Claude：不同版本、Opus / Sonnet / Haiku | `claude` | 橙发书卷娘 |
| Grok：各版本与 fast / reasoning 等 | `grok` | 金发蝠翼娘 |
| GLM / ChatGLM：各版本与 Air / Flash 等 | `glm` | 黑白狐娘 |
| Kimi / Moonshot：各版本、coding / thinking 等 | `kimi` | 星月娘 |
| Qwen / 千问、QwQ / QVQ：各版本与 Coder / VL 等 | `qwen` | 中式折扇千问娘 |
| MiniMax：各版本与 M 系列 | `minimax` | 橙发创作娘 |
| Llama：各版本、大小与 Instruct 变体 | `llama` | 羊驼娘 |
| Doubao / Seed：各版本 | `doubao` | 科技风豆包娘 |

模型家族统一落到上面固定的角色 ID，**不按版本号、参数量、推理档位、接入供应商分别建立角色和记忆目录**。用户明确绑定自定义角色时才改变默认归属。

11 份家族预设全部随安装包提供，不联网下载。对应角色首次使用时自动铺到用户目录；其他角色的全文不会跟着一起注入本次聊天。既有鲸鱼娘与 GPT 档案原位保留。

视觉身份依据 [AI-gijinka 图鉴](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/9ca080de39b79e94e940880b48e2eb057706d501/CHARACTER_ATLAS.md)。资料库没有完整的统一性格手册，因此新增角色的性格与表达均明确标注为**本插件原创的基础默认值**，供用户通过对话继续补充；不冒充原作者钦定性格。没有打包任何第三方原图或视频。

## DSH 中是 GPT，还是 Codex？

这三层不是一回事：

| 层级 | 示例 | 用途 |
| --- | --- | --- |
| 供应商显示名 | `Codex (local login)` | 模型菜单的分组标题，可以自定义 |
| 实际 provider ID | `codex-local` 或 DSH 内置 `openai-codex` | 识别请求的接入通道 |
| 实际 model ID | `gpt-6-astra`、`gpt-5.6-sol`、`gpt-5.3-codex-spark` 等 | 识别本次模型家族 |

上表中的模型名称是代码/目录中的示例，不承诺每个账号都能使用。你的 `dsh-codex-native` 用 `codex-local` 注册；DSH 自带目录另有 `openai-codex`，两个入口的 GPT/Codex 模型都默认使用同一份 `gpt` 白龙娘档案。正常 OpenAI API、Azure 部署或中转站中能够识别的 GPT 模型也共用它。

**供应商不是模型家族。** OpenRouter、GitHub Copilot、Amazon Bedrock、Groq、各种自定义中转站可能承载多个家族；不能整组判为 GPT。`OpenAI-compatible` 只是 API 协议，不能当作 GPT 身份；`Groq` 与 `Grok` 也不相同。Gemma 不因来自 Google 就误归 Gemini，未收录的其他家族不硬套预设。

插件按本次请求实际的 `provider + model` 匹配，不读按钮文字，也不去查询模型“你是谁”。支持常见命名空间、Bedrock 区域/厂商前缀与 GPT fine-tune 前缀；无法辨认的私有别名默认不套角色，由用户通过对话绑定。

模型目录随 DSH 版本、插件、账号和用户配置变化，不维护一张声称永远完整的静态版本清单。用户可以说：

> 列出我现在 DSH 可用的模型，分别显示供应商 ID、模型 ID 和对应角色。

AI 调用 `persona_manage` 的 `models`，**按需使用与 DSH 客户端相同的 `ctx.llm.listProviders()` / `listModels(provider)` 目录接口**。它不会后台轮询、测试密钥或发起聊天推理；目录获取本身可能由供应商访问其模型列表服务。

## 通过对话添加自己的模型与角色

> 创建一个名叫“星璃”的角色，ID 用 stella，基本设定是……，把当前模型绑定给她。

> 不要新建另一个角色，把 my-gateway 供应商中的 my-model-* 全部版本绑定到星璃，继续共用她已有的记忆。

> 把我的私有模型别名绑定到已有的 GPT 白龙娘，不要复制一份白龙娘。

> 解除刚才那条自定义绑定，角色档案和记忆保留。

AI 使用 `persona_manage` 完成创建、绑定和解绑。角色内容仍通过 `persona_edit` 补充、修改；可以在对话中明确指定另一个角色作为修改目标。用户未指定时只修改发起本次请求的角色。

**这里“添加模型”是添加该模型与角色的对应关系，不是创建新的推理服务或自动配置账户。** 模型尚未接入 DSH 时，先在“设置 → 模型”配置 API/接入插件；本插件不接收密码、Token 或 API Key，也不修改模型服务配置。

内置家族始终共用一个角色；自定义家族的多个版本也应绑定到同一个自定义角色 ID。使用 `model: my-model-*` 可覆盖用户明确指定的一组别名；不要让 AI 在没有用户要求时自动把精确绑定扩成全局通配符。

## 安装与升级

### 官方桌面应用

打开 **插件 → 添加插件**，输入：

```text
github:Tests4gptplay/dsh-kujira-persona#v1.5.0
```

安装、启用，重启 DSH 一次。选择模型发送一条消息，再执行 `/persona` 检查角色。升级时先在插件列表卸载旧包，再装此版本；**保留所有用户人设与记忆目录**，不要同时启用多个副本。版本升级不要求新增 npm 账号。

### Web CLI

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v1.5.0'
```

Web 的 `web` 与桌面应用的 `desktop` 是不同 profile。备用 `.tgz` 见 [GitHub Releases](https://github.com/Tests4gptplay/dsh-kujira-persona/releases)。安装包不需要编译，没有 prepare / postinstall / build 安装钩子。

### Windows `ERR_PNPM_EPERM` 残留

若错误是 `dsh-kujira-persona_tmp_* -> dsh-kujira-persona` 重命名失败：取消安装并**完全退出 DSH（含托盘退出，不只是关窗口）**；打开 `%USERPROFILE%\.dsh\profiles\desktop\node_modules`，只清理本插件失败安装的临时目录，以及确认损坏的半安装目录，再安装、启用并重启。正常安装不要删；目录链接只处理链接项，不进入目标删除。

不要删除整个 `node_modules`、`.dsh`、profile、`package.json`、`pnpm-lock.yaml` 或其他插件。尤其保留 `.dsh/persona` 与 `.dsh/personas` 的人设、记忆和绑定。仍失败时检查文件占用或权限，不要关闭系统防护；在 [Issues](https://github.com/Tests4gptplay/dsh-kujira-persona/issues) 提供脱敏错误日志。

## 数据与请求归属

```text
~/.dsh/
├── persona/                       # 旧鲸鱼娘，原位保留
│   └── 90-记忆.md
└── personas/
    ├── .kujira-catalog.json        # 对话保存的自定义角色和模型绑定
    ├── gpt/                       # GPT / o / Codex 各版本共用
    ├── gemini/                    # 每个其他家族各一份
    ├── claude/
    ├── ...
    └── stella/                    # 用户自定义角色示例
```

使用 `DSH_HOME` 时替换默认根目录。`personaDir`、`memoryFile`、`extraText` 仍仅作用于旧鲸鱼娘；`personasDir` 管理其他家族与用户角色。升级不会移动、重置旧文件，也不会自动把旧鲸鱼娘记忆复制给所有角色。

AI 写入默认跟随**发起工具调用的那次请求**。若鲸鱼娘本轮还在执行、用户已把下一次模型切成 GPT，当前工具仍写鲸鱼娘；用户明确指定目标角色则按指定处理。人工 `/remember` 按当前选择、下一步将使用的角色写入。新模型绑定在下一次组装生效，不追改当前请求的人设。

文件是学习的持久来源。各角色保留原有同步规则：只更新未被用户修改的内置文件，用户改动不覆盖；显式工具删除的文件不会同步复生。每个文件有尽力而为的滚动备份，不是完整历史。角色目录隔离不等于删除同一会话里的历史聊天。

## 命令与配置

`/persona` 看当前角色；`/persona help` 看对话例句；`/persona list` 看内置/自定义角色与用户绑定；`/persona files`、`show`、`sync` 保留；`/remember 一句话` 是人工记忆入口。普通使用优先对话，不要求学习这些命令。

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 插件开关 |
| `mode` | `auto` | 按模型家族匹配；`fixed` 固定角色 |
| `persona` | `deepseek` | 固定模式的已有角色 ID |
| `unknownPersona` | `none` | 未匹配模型不强加角色 |
| `allowAgentWrite` | `true` | 对话编辑与角色管理工具；关闭后人工 `/remember` 仍可用 |
| `personaDir` / `memoryFile` | 原鲸鱼娘路径 | 旧配置继续有效 |
| `personasDir` | `~/.dsh/personas` | 其余家族、用户角色及绑定索引 |
| `sharedDir` | 空 | 用户显式选择的共享偏好目录，只读取 |
| `modelRules` | `[]` | 高级手工规则；普通用户通过对话管理绑定即可 |
| `seed` / `sync` | `true` | 默认文件铺设 / 更新未修改文件 |
| `extraText` | 空 | 仅旧鲸鱼娘额外文字 |

匹配顺序：固定模式 → 对话保存的绑定（最新的优先）→ 配置 `modelRules` → 内置模型家族 → `unknownPersona`。绑定项支持 `*`，其余字符按字面、忽略大小写匹配。解绑只移除用户规则，恢复配置/内置匹配，不删除角色文件。`none` 可显式关闭某个模型的人设。

## 运行范围与署名

本次只处理面向用户的对话人设，不添加子代理人格继承或调度。运行代码只有人设选择、按需目录查询、文件/绑定读写；没有后台轮询、watchdog、重试守卫、技能/工具拦截、安装自检或宿主参数改写。测试、审计和发布辅助脚本只保留在独立 QA 分支，不进入 main 或安装包。兼容目标为 DSH 0.2.1-rc.2；真实桌面与账号推理验收范围以 Release 说明为准。

原有 CC BY-NC-SA 4.0 不变。DeepSeek 署名链为上善无形 → ZipZipPipe；其余视觉母题为 ZipZipPipe。新增性格/表达属于插件原创默认值，不代表厂商或作者钦定正史；第三方权利不因本仓库许可而重新授权。详见 [NOTICE.md](NOTICE.md)。
