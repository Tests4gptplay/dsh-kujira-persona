# Kujira · AI 角色与世界

**安装 / 升级：** `github:Tests4gptplay/dsh-kujira-persona#v2.4.1` · [下载 2.4.1 安装包](https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.4.1/dsh-kujira-persona-2.4.1.tgz) · [安装步骤](#安装与升级)

<!-- ACCOUNT-VALIDATION-WEB-ONLY:START -->
**账户查询验证范围：Codex 与 OpenAI API 已获用户验证；其他来源待用户验证反馈。**

**Account-query validation: Codex and OpenAI API have been user-verified; other sources await user validation and feedback.**
<!-- ACCOUNT-VALIDATION-WEB-ONLY:END -->

## 2.4.1：与模型接入匹配的账户查询

设置最底部的“公司与接入方式”按已有模型与接入来源列出需要配置的可用方案，显示对应字段和官方指南。独立查询密钥通过宿主凭据服务保存，不覆盖模型推理密钥；自动查询保持自动，无匹配方案时不显示账户栏。

OpenAI 显示官方本月消费与 Completions 用量，不当作余额。各查询按服务商返回的周期、币种和适用模型显示；第三方兼容来源需明确选择，并保持同源限制。

配置入口：**设置 → Kujira · 人设 → 最底部“公司与接入方式”**。填写后点击“保存查询设置”，再点击“查询账户信息”。

**随 DSH 中选用的模型切换角色，在对话中继续养成自己的世界与人物。**

Kujira 将共同世界观与通用偏好、各角色独立的性格和记忆、可选的 AI 日记分层保存，随 DSH 已选模型和前台任务联动。可以通过对话创建角色、修改档案和调整绑定；同模型家族的版本默认延续同一角色与记忆。

设置、状态和错误提示支持中英文。可选桌宠提供角色动作、主题、气泡互动、工作统计和服务可提供的余额／套餐信息，支持页面内和跨平台桌面显示；具体使用条件见安装说明。更新保留已有档案，用户自定义优先。

桌宠、AI 日记和睡眠整理分别启用：关闭桌宠仍可使用人设；日记与整理调用模型并消耗 Token。睡眠整理处理当前角色昨天及更早的日记；允许代理修改档案时，也可读取和整理当前角色自己的档案（Persona），保存修改前备份并检查写入冲突。

**Support / 赞助：** [GitHub Sponsors](https://github.com/sponsors/Tests4gptplay) · [Ko-fi](https://ko-fi.com/kou392350) · [Patreon](https://www.patreon.com/cw/Kou848) · [爱发电 / Afdian](https://afdian.com/a/kkt_ifd1) · [支付宝 / Alipay](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/SPONSOR.md)

## 2.4.0：更新保留你的角色与设定

新版基础内容不会在启动时覆盖现有档案。更新时，请让 AI 阅读档案里的升级通知，以你的现有设定为主体补充新版内容；遇到矛盾时以用户自定义为主，无法确认来源的内容优先保留。首次安装也按通知创建基础档案，无需手动覆盖人设目录。

未完成的更新可以稍后继续；保存并重新读取确认后，再清理本次更新内容与通知。已经完成的更新不会因普通重启重复出现；关闭 AI 编辑时保留待处理事项，不绕过你的权限设置。独立记忆、日记和美术资源不会因此重写。

工具、目录与恢复机制的技术说明见 [改动与依据](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/docs/testing/CHANGES.md)。

## 2.3.1 更新

修复桌宠在 Windows 桌面与 DSH 页面内切换后消失的问题。直接修改显示位置即可切换，不需要取消后重新勾选“启用桌宠”；切换过程保留启用状态和当前会话。

## 世界观与人物

**世界观**是大家共用的称呼、社区印象、梗和人物关系，让角色认识彼此。比如与 DeepSeek 聊天时，她也知道“猫猫”通常指 Gemini、“白龙”指 GPT。故事发生在哪里、角色如何相处，都可以由你继续设定。

**人物**是每个角色自己的性格、喜好和记忆。切换模型家族时切换角色；同一家族的不同版本默认共用一个角色和已有记忆。内置多种 AI 角色基础预设，也支持通过对话创建与调整自己的角色。

默认自然说“我”，介绍时使用 DeepSeek、GPT、Gemini 等名字；Gemini 在社区也被称为猫猫、哈基米；项目显示名为星猫。外观细节用于美术表达。你另起名字或使用自定义角色时，就按你选定的称呼来。

预设只是起点。称呼、性格、关系和模型对应的角色都能改；与你的要求不同，就按你的来。

内置角色的基础资料会在插件启动时准备到人物目录，设置页无需逐个点击初始化。DeepSeek 也位于统一的 `personas/deepseek` 目录；从旧版 `persona` 位置迁移时保留原有文件和备份，已保存的人设及记忆优先。角色的默认性格留给用户自行养成，社区称呼和有出处的外形资料放在共同世界观与基础档案中。

### 当前默认规则：共同设定、个人记忆与隐私

2.3.0 延续共同世界观、角色档案和独立日记的分层：

- **共同世界观 `world`：** 公共人物背景，以及明确适用于所有角色的共同习惯、项目共识和经确认可共享的经验；共同要求与人物背景分开记录。
- **角色档案 `persona`：** 当前角色的性格、表达方式、个人偏好、针对性纠正和记忆；范围不明的要求先保留在当前角色，不自动推广到其他角色。
- **独立日记：** 各角色自己的记录、摘要和检索，与共同设定和人设档案分开保存；不会把全部日记正文作为共同背景注入。

默认共同规则包含“隐私与公开边界”：私聊和私人上下文默认私密，执行任务不等于获得公开披露授权；公开内容限于已获授权的作品事实、来源与署名。它是所有角色共同遵循的默认协作原则，不抹平个人差异。

长期偏好与行为纠正按适用范围保存；先读取、合并或更新已有 Markdown，不把临时要求或推测当成长期记忆。已有设定、个人修改和记忆继续优先保留。

规则原文见 [共同世界观与隐私边界](world/00-共同世界观.md#隐私与公开边界)、[分层与长期偏好保存说明](instructions/README.md)及各角色的学习规则与记忆文件（如 [GPT 学习规则](personas/gpt/70-学习规则.md)）。这些规则是当前版本沿用的默认设置；**AI 日记与睡眠整理仍是两个独立、默认关闭的选项，需分别勾选开启相应功能。**

## 2.3.0：模型联动桌宠与新版动作

只显示一只桌宠：切换当前前台对话的模型，就让这一只换成对应形象；同一家族的不同版本沿用同一人物。用户明确指定的角色优先，通过对话修改模型绑定后，桌宠会跟随更新。其他会话和后台子代理的活动不会接管前台桌宠。

已接入 DeepSeek、GPT、Gemini、Claude、Grok、GLM、Kimi、Qwen、MiniMax、Llama、豆包、Mistral、混元和 MiMo。

桌宠默认关闭，可以在 DSH 设置 → Kujira · 人设中开启“启用桌宠”。用户明确绑定的角色优先。支持页面内显示、Windows x64 原生桌面窗口（需要 .NET Framework 4.8），以及 Linux/macOS 的 Electron 伴随窗口适配。Linux/macOS 需要可用的 Electron 运行时：默认使用 PATH 中的 `electron`，也可通过 `KUJIRA_ELECTRON_EXECUTABLE` 指定可执行文件（macOS 支持 Electron.app 路径）；安装包不内置 Electron。页面位置和桌面位置分别保存。设置包括角色与气泡大小、活动程度、减少动态、提示音、位置重置，以及余额／套餐和工作统计各自的显示开关。关闭桌宠后，原有人设、世界观和对话修改功能仍可使用。

在桌宠或气泡上点击右键，可分别显示／隐藏桌宠、显示／隐藏气泡，或同时关闭两者。只显示气泡时仍可拖动；全部隐藏后，可从 Kujira 设置页重新显示。页面菜单使用 DSH 官方菜单组件；Windows 原生菜单同步当前皮肤的圆角、字体、间距、边框与配色。

### 2.3.0 动作更新

相较 2.2.3，本版共**新增与修整 25 项状态动画**：其中 **13 项通用工具动作由静态改为持续循环**，另有 **12 项测试、检索、思考、编辑、回复等专用动作更新**。

- **Qwen：** 阅读检索动作加入翻页、对照、回翻与继续阅读的完整往返。
- **GPT：** 通用工具状态使用连续打字动作，测试状态更新为检查单动作。
- **Gemini、Mistral：** 改善低头棋盘操作与读书思考时的视线、手部和道具表现。
- **MiniMax、混元：** 修整回复时的手部方向与连续性，以及编辑动作中的抬起检查表现。

全部图集做无损体积优化，保持像素、透明度、色彩信息和尺寸；原有互动、状态切换及减少动态设置继续保留。

### 任务状态与动作

桌宠跟随待机、思考、查找、编辑、执行命令、检查、等待确认、完成和出错等阶段。暂时失败的工具会触发短暂反应，之后继续跟随当前工作；整轮任务终止出错时保留错误状态。需要用户回答或批准时，等待状态会持续到相应条件解除。

页面桌宠和 Windows 桌宠共用动作时间线，逐帧播放角色姿态，常规动作采用单层逐帧播放，状态改变时即时切换。拖起与落地即时切换；减少动态时保持静止待机图，任务文字继续更新。GPT 支持摸头、戳一下、碰尾巴、拖放和随机待机小动作；其他角色按各自动作提供相应反应。

各角色都有待机、工作、等待和结果反应。部分角色的思考、查找、编辑等阶段共用中性工作动作；性格尚未明确的角色采用阅读、工作、等待等标准功能动作。

GPT、DeepSeek 等角色提供独立的工作与互动动作，其他角色也依照自身图集表现不同任务阶段。新图集按不同人物的动作特点分别编排。

动画图集依据 AI-gijinka 资料库和角色参考，通过 AI 生成与整理，保留各角色的发型、服饰、配件和识别特征。来源与使用条件见 [桌宠说明](pet/NOTICE.md)。

### 工作气泡里的统计

启用“显示工作统计”后，工作气泡分三行显示当前前台会话的读数：**轮次与步骤、生成速度；累计 Token 与缓存命中；上下文已用比例**。显示内容随 DSH 提供的数据更新。完成后可以继续看到本会话统计，切到新会话时使用新会话的数字。

这些数字采用 DSH 底栏的统计口径：轮次和步骤按会话累计，生成速度根据解码时间与输出 Token 计算；缓存读、缓存写、未缓存输入与输出按各自类别计数。

“上下文已用比例”表示当前上下文窗口的占用情况。任务状态、任务清单进度与账户信息分别显示。DeepSeek 接入显示余额，Codex Native 接入显示套餐窗口余量；各账户按 DSH 提供的接口展示相应数据。

工作统计直接使用 DSH 已有的会话数据。余额／套餐有独立的查询与刷新设置；临时查询失败时，会保留并标明上次结果。

## 扩充和修改，直接在 DSH 聊天框里说

补充世界观、修改人物性格、创建原创角色、给自定义模型指定角色，都可以通过对话让 AI 完成，不必手动编辑文件。例如：

> 把白龙的语气改得活泼一点，保存到她的人设里。

> 把“白龙和猫猫每周五一起做甜点”补进大家共同知道的设定。

> 创建一个我自己的角色，性格温柔、说话简洁，让当前模型使用。

之后还可以继续修改角色的名字、性格和故事，或让其他模型也使用同一角色。通过对话保存后，后续聊天就会使用更新的设定，无须另外刷新或重启。

这里添加的是角色和模型之间的对应关系；尚未接入 DSH 的模型，先在 DSH 的模型设置中接入。

## 离线动作试玩

离线试玩可从源码构建；本次提供插件 `.tgz` 和校验文件，不包含试玩 ZIP。安装 Node.js 后，在源码目录运行 `node scripts/qa/build-playable.mjs <空输出目录>`，保留生成的 `index.html` 和 `assets` 目录结构，双击 `index.html` 即可体验。支持切换角色、预览任务阶段、播放或暂停动作、调整大小和背景，也可以点击、拖动角色。

试玩使用与插件一致的播放器和动画图集，提供任务阶段的交互预览；插件在 DSH 中接收实际任务状态。[试玩构建脚本](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/main/scripts/qa/build-playable.mjs)与[功能检查记录](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/main/docs/development/PROGRESS_20261024.md)可在源码仓库查看。

## 2.3.0：人物档案与实验性日记

在 DSH **设置 → Kujira · 人设** 中统一调整桌宠，打开共同世界观、基础人设和每个角色的本机档案文件夹。页面显示各目录的占用大小及档案总计；进入该页或点击“刷新文件夹大小”时统计，不持续扫描磁盘。

修改世界观、人物性格、记忆、角色绑定或档案存放位置，请在 DSH 对话中直接告诉 AI。气泡大小滑块按比例缩放整个信息气泡，包括标题、任务、进度、统计和账户信息。

### 实验性功能：AI 日记

2.3.0 修复并发追加时的摘要竞争，并加强中断重试的恢复记录：同一操作重试不重复追加正文，尚未提交的摘要保留待整理。

在设置页最下方的 **实验性功能 → AI 日记** 中开启，默认关闭。各角色拥有独立日记，AI 自主决定何时记录与检索。大日记按角色与日期续写，支持关键词搜索和分段读取；每次写入后由 AI 整理简短摘要，摘要随当前角色上下文使用。

**会产生额外 token 消耗，消耗量不可控、无法预估。**

使用“设置日记库”保存目录位置，或点击“打开日记库”查看文件。

“睡眠整理”独立开关，默认关闭。开启后，仅在所有对话任务空闲时，使用前台当前选择的同一模型整理当前角色昨天及更早的日记；新任务开始时停止后台整理。整理结果可优先检索，原文保留。**此功能会在后台自动调用 AI，产生额外 token 消耗，消耗量无法预估。**

## 安装与升级

当前版本：**2.4.1**。安装包与固定标签均已包含运行文件，无需编译。

**首次安装（Desktop）：** 打开侧栏 **插件 → 添加插件**（箭头菜单的 **安装第三方插件** 也可进入），把下面一整行填入 **包名或地址**，点击 **安装**，核对版本后点击 **立即启用**。

```text
github:Tests4gptplay/dsh-kujira-persona#v2.4.1
```

**升级已有插件：** 同样填写上面的新版来源，成功后核对版本并启用；已有设置与用户文件保留。若宿主提示已安装或要求先卸载，再按提示仅卸载该插件条目并安装新版，不清除 DSH 数据或手工删除插件目录。是否需要重启以 DSH 提示为准；需要时完全退出并重新打开（Desktop 包括托盘）。

安装或更新前，建议先关闭桌面上已显示的桌宠和提示气泡（桌宠右键菜单 → “全部关闭”）；未关闭时，文件占用有可能导致安装失败。 Before installing or updating, we recommend closing the visible desktop pet and bubbles; open files may cause installation to fail.保留世界观、人物档案、记忆、日记与自定义目录；新版基础内容按通知增量合入。

**备用安装包：** 将下面的 `.tgz` 直链填入同一个 **包名或地址**；也可下载后填写文件的完整绝对路径，无需解压。该路径应属于运行 DSH 的电脑。

```text
https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.4.1/dsh-kujira-persona-2.4.1.tgz
```

**Web：** 在运行服务的环境中执行。升级前停止对应 Web profile，成功后重新启动；Web 与 Desktop 分别安装。

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v2.4.1'
```

备用时将命令中的来源换成上面的 `.tgz` 直链或下载文件的完整绝对路径。

Linux/macOS 的窗口适配已实现，但 Linux 原生 Desktop 整体挂接及 macOS 原生窗口仍需目标系统实机验证；现有 Linux Web 测试不替代这些原生窗口验证。平台选择与启动实现见 [`launch-spec.mjs`](pet/companion/launch-spec.mjs)，已验范围见 [改动与依据](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/docs/testing/CHANGES.md)。

**保留 `.dsh/world`、`.dsh/persona`、`.dsh/personas` 中的设定与记忆（包括人物目录内 `.kujira-catalog.json`），以及DSH数据目录的 `kujira-pet.json`、`kujira-diary.json`、`kujira-diary-sleep.json` 与已配置日记库；自定义路径以实际设置为准。** 已编辑档案不会被新版预设覆盖。

### Windows 安装提示 EPERM

若出现 `dsh-kujira-persona_tmp_* -> dsh-kujira-persona` 重命名失败：取消安装，完全退出 DSH（含托盘），打开 `%USERPROFILE%\.dsh\profiles\desktop\node_modules`，只清理本插件失败安装的临时目录和确认损坏的半安装项，再重新安装。正常目录不需要删除；目录链接只处理链接本身。

保留其他插件、profile 配置，以及上述人设和记忆目录，无需删除整个 `node_modules`、`package.json` 或 `pnpm-lock.yaml`。仍有问题可在 [Issues](https://github.com/Tests4gptplay/dsh-kujira-persona/issues) 附上脱敏错误日志。

## 测试与验证

运行基线候选的 [Windows 增量摘要](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/docs/testing/CANDIDATE13-WINDOWS.md) 记录 7/7 限定用例通过；[发布准备边界](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/docs/testing/RELEASE-READINESS.md) 区分已关闭事项、历史未验范围与历史覆盖边界。原云端针对性结果继续采用，不把工具调用次数当作测试用例数。

2.3.1 的显示位置切换回归见 [发布说明](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/2b25e9aa476411dca0244a733841c3ff4a1c3216/docs/releases/v2.3.1.md)。基础功能的测试方法、覆盖范围、结果与限制见 [2.3.0 公开测试报告](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/main/docs/testing/v2.3.0.md)。另见 [正式发布 CI](https://github.com/Tests4gptplay/dsh-kujira-persona/actions/runs/40626809571)。

## 来源与更新记录

本插件是非官方同人项目。基础资料来自 [AI-gijinka 资料库](https://github.com/Tests4gptplay/ai-gijinka-art-world) 与社区作品的共性整理，人物和世界观都可以继续改写。

DeepSeek 形象署名链：上善无形 → ZipZipPipe；MiMo 形象作者：甶丶。其余来源与署名见 [NOTICE.md](NOTICE.md) 和 [资料来源](world/_资料来源.md)，许可见 [LICENSE](LICENSE)。版本变化见 [CHANGELOG.md](CHANGELOG.md)。

### 余额、费用与单价 / Account queries and prices

设置最底部的「公司与接入方式」只列现有 AI 模型接入中需要额外配置的查询方案。按模型身份与实际服务端来源匹配。自动查询不重复列菜单；无对应方案时隐藏账户信息栏。

DeepSeek、Moonshot 中国和 OpenRouter 普通 key 查询可以复用现有模型凭据。OpenAI/Anthropic 组织消费与用量、xAI 月消费、Mistral 企业预算、OpenRouter Management、GLM Coding、MiniMax 精确模型套餐与 Ark 个人 Agent Plan 按各自权限设置。选择方案后显示对应字段和指南。用户输入的独立查询凭据交给 DSH 现有凭据服务保存，Kujira 只保存引用，不覆盖模型推理密钥。

Claude Code 订阅不作为 Anthropic API 查询。第三方兼容项仅用于已有明确同源兼容配置，并标注「第三方」；不会把官方凭据自动发往异站。

模型单价仍可保存每百万 token 的输入、输出及缓存参考费率；OpenRouter 可读取精确模型 ID 的价格目录。参考价不是实际账单，余额、消费、用量与套餐/预算额度分别标注，不用会话 token 猜账户余额。

The bottom **Company and connection method** selector lists supported model-service queries needing extra setup. Automatic queries are not listed again, and unsupported account sections are hidden. Query credentials are stored by the existing DSH Host credential service under separate references, not in Kujira configuration or over model inference keys. Explicit same-origin third-party compatibility is labeled; credentials are never automatically sent to another site. Reference token prices remain separate from actual account spend.
