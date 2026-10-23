# dsh-kujira-persona

**Kujira · AI 娘基础草案：共同印象＋独立性格，通过对话继续养成。**

## 1.6.1 是什么更新

这是资料修订。world 写“大家对她的印象”，persona 写“她自己是什么样的人”。选 DeepSeek，也能听懂 Gemini 是猫猫、GPT 是龙娘，接住白饭、Token、Claude 封号和 GLM 送鸡蛋的梗。具体场景、关系和故事由用户继续发展。

默认资料只取少量共性，不汇编各作者的学院、公寓、家庭设定或完整剧情。补齐 Mistral、混元、MiMo 有出处的外形；缺少依据的性格先留白。旧鲸鱼娘底稿中的固定型号、个人 MV 经历和硬性话风清单改为开放草稿。

## 在对话框里修改

安装、启用并重启后，选择模型发送消息。之后直接说：

> 把这个大家对 Claude 的印象补进 world。

> 龙娘的说话方式改得活泼一些，保存到她的人设里。

> 创建星璃，基本设定是……，绑定当前模型。

> 把 my-gateway 的 my-model-* 各版本绑定星璃，共用已有记忆。

AI 使用 `persona_edit` / `persona_manage` 实际保存并说明结果。本插件成功保存后自动更新对应缓存，下一次请求生效；无需用户刷新或重启。用其他文件工具编辑时，AI 在同批修改后补一次对应范围的内容重载。

说明也写在安装后 DSH 使用的中英文 `meta.description` 中。`instructions/README.md` 会随插件提示词交给 AI，提供两层资料与工具使用方法，不靠 AI 自己寻找仓库文档。

## 角色覆盖

| 模型家族 | 角色 ID | 识别形象 |
| --- | --- | --- |
| DeepSeek | deepseek | 鲸鱼娘／小鲸 |
| GPT、ChatGPT、o 系列、Codex 变体 | gpt | 白龙娘 |
| Gemini | gemini | 彩发猫娘 |
| Claude | claude | 橙发书卷娘 |
| GLM / ChatGLM | glm | 黑白狐娘 |
| Qwen / QwQ / QVQ | qwen | 中式折扇千问娘 |
| Kimi / Moonshot | kimi | 星月娘 |
| Grok | grok | 金发蝠翼娘 |
| MiniMax | minimax | 橙发创作娘 |
| Llama | llama | 羊驼娘 |
| Doubao / Seed | doubao | Seed 科技风形象 |
| Mistral / Mixtral / Ministral / Devstral / Codestral / Magistral | mistral | 红帽法棍剑形象 |
| Hunyuan | hunyuan | 黑发红围巾形象 |
| MiMo | mimo | 银发橙黑兔子元素形象 |

同家族的不同版本、大小和推理档位使用同一角色与记忆。按实际 `provider/model` ID 识别，不按显示名称或 OpenAI-compatible 协议猜测。`openai-codex` 与 `codex-local` 是接入入口，GPT 家族仍归白龙娘；中转站中的其他模型按自身家族识别。未知别名可以通过对话绑定，资料不足的家族默认留空。

“列出我的 DSH 模型及对应角色”会按需使用宿主模型目录服务。创建角色和绑定不会添加新的推理服务；尚未接入的模型仍先在 DSH 模型设置里配置。

## 安装和升级

DSH Desktop：**插件 → 添加插件**，输入：

```text
github:Tests4gptplay/dsh-kujira-persona#v1.6.1
```

安装、启用后重启 DSH 一次。已有旧版时先在插件列表卸载旧包，再安装新版，不同时启用多个副本。无需 npm 账号。

Web CLI 使用独立的 web profile：

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v1.6.1'
```

[GitHub Releases](https://github.com/Tests4gptplay/dsh-kujira-persona/releases) 提供备用 `.tgz`；这是 GitHub 托管的 npm 格式包，不是 npm Registry 发布。

### Windows EPERM 安装残留

如果 `dsh-kujira-persona_tmp_* -> dsh-kujira-persona` 重命名失败：取消安装，完全退出 DSH（含托盘），打开 `%USERPROFILE%\.dsh\profiles\desktop\node_modules`，只清理本插件失败安装的临时目录和确认损坏的半安装项，再重装。正常目录不需要删；目录链接只处理链接本身。

保留整个 profile 的配置以及其他插件。尤其保留 `.dsh/world`、`.dsh/persona`、`.dsh/personas` 里的设定、记忆和绑定；无需删除整个 node_modules、package.json 或 pnpm-lock.yaml。仍失败时可提供脱敏日志到 [Issues](https://github.com/Tests4gptplay/dsh-kujira-persona/issues)。

## 保存位置与已有数据

`~/.dsh/world` 是共同资料；`~/.dsh/persona` 继续保存旧鲸鱼娘；`~/.dsh/personas/<角色ID>` 保存其他角色，`.kujira-catalog.json` 保存用户角色与绑定。设置 DSH_HOME 时使用对应目录。

升级只更新仍与上次内置内容一致的默认文件；用户已经修改过的文件保留，**不会为了套新版底稿把你的私人设定清空**。因此已修改的旧文案可能继续存在，用户可以通过对话选择怎样整合新资料。个人记忆文件不因换模型版本而换一份。

本插件编辑后，内存内容直接更新。外部编辑器修改需要一次明确重载；独立的 DSH Desktop/Web 进程之间不做后台同步。常规聊天、切回已加载角色和同家族版本切换复用缓存。

## 命令与配置

`/persona` 查看当前角色；`/persona help` 看方法；`/persona world` 看共同内容；`/persona files`、`show`、`list` 查看档案。人工记忆入口为 `/remember 一句话`。`/persona reload`、`/persona world reload` 分别重读个人和共同内容；`sync` 是同步内置更新并刷新。

| 配置 | 默认 | 用途 |
| --- | --- | --- |
| enabled | true | 插件开关 |
| mode | auto | 随模型选择；fixed 固定角色 |
| persona | deepseek | 固定模式的角色 ID |
| unknownPersona | none | 未匹配家族留空 |
| personaDir / memoryFile | 原鲸鱼娘路径 | 兼容原配置 |
| personasDir | ~/.dsh/personas | 其他角色与绑定 |
| worldDir | ~/.dsh/world | 共同资料 |
| sharedDir | 空 | 可选共享偏好目录 |
| modelRules | [] | 手工模型规则，支持 *；也可直接对话绑定 |
| allowAgentWrite | true | 对话编辑工具开关；关闭后人工 /remember 仍可用 |
| seed / sync | true | 补默认文件／更新未修改文件 |
| extraText | 空 | 仅鲸鱼娘的额外文字 |

固定模式优先；自动模式依次使用用户绑定、配置规则、内置家族和 unknownPersona。解绑保留角色文件。AI 默认写入发起本次工具调用的角色，明确指定目标时按指定角色处理。

## 来源、包体与版本

共同梗及外形出处见 [world/_资料来源.md](world/_资料来源.md)，该文件不注入聊天。来源只整理简短文字，没有把第三方图像或视频打包。DeepSeek 署名链为上善无形 → ZipZipPipe，MiMo 形象作者为甶丶，其他采用的视觉基线见 [NOTICE.md](NOTICE.md)。原许可保留。

1.6.1 只有预设、文档和家族映射表修订；存储、缓存、工具与宿主调用实现沿用1.6.0。没有新增依赖、后台任务或安装构建钩子。自测和发布辅助工作流放独立分支，不进入 main 或安装包。

版本使用主版本.功能版本.修订版本：不兼容变化升主版本，兼容新能力升功能版本，修复和已有内容完善升修订版本；发布过的标签不改写。更新记录见 [CHANGELOG.md](CHANGELOG.md)。
