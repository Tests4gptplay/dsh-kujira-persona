> **当前候选：2.3.1-acceptance.20261029.11**。本分支候选不是正式Release；安装及实测范围见 [安装说明](test-artifacts/INSTALL.md) 和 [验收记录](docs/testing/ACCEPTANCE.md)。

# Kujira · AI 角色与世界

**随 DSH 中选用的模型切换角色，在对话中继续养成自己的世界与人物。**

Kujira 将共同世界观与通用偏好、各角色独立的性格和记忆、可选的 AI 日记分层保存，随 DSH 已选模型和前台任务联动。可以通过对话创建角色、修改档案和调整绑定；同模型家族的版本默认延续同一角色与记忆。

桌宠、AI 日记和睡眠整理分别启用：关闭桌宠仍可使用人设；日记与整理调用模型并消耗 Token。睡眠整理处理当前角色昨天及更早的日记；允许代理修改档案时，也可读取和整理当前角色自己的 Persona，保存修改前备份并检查写入冲突。

**Support / 赞助：** [GitHub Sponsors](https://github.com/sponsors/Tests4gptplay) · [Ko-fi](https://ko-fi.com/kou392350) · [Patreon](https://www.patreon.com/cw/Kou848) · [爱发电 / Afdian](https://afdian.com/a/kkt_ifd1) · [支付宝 / Alipay](SPONSOR.md)

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

桌宠默认关闭，可以在 DSH 设置 → Kujira · 人设中开启“启用桌宠”。用户明确绑定的角色优先。支持页面内显示与 Windows x64 原生桌面窗口（需要 .NET Framework 4.8）；页面位置和桌面位置分别保存。设置包括角色与气泡大小、活动程度、减少动态、提示音、位置重置，以及余额／套餐和工作统计各自的显示开关。关闭桌宠后，原有人设、世界观和对话修改功能仍可使用。

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

## 安装和升级

本候选安装包为 `dsh-kujira-persona-2.3.1-acceptance.20261029.11-copyclarity.tgz`（198,790,063 字节），通过随交付提供的私有 Library 文件下载；该包超过普通 Git blob 大小上限，不在本分支存放。哈希及步骤见[安装说明](test-artifacts/INSTALL.md)。历史正式v2.3.1仍见[Release](https://github.com/Tests4gptplay/dsh-kujira-persona/releases/tag/v2.3.1)，不要将旧正式包当作本候选。

**更新前，在桌宠右键菜单选择“全部关闭”，关闭已显示的桌宠与提示气泡；再正常卸载旧包、安装新版。**

DSH Desktop：插件 → 添加插件，填写下载后候选 `.tgz` 的完整本地路径。Web在对应profile执行：

```bash
dsh plugin --profile web add '/完整路径/dsh-kujira-persona-2.3.1-acceptance.20261029.11-copyclarity.tgz'
```

Web与Desktop分别安装，启用后正常重启DSH。**保留 `.dsh/world`、`.dsh/persona`、`.dsh/personas` 中的设定与记忆（包括人物目录内 `.kujira-catalog.json`），以及DSH数据目录的 `kujira-pet.json`、`kujira-diary.json`、`kujira-diary-sleep.json` 与已配置日记库；自定义路径以实际设置为准。** 已编辑档案不会被新版预设覆盖。

### Windows 安装提示 EPERM

若出现 `dsh-kujira-persona_tmp_* -> dsh-kujira-persona` 重命名失败：取消安装，完全退出 DSH（含托盘），打开 `%USERPROFILE%\.dsh\profiles\desktop\node_modules`，只清理本插件失败安装的临时目录和确认损坏的半安装项，再重新安装。正常目录不需要删除；目录链接只处理链接本身。

保留其他插件、profile 配置，以及上述人设和记忆目录，无需删除整个 `node_modules`、`package.json` 或 `pnpm-lock.yaml`。仍有问题可在 [Issues](https://github.com/Tests4gptplay/dsh-kujira-persona/issues) 附上脱敏错误日志。

## 测试与验证

2.3.1 的显示位置切换回归见 [发布说明](docs/releases/v2.3.1.md)。基础功能的测试方法、覆盖范围、结果与限制见 [2.3.0 公开测试报告](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/main/docs/testing/v2.3.0.md)。另见 [正式发布 CI](https://github.com/Tests4gptplay/dsh-kujira-persona/actions/runs/40626809571)。

## 来源与更新记录

本插件是非官方同人项目。基础资料来自 [AI-gijinka 资料库](https://github.com/Tests4gptplay/ai-gijinka-art-world) 与社区作品的共性整理，人物和世界观都可以继续改写。

DeepSeek 形象署名链：上善无形 → ZipZipPipe；MiMo 形象作者：甶丶。其余来源与署名见 [NOTICE.md](NOTICE.md) 和 [资料来源](world/_资料来源.md)，许可见 [LICENSE](LICENSE)。版本变化见 [CHANGELOG.md](CHANGELOG.md)。

### 余额、费用与单价 / Account queries and prices

Kujira 设置中的「账户与模型单价」按当前 **provider/model 接入**配置，不按 AI 娘名字猜账户。普通余额适配可复用 DSH 的 API Key 设置；组织管理、云账单或套餐查询需要独立凭据引用（环境变量名），不要把明文 Key 填入 Kujira。云账单余额属于整个云账户，不等于当前模型余额。

支持 DeepSeek、OpenAI/Anthropic 组织费用与用量、xAI 团队、Mistral 企业预算、Moonshot 中国、OpenRouter、GLM Coding、MiniMax Token Plan，以及另配云凭据的阿里云/腾讯云/火山云只读查询。不同接入可查询的项目不同；没有支持的接口、权限不足、暂时失败与余额为零会分开处理。MiniMax 现金余额、MiMo、Gemini 等尚无本版本已验证的通用余额适配，仍可配置手动参考单价；未知代理不会自动把凭据发给官方站点。DeepSeek-compatible 代理需显式选择且只查询已配置的同源地址。

模型单价可按当前接入/模型保存每百万 token 的输入、输出及缓存参考费率；OpenRouter 可读取精确模型 ID 的价格目录。手动参考价不是实际账单，整段会话可能混用模型，因此不会简单拿当前模型价格乘会话总 token。余额、消费金额、token 用量和套餐/预算额度是不同项目。

In **Account & model pricing**, settings apply to the selected provider/model, not the character. Normal key-based balance adapters can reuse DSH credentials. Admin, management, cloud-billing and plan queries require explicit credential references, never plaintext keys in Kujira. Available capabilities vary by provider. A cloud-account balance, monthly billed usage, token count, plan quota and budget remainder are distinct. Unsupported, permission-needed and failed queries are not shown as zero. Unknown proxies never send credentials to a guessed official endpoint; DeepSeek-compatible proxies require explicit same-origin opt-in.

Manual per-million-token rates are reference prices, not actual bills. OpenRouter additionally exposes exact-model catalog pricing. Kujira does not multiply a current-model price by a whole session's potentially mixed-model token total. This release's automated adapter tests use synthetic credentials; real-account connectivity depends on the user's endpoint, account and permissions.

逐项查验：[用例步骤、预期、实际结果与公开证据](docs/testing/CASEBOOK.md)。
