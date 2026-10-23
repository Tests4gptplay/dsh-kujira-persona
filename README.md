# dsh-kujira-persona

**v1.6.0 · 共同世界观＋随模型切换的 AI 娘 · 对话保存后自动更新缓存。**

这是面向用户聊天的人设娱乐插件，保留包名 `dsh-kujira-persona` 和插件 ID `whale-persona`。不需要 npm 账号，不增加子代理人格系统。

## 两层档案

**全局 world** 保存大家共用的世界观、公开角色名录和人物关系。每个角色都知道其他人是谁，但不是同时扮演所有人。

**当前 persona** 只保存本次发言者的身份、性格和个人记忆。切换模型家族才切换角色；版本号、尺寸和推理档位不同，仍使用同一份角色与记忆。

| 家族 | 稳定角色 ID | 公开基础角色 |
| --- | --- | --- |
| DeepSeek | `deepseek` | 蓝发鲸鱼娘，小鲸 |
| GPT / ChatGPT / o 系列 / Codex 变体 | `gpt` | 白龙娘 |
| Gemini | `gemini` | 彩发猫娘 |
| Claude | `claude` | 橙发书卷娘 |
| Grok | `grok` | 金发蝠翼娘 |
| GLM / ChatGLM | `glm` | 黑白狐娘 |
| Kimi / Moonshot | `kimi` | 星月娘 |
| Qwen / QwQ / QVQ | `qwen` | 中式折扇千问娘 |
| MiniMax | `minimax` | 橙发创作娘 |
| Llama | `llama` | 羊驼娘 |
| 豆包 / Seed | `doubao` | 科技风豆包娘 |

资料库没有的模型不强套人设，仍可读取共同背景；用户可以通过对话自行创建、绑定角色。全局名录是公开识别资料，不会把其他角色的完整个人档案和私人记忆塞进当前聊天。

## AI 实际加载的 README 与静默刷新

包内 [`instructions/README.md`](instructions/README.md) **由插件启动时读取一次，并显式加入本插件的全局提示词段**，不是放在仓库里等 AI 自己寻找。安装后的中英文插件说明页也写明相同操作方式。

直接对 AI 说：

> 把龙娘和鲸鱼娘的关系补充到全局世界观，注明是我的私设。

> 把说话风格改得更简洁，并保存到当前角色的档案。

AI 用 `persona_edit` 实际保存：`scope=world` 写全局，`scope=persona` 写当前/指定角色；`category=world` 默认写全局。**本插件保存成功后直接更新受影响的内存缓存，下一次请求使用新内容，不需要再调用 reload，更不需要用户重启 DSH。**

若 AI 使用其他文件/终端工具改了档案，说明要求它在同批修改完成后调用一次 `persona_edit(action=reload, scope=world|persona)`，必要时指定角色 ID。只重读实际修改的范围，不把刷新任务交给用户。外部改模型绑定索引则用 `persona_manage(action=reload)`；本插件 create/bind/unbind 已自动更新绑定缓存，不重复刷新。

这里的刷新是**重读内容**，不是重启、卸载或重新启用插件，不清空会话，不改模型。正常使用没有定时器、文件监听或每轮自检。AI 对外部文件改动后是否执行说明仍取决于模型；本插件自己保存后的缓存更新不依赖 AI 记住额外步骤。

## 普通聊天不再扫描磁盘

启动只读取说明和全局世界观；角色第一次使用时读取该角色；绑定索引首次使用时读取。之后连续聊天、同家族换版本、切回已加载角色，都从内存取内容，不 `readdir`、不 `stat`、不读档案或索引。

保存只处理受影响文件并更新缓存；首次读取、保存和显式重载使用异步文件接口。同一档案的异步写入按调用顺序完成，不使用宿主全局锁、后台任务或重试守卫。原有内置文件同步只在首次使用或显式 sync 时进行，不在每轮聊天中比对哈希。

缓存范围是**一个 DSH 插件运行实例**。独立启动的 Desktop/Web 实例之间不做后台同步。在外部编辑器改文件，或另一个实例改文件后，需要一次明确重载；仅刷新界面不等于重读档案。加载后重读一次即可，不必周期性刷新。

## 对话添加角色与模型绑定

> 创建名叫星璃、ID 为 stella 的角色，基本设定是……，绑定当前模型。

> 把 my-gateway 中 my-model-* 的全部版本绑定星璃，共用已有记忆，不另建角色。

> 将我的私有模型别名绑定到 GPT 白龙娘，不要复制一份白龙娘。

`persona_manage` 支持 `list`、`models`、`create`、`bind`、`unbind` 和外部索引改动后的 `reload`。新增角色的公开名字会出现于共同名录；公开背景和关系按用户要求补充，个人文本不自动全局共享。

“添加模型”指添加**模型到角色的绑定**，不是创建 API 服务。尚未接入的模型在 DSH 模型设置配置，本插件不索取密码、Token 或 API Key。

## GPT 与 Codex 的分类

DSH 模型菜单的显示名称、实际 provider ID 和 model ID 是不同字段。`openai-codex` 是 DSH 内置入口，`codex-local` 是本地 Codex 插件入口；其中识别出的 GPT/Codex 模型共用 `gpt` 白龙娘。

OpenRouter、GitHub Copilot、Bedrock、Groq 及自定义中转站可能承载不同家族，不能整组归为 GPT。OpenAI-compatible 是协议，不是角色身份；Groq 与 Grok 不同，Gemma 也不会因来自 Google 而误归 Gemini。未知部署别名默认留空，由用户通过对话绑定。没有模型版本白名单或版本准入验证。

说“列出我现在 DSH 可用的模型及对应角色”，AI 才会按需调用宿主目录接口 `listProviders()` / `listModels()`；普通人设组装不读取完整模型目录，不发探测推理。供应商的目录实现本身可能联网获取列表。

## 安装与升级

### 官方桌面应用

打开 **插件 → 添加插件**，输入：

```text
github:Tests4gptplay/dsh-kujira-persona#v1.6.0
```

安装、启用并重启 DSH 一次；选模型发消息后用 `/persona` 查看。升级时在插件列表卸载旧包再装新版，不同时启用多个副本；**保留 `.dsh/world`、`.dsh/persona` 和 `.dsh/personas` 中的资料。**以后修改人设内容不需要重启。

### Web CLI

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v1.6.0'
```

`web` 与桌面应用的 `desktop` 是不同 profile。备用 `.tgz` 见 [GitHub Releases](https://github.com/Tests4gptplay/dsh-kujira-persona/releases)。这是 GitHub 托管的 npm 格式包，不是 npm Registry 发布；没有 prepare/postinstall/build 安装脚本。

### Windows `ERR_PNPM_EPERM`

若报错是 `dsh-kujira-persona_tmp_* -> dsh-kujira-persona` 重命名失败，取消安装并**完全退出 DSH（含托盘）**。按 Win+R 打开 `%USERPROFILE%\.dsh\profiles\desktop\node_modules`，只清理本插件失败安装的临时项，以及确认损坏的半安装目录，再重装。正常安装目录不要删；目录链接只处理链接项，不进入目标删除。

不要删除整个 node_modules、.dsh、profile、package.json、pnpm-lock.yaml、其他插件，尤其保留 world、persona、personas 中的人设、记忆和绑定。仍失败时检查文件占用或权限，不要关闭系统防护；可在 [Issues](https://github.com/Tests4gptplay/dsh-kujira-persona/issues) 提交脱敏日志。

## 数据位置与旧资料

```text
~/.dsh/
├── world/                         # 共用世界观、公开名录、关系
├── persona/                       # 原鲸鱼娘，原位保留
└── personas/
    ├── .kujira-catalog.json        # 自定义角色与模型绑定
    ├── gpt/                       # GPT 各版本共用
    ├── gemini/
    ├── ...
    └── stella/                    # 用户角色示例
```

设置 DSH_HOME 时替换默认根目录。旧鲸鱼娘、GPT 和其他角色的文件全部原位保留；旧角色目录中的世界观补充也不自动搬走或公开。用户明确要求后，才通过对话把相应条目补充到全局。共享不是复制全部私人记忆。

`persona_edit` 的默认写入归属仍跟随发起工具调用的请求；用户中途把下一次模型切走，不改当前工具的角色。明确指定目标角色时按指定处理。人工 `/remember` 按当前选择、下一步使用的角色写入。

旧版同步规则继续保留：只更新未被用户修改的内置文件，用户修改不覆盖；工具明确删除的文件记录为已删除。滚动备份是尽力而为，不是完整历史。角色目录隔离也不等于清空历史聊天。

## 命令和配置

普通使用直接对话即可。`/persona help` 看说明，`/persona` 看当前角色，`/persona world` 看世界观；`/persona reload` 重读当前角色，`/persona world reload` 重读共用内容。`files`、`show`、`list`、`sync` 和 `/remember 一句话` 继续可用；`/persona world sync` 显式同步世界观默认文件。

| 配置 | 默认 | 用途 |
| --- | --- | --- |
| enabled | true | 插件开关 |
| mode | auto | 随模型；fixed 为固定角色 |
| persona | deepseek | 固定模式的已有角色 ID |
| unknownPersona | none | 未匹配模型不强加角色 |
| worldDir | ~/.dsh/world | 共用世界观与名录 |
| personaDir / memoryFile | 原鲸鱼娘路径 | 旧设置继续有效 |
| personasDir | ~/.dsh/personas | 其他角色和绑定索引 |
| sharedDir | 空 | 显式共用偏好，只读、缓存，随世界观重载 |
| allowAgentWrite | true | 对话写入工具；关闭后人工 remember 仍可用 |
| modelRules | [] | 高级规则，普通用户用对话绑定即可 |
| seed / sync | true | 默认文件铺设 / 更新未修改文件 |
| extraText | 空 | 仅鲸鱼娘的额外文字 |

匹配顺序：固定模式 → 对话绑定 → modelRules → 内置家族 → unknownPersona。绑定支持用户明确要求的 `*` 通配符，其他字符按字面、忽略大小写。解绑不删除档案或记忆。

## 范围与署名

运行包只有 3 个 JS、文字档案、说明和元数据，没有运行依赖、安装构建钩子、测试、QA 或 CI 工作流。没有后台轮询、watchdog、定时刷新、文件监听、技能/工具拦截、宿主参数改写或子代理人格调度。测试和文件操作计数仅在独立 QA 分支，不合入 main。

视觉资料依据 [AI-gijinka 图鉴](https://github.com/Tests4gptplay/ai-gijinka-art-world)。原有 CC BY-NC-SA 4.0 不变；DeepSeek 署名链为上善无形 → ZipZipPipe，其余视觉母题署名 ZipZipPipe。新增交流框架和性格为插件原创默认值，不代表作者统一正史；没有打包第三方图片。详见 [NOTICE.md](NOTICE.md) 与 [CHANGELOG.md](CHANGELOG.md)。真实桌面 UI 与账号聊天的验证范围以 Release 为准。
