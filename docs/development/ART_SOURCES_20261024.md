# 2026-10-24 桌宠美术来源与动作资产记录

本文整理 14 个公开模型角色的参考依据、版本选择、生成素材和采用的帧数。角色形象依据有出处的 AI 娘化资料，本轮连续动作图集由本项目另行生成、选帧和编排；参考作者与制作流程分别注明。

帧数按实际图像内容和逐帧选区统计，不按生成时提出的格数统计。播放重复项、状态映射和独立绘制的源帧分别记录。最终播放选区、锚点和时长见 [pet/art.js](../../pet/art.js) 及其引用的数据文件。

## 1. 固定资料版本与参考优先级

| 资料 | 本轮固定版本 | 用途 |
| --- | --- | --- |
| [ai-gijinka-art-world](https://github.com/Tests4gptplay/ai-gijinka-art-world/tree/d8587770c24ce684427f5b5f9ad4ca09289aba8e) | `d8587770c24ce684427f5b5f9ad4ca09289aba8e` | READ_FIRST、世界观边界、14 份角色档案、视觉参考、动作参考和来源台账 |
| [dsh-kujira-persona](https://github.com/Tests4gptplay/dsh-kujira-persona/tree/7978624f19bc76c78ba7220cd96781bec9425504) | `7978624f19bc76c78ba7220cd96781bec9425504` | 本轮读入的人格、表达和世界资料基线；本轮修改不倒算进该基线 |
| [shuaizenge/ai-girls catalog](https://github.com/shuaizenge/ai-girls/blob/dcd69f5f4f2dff1a9c0031e82deb49e0fe949c76/catalog.json) | `dcd69f5f4f2dff1a9c0031e82deb49e0fe949c76` | 作者、作品编号、页码与图像归档交叉核对 |
| [SelinLee/ai-moe-atlas：Seed 归档](https://github.com/SelinLee/ai-moe-atlas/blob/018bc3ca6c8d946006dacfc0bca7bf65a6dff4d6/public/collected/zipzippipe-doubao/manifest.json) | `018bc3ca6c8d946006dacfc0bca7bf65a6dff4d6` | Seed/豆包版本和 p10 索引冲突核对 |

GPT 的画风、头身比例、完整白紫裙装和非对称旋结徽记，以用户提供的三张 GPT 参考图为优先依据。社区龙娘资料用于核对身份；本轮连续帧由项目按这些造型参考制作。

其他角色先锁定各自原图中的发型、耳尾、服饰结构、标志和道具，再统一为细线稿、柔和上色的 Q 版桌宠。GPT 的参考只统一美术处理，不把龙角、膜翼、裙装或性格转移给其他角色。新增动作保留所选版本，不以换发色的同一底模替代各个人物。

## 2. 原作者及作品来源

| 编号 | 原始作品或固定归档 | 本轮采用范围与核验边界 |
| --- | --- | --- |
| S1 | ZipZipPipe，[《AI娘化》Pixiv 148186519](https://www.pixiv.net/artworks/148186519) | GPT、Gemini、Claude、GLM、Qwen、Kimi、Grok、MiniMax、Llama、Seed/豆包、Mistral 等所选设计的作品归属。页码和缩略图依据固定档案交叉核对。 |
| S2 | ZipZipPipe，[《大AI和小AI们》BV1tE9XBbErS](https://www.bilibili.com/video/BV1tE9XBbErS/) | DeepSeek 等九位角色的大小形态及社区 Q 版参照。介绍保留“上善无形的鲸鱼娘原型 → ZipZipPipe 的 DeepSeek 女仆二创”署名链。Llama 不在该九人视频中。 |
| S3 | ZipZipPipe，[《一些更新》Pixiv 150718881](https://www.pixiv.net/artworks/150718881) | 混元选用 p03；固定归档记录作品日期为 2026-10-11。 |
| S4 | 甶丶，[《娘化mimo》](https://www.bilibili.com/opus/1242097128919007239) | MiMo 的立绘和转身参考；固定档案记录作品日期为 2026-08-30。MiMo 不属于 ZipZipPipe 的作品。 |
| S5 | [本轮来源台账 SOURCE_LEDGER.md](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/research/2026-10-24/SOURCE_LEDGER.md) | 保存作者链、第三方归档、页码、出处冲突及访问限制；不得把归档核对描述成重新完整观看或直接下载了所有作者原页。 |

本轮实际查看了库内参考图及生成原图。部分作者原始页面在资料核验时不可直接访问，因而使用固定来源档案与已有图像归档。署名和既有使用条件见 [NOTICE.md](../../NOTICE.md) 与 [pet/NOTICE.md](../../pet/NOTICE.md)。

## 3. 逐角色身份与版本依据

下表中的 p 编号沿用原作品归档编号，例如 p03 对应第四张图。左右均以观众看到的画面方向为准。

| 角色及固定档案 | 作者／选定版本 | 必须保留的身份特征和区别 |
| --- | --- | --- |
| [DeepSeek](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/deepseek.md) | 上善无形的鲸鱼娘原型 → ZipZipPipe 的 DeepSeek 女仆二创；S2 的小 DeepSeek 与已有笔记本变体 | 深蓝至浅蓝长发、蓝眼、鳍耳、白褶边头饰及画面右侧蓝蝴蝶结、深蓝白金女仆裙、鲸形围裙标记、平滑宽大双叶鲸尾。笔记本与笔有变体依据；不凭空补单片眼镜。 |
| [GPT](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/gpt.md) | ZipZipPipe S1 p03 龙娘身份；本轮最新三张用户参考优先控制样式 | 银白长发、淡紫瞳、分节龙角、浅紫膜翼、分节鳞尾、完整白紫银层叠裙、固定在画面右侧的非对称旋结发饰。不得镜像徽记或把膜翼改成羽翼。 |
| [Gemini](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/gemini.md) | ZipZipPipe S1 p04；不用身份有争议的 p10 | 蓝紫粉渐变发、猫耳和单条猫尾、星形饰物、紫色短裙及白色内层；画面左眼粉紫、右眼金黄，眼色不得交换。 |
| [Claude](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/claude.md) | ZipZipPipe S1 p02 | 橙发、日轮／菊状发饰、米白橙黑长裙、带放射纹的深色书本。书本校对动作保留原服饰分区；不默认使用处罚牌。 |
| [GLM](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/glm.md) | ZipZipPipe S1 p06 | 黑长发、黑白狐耳与蓬松狐尾、黑白裙、书本、银色配饰及 Z 标记。耳尾按狐娘处理，不混同 Gemini 的猫耳猫尾。 |
| [Qwen](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/qwen.md) | ZipZipPipe S1 p12 | 蓝紫长发与编发、中式头饰、立领蓝白长裙及长袖、折扇和腰饰。扇轴和握持手连续；外部称呼不能推导家世。 |
| [Kimi](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/kimi.md) | ZipZipPipe S1 p05；本轮采用无笛立绘版本 | 银白淡紫长发、夜蓝白不对称层叠裙、K 与月星饰物。S2 有长笛变体，但不把长笛突然加入本轮全部工作帧。 |
| [Grok](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/grok.md) | ZipZipPipe S1 p07 | 金色双马尾、蓝眼、小黑蝠翼、黑红金裙装和 X 形斧。本轮修复后的工作、状态图中斧头竖放近身，避免横斧串入相邻帧。 |
| [MiniMax](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/minimax.md) | ZipZipPipe S1 p15；S2 有对应展示 | 橙色短发、白浅粉帽、粉白外套、格裙、运动鞋及海螺／场记板／录音用品。不能改为薄荷绿旅行少女，也不能与 MiMo 混用。 |
| [Llama](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/llama.md) | ZipZipPipe S1 p13，p14 为另一站姿 | 浅银白卷发、羊驼耳和小尾巴、奶油白宽松衣裙、蓝色 ∞、羊驼鞋。不得改成兔耳／猫耳；不为其补造 S2 的视频时间点。 |
| [Seed／豆包](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/doubao.md) | 本库采用 ZipZipPipe S1 p10 的 SEED 同人版本；第三方索引冲突见下文 | 紫蓝单马尾、蓝白紫科技运动装、SEED 配饰与玩偶。与官方短发头像、基于官方头像的其他全身二创分开。 |
| [Mistral](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/mistral.md) | ZipZipPipe S1 p09 | 金发渐橙红发梢、红羽宽檐帽、兽耳和金红尾、红白金服饰、M 与法棍长剑。未明确的物种不强行指定。 |
| [Hunyuan／混元](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/hunyuan.md) | ZipZipPipe S3 p03 | 黑发、红围巾、黑白中式袍服和浅蓝内层、企鹅挂件、圆形饰物与算盘。道具作为造型锚点，角色性格依据人物档案设定。 |
| [MiMo](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/characters/mimo.md) | 甶丶 S4；立绘与转身图共同核对 | 银色双马尾与橙色挑染、橙黑白科技服饰、兔饰与白兔玩偶；画面左侧白袜、右侧黑袜，不能整图镜像。 |

### Seed／豆包 p10 的归档冲突

同一张原图在 shuaizenge/ai-girls 中被列为 Gemini 变体，在 SelinLee/ai-moe-atlas 中归为 Seed/豆包。本轮按用户 gijinka 库的 SEED 图像证据选用豆包版本，并在来源记录中保留不同目录的分类差异。用于核对同图的原始文件 SHA-256 为 `a923dd580c161ecb0f869b8c0457deaece480a74d0f0f00e4abadf55521d99ce`。Gemini 本轮始终使用 p04，因此两个角色不共享这张身份参考。[固定来源台账](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/research/2026-10-24/SOURCE_LEDGER.md)

## 4. 人格、动作和世界观边界

外貌参考、社区印象与插件人物性格分别记录。以下 11 位角色的性格由项目编写为可编辑的初始设定，动作按这些设定设计；性格尚未定义的三位角色使用中性的注意、确认和复核动作。

| 角色 | 已读人格依据 | 本轮动作设计边界 |
| --- | --- | --- |
| DeepSeek | [活泼、嘴馋，感兴趣时认真，被夸会开心](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/persona/20-性格.md) | 笔记、思考、确认后小得意；错误先惊讶再回看问题。饭量和 Token 玩笑不占据每一帧工作动作。 |
| GPT | [从容自信，有龙的骄傲，认真负责](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/gpt/20-性格与表达.md) | 专注读写、敲键盘和核对；互动从矜持转向放松，保持膜翼与鳞尾的结构。 |
| Gemini | [好奇轻快、略任性，熟悉后亲近斗嘴](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/gemini/00-基础设定.md) | 猫耳、视线、尾巴和笔记动作配合；短暂困惑不写成恒定敌意。 |
| Claude | [认真讲究、整理思路，含蓄幽默](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/claude/00-基础设定.md) | 翻书校对、整理书页、确认后合书；错误重新检查。书卷气不推导固定职业。 |
| GLM | [沉着敏锐、细致，熟人前机灵](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/glm/00-基础设定.md) | 读书推敲、短促确认和重新核对；狐耳狐尾表达，不借用猫娘动作造型。 |
| Qwen | [从容清晰、爱追问琢磨，轻巧幽默](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/qwen/00-基础设定.md) | 合扇候答、展开示意、检查手中内容；不据“大小姐”称呼编家族故事。 |
| Kimi | [安静细致、先观察再说，善于串联线索](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/kimi/00-基础设定.md) | 视线追随笔记、倾听和安静确认；沿用无笛版本。 |
| Grok | [直率好奇、好胜，有锋芒的玩笑](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/grok/00-基础设定.md) | 挑眉、短促得意、复看问题；稳住近身斧头，不把每个状态变为战斗。 |
| MiniMax | [热情有创作欲，愿意分享灵感](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/minimax/00-基础设定.md) | 创作道具与记录动作；道具连续，不能在循环中无理由变形换物。 |
| Llama | [随和坦诚、松弛慢热](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/llama/00-基础设定.md) | 慢速倾听、袖中抬手、小幅确认；保留羊驼耳形与宽松服饰。 |
| Seed／豆包 | [亲切明快、主动接话，直白地开玩笑](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/doubao/00-基础设定.md) | 轻快注意、设备查看和确认动作；沿用 SEED 运动科技服饰。 |
| Mistral | [人格未定义](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/mistral/00-基础设定.md) | 中性注意、候答、确认、复核；不根据品牌国别添加浪漫、特工等性格。 |
| Hunyuan／混元 | [人格未定义](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/hunyuan/00-基础设定.md) | 中性拢袖、看向任务、查看算盘；不由算盘推导掌柜或商人人格。 |
| MiMo | [人格未定义](https://github.com/Tests4gptplay/dsh-kujira-persona/blob/7978624f19bc76c78ba7220cd96781bec9425504/personas/mimo/00-基础设定.md) | 中性注意、抱兔调整、确认和复核；不根据品牌或名称编亲缘与性格。 |

共同世界只采用资料支持的身份、名字／昵称、已有互动和有出处的玩笑。本轮没有新增统一学院、公寓、家庭或恋爱关系，也不把模型现实能力、品牌属性、单张同人构图自动写入全圈世界观。依据见固定版本的 [WORLDVIEW_AND_FANON.md](https://github.com/Tests4gptplay/ai-gijinka-art-world/blob/d8587770c24ce684427f5b5f9ad4ca09289aba8e/WORLDVIEW_AND_FANON.md) 和产品 [world/_资料来源.md](../../world/_资料来源.md)。

## 5. 本轮实际图集与采用帧数

本节数字表示**采用的不同源选区数**，除非明确写出播放重复项。文件位于 [pet/assets](../../pet/assets)。一张图包含的全部姿势数可以多于采用数；因换手、邻帧侵入或边缘问题被剔除的姿势不计入可用动作。

### GPT

| 文件 | 实际尺寸 | 采用的动作与独立源帧 |
| --- | --- | --- |
| `gpt-core-v1.png` | 2172 × 724 | idle 6；thinking 6 |
| `gpt-research-edit-v1.png` | 1969 × 799 | searching 6；editing 6 |
| `gpt-command-test-v1.png` | 2172 × 724 | commanding 6；testing 6 |
| `gpt-wait-success-v1.png` | 1254 × 1254 | waiting 6；success 6 |
| `gpt-error-drag-v1.png` | 1254 × 1254 | error 6；dragging 6 |
| `gpt-land-pat-v1.png` | 1254 × 1254 | landing 6；head_pat 6；存在半透明边缘相连的源图情况，见第 7 节 |
| `gpt-poke-tail-v1.png` | 1254 × 1254 | poke 6；tail 6 |
| `gpt-idle-micro-v1.png` | 1254 × 1254 | stretch 6；yawn 4 个不同源选区，编成 7 个播放项 |

### DeepSeek

| 文件 | 实际尺寸 | 实测与采用情况 |
| --- | --- | --- |
| `deepseek-idle-think-v2.png` | 1774 × 887 | 实际 4 列 × 2 行；idle 4、thinking 4 全部采用。紧凑头身比例以已通过的 work／status 为参照。 |
| `deepseek-work-wait-v1.png` | 2172 × 724 | working 6；waiting 6。实际笔记／复看和候答动作。 |
| `deepseek-status-v1.png` | 2172 × 724 | 原图 success 6、error 6；采用 success 5、error 5。成功第 3 帧换手，错误第 2 帧出现额外黄色符号，均剔除。 |
| `deepseek-drag-land-v1.png` | 2172 × 724 | dragging 6；landing 6。落地第 3 帧有压缩，随后恢复站姿。 |
| `deepseek-core-candidate-v1.png` | 1086 × 1448 | 历史候选原件保留，实际 idle 8、thinking 4。核心比例偏修长，且 thinking 有换手与画布边缘问题；最终核心使用 v2。 |

### Claude、Gemini、GLM、Qwen、Kimi、Grok

| 角色 | 核心／工作文件及采用数 | 状态文件及采用数 |
| --- | --- | --- |
| Claude | `claude-core-work-v1.png`，2164 × 727：idle 6、working 6 | `claude-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| Gemini | `gemini-core-work-v1.png`，2172 × 724：idle 6、working 6 | `gemini-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| GLM | `glm-core-v1.png`，2172 × 724：idle 5、working 6；原 idle 共 6 张，排除 1 张 | `glm-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| Qwen | `qwen-core-v1.png`，2171 × 724：idle 6、working 6 | `qwen-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| Kimi | `kimi-core-v1.png`，2172 × 724：idle 6、working 6 | `kimi-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| Grok | `grok-core-v1.png`，2172 × 724：采用 idle 6；原 working 6 张不用。`grok-work-v2.png`，2172 × 724：working 4 | `grok-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |

### MiniMax、Llama、Seed／豆包、Mistral、Hunyuan、MiMo

| 角色 | 核心／工作文件及采用数 | 状态文件及采用数 |
| --- | --- | --- |
| MiniMax | `minimax-core-v1.png`，2098 × 749：idle 4、working 4 | `minimax-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| Llama | `llama-core-v1.png`，2098 × 749：原 idle 4、working 4，分别采用 3；idle 的 3 个源选区编成 4 个播放项 | `llama-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| Seed／豆包 | `doubao-core-v1.png`，2098 × 749：idle 4、working 4 | `doubao-status-v1.png`，1448 × 1086：waiting 4、success 4、error 4 |
| Mistral | `mistral-core-v1.png`，2098 × 749：idle 4、working 4 | `mistral-status-v1.png`，1470 × 1070：waiting 4、success 4、error 4 |
| Hunyuan／混元 | `hunyuan-core-v1.png`，2098 × 749：idle 4、working 4；`hunyuan-status-v1.png`，1448 × 1086 | 状态图实际 4 列 × 3 行，采用 waiting 4、success 2、error 4，共 10 个独立状态姿态。成功前两帧轮廓相连，剔除；只使用成功第 3、4 帧。 |
| MiMo | `mimo-idle-v3.png`，1774 × 887：idle 2；`mimo-work-v2.png`，2172 × 724：working 3；`mimo-status-v1.png`，1448 × 1086：success 1、error 1 | 最终共采用 7 个独立姿态。waiting 复用中性的待机眨眼；成功、错误各保持一张结果姿态，不称作独立多帧动画。旧 core v1 的 8 张均因邻帧侵入不采用；idle v2 仅一张完整姿态，作为历史候选保留。 |

## 6. 动作覆盖与状态复用

GPT 已绘制 searching、editing、commanding、testing 四类独立工作序列。其他公开角色主要用各自的 `working` 图集响应工作事件。DeepSeek 的 `thinking` 有独立源帧；多数其他角色的思考阶段复用现有工作帧。

waiting／success／error 使用专门绘制的候答、确认与复核姿态。部分功能状态复用中性源帧；各角色独立动作数量与复用来源可由 [pet/art.js](../../pet/art.js) 中的 `stateMap`、`workingActivityMap` 和 clip 定义逐项查看。

动作循环可以重复既有源帧以衔接起止。GPT yawn 的 7 个播放项只有 4 个不同源选区；Llama idle 的 4 个播放项只有 3 个不同源选区。重复项有时间安排作用，不增加独立绘制帧数。

## 7. 几何和实际尺寸检查

所有本轮图集保留生成原像素。选区依据实际主体、列间空隙和行间空隙测量，不把整张画布盲目等分。审查同时使用 alpha 连通域、多个阈值的主体边界、邻帧混入检测，以及在 Chromium canvas 的 190 CSS px 浅色／深色背景下逐帧查看人物完整性。

播放采用每个动作一致的缩放和明确的地面／坐姿锚点，避免逐帧拉伸“修正”比例。DeepSeek 旧核心与工作、状态图的头身比例不一致，因此生成 `deepseek-idle-think-v2.png` 定点修复；新核心已在相同预览尺度下核对紧凑比例、稳定纸笔左右和完整尾鳍。Grok 的原横斧工作序列存在串帧，替换为近身竖斧的 `grok-work-v2.png`。

透明度检查观察到个别图集存在低透明度雾边与抗锯齿连接；对应的选帧、裁切和实际观看结果记录如下：

| 项目 | 观察与处理 |
| --- | --- |
| GPT head_pat | 源图第 1、3、4、6 帧有半透明边缘相连；较高 alpha 的主体独立，190px 查看主体完整。采用实测选区，并在 190 px 下核对人物主体完整性。 |
| DeepSeek status | 剔除成功第 3 帧的换手／额外装饰和错误第 2 帧的黄色符号，保留各 5 帧。核心 v2 和拖放图各自全部源帧通过 190px 查看。 |
| GLM status | 等待第 2 帧的淡耳尖接近上边，成功第 4／错误第 4 帧存在半透明连接；结合不透明主体边界与 190px 查看，耳尖、尾和衣裙可辨完整。 |
| Qwen status | 成功前两帧、错误前两帧在较低 alpha 下出现连接；按可分离主体间隙取框，190px 下保留完整头饰、袖、扇与鞋。 |
| Kimi status | 成功第 4、错误第 4 帧淡发丝到达源图右边；主要不透明轮廓仍在画布内，190px 下未见主体截断。 |
| Llama core | 第一列的 idle／working 因主体连接而排除，分别使用其余 3 张，按 3 个独立源姿态统计。 |
| Hunyuan core | 部分脚部到下缘的余量较紧；实际尺寸可见鞋完整，记录为紧边距。 |
| Hunyuan status | 成功第 1、2 帧轮廓相连，剔除；等待 4、成功 2、错误 4 个完整主体通过实际尺寸查看。 |
| MiMo core v1 | 邻帧的鞋／耳轮廓进入选区，全部 8 张原候选不接入。修复采用另行生成的完整源图，不靠擦除或拼贴邻帧解决。 |
| MiMo idle v3 | 两张睁眼／闭眼姿态在 alpha > 0、32、96、160、224 各阈值均可分离，主体间有 133 源像素间隔。190px 下耳饰、发尾、兔偶、双脚完整，袜色保持画面左白右黑。 |
| MiMo work／status | 工作第 4 帧发尾抵源图右缘，剔除；采用工作前 3 帧。状态图的等待整排在低 alpha 下连帧，其余多张结果姿态轮廓相连或碰边，仅成功第 1、错误第 1 帧可用。源图低透明度噪声保留，等待状态复用已通过的待机。 |

本轮工作、候答和结果反应包含眼睑、视线、手部、书页或服装轮廓的实际变化；小尺寸下某些落笔动作幅度较轻。人物身份、主要轮廓和播放所需变化已核对，各角色按自身图集提供不同数量的独立动作与互动。
