# dsh-kujira-persona

> 选 DeepSeek，是鲸鱼娘；选 GPT，是白龙娘。各自的设定与记忆都留在文件里。

![hero](assets/hero.svg)

**v1.4.0** 是一个轻量的 DeepSeek Harness 人设插件：按当前会话的模型选择加载人设 Markdown；用户与 AI 后续编辑的内容按角色保存。保留原包名 `dsh-kujira-persona` 和插件 ID `whale-persona`，不需要 npm 账号。

## 模型与人设

| 实际模型/路由 | 默认人设 |
| --- | --- |
| `deepseek-*`，或官方 `deepseek-official` / `deepseek-account` / `deepseek-messages` 路由 | DeepSeek 鲸鱼娘 |
| `gpt-*`、`chatgpt-*`、`o1` / `o3` 等 o 系列模型 ID | GPT 白龙娘 |
| `codex-local` 路由 | GPT 白龙娘，与 GPT 共用角色档案 |
| 未识别的模型 | 不添加本插件的人设；可用 `modelRules` 自行绑定 |

也识别 `openai/gpt-...` 这样的带命名空间模型 ID。**OpenAI-compatible 协议不等于 GPT 模型**，因此不会仅因提供方叫 `openai` 或 `openai-compatible` 就把未知模型套成龙娘。自定义中转模型名使用显式规则。

切换发生在**下一次提示词组装/模型请求**，不修改已经发出的请求，不清除聊天历史，也不改模型、工具、技能、权限、上下文阈值或超时。并发会话分别读取自己的模型选择；同一角色在多个会话中共享该角色的长期档案。

目前内置这两个角色。GPT 文字预设依据本项目的 [AI 娘资料库](https://github.com/Tests4gptplay/ai-gijinka-art-world)，性格与表达标明为插件原创默认值，不冒充原作者统一正史。见 [NOTICE.md](NOTICE.md)。

## 安装与升级

### 官方桌面应用（推荐）

打开 **插件 → 添加插件**，只输入下面这一行：

```text
github:Tests4gptplay/dsh-kujira-persona#v1.4.0
```

安装完成后按提示启用，**重启 DSH 一次**。选择模型并发一条消息，再输入 `/persona` 查看本会话的人设、目录与模型。

不需要注册 npm，不需要配置桌面版 CLI。上面是 GitHub 包标识，不是尚待上架的 npm 包名。

从 v1.3.1 升级：在插件列表卸载旧安装，再添加 v1.4.0、启用并重启；保留 `.dsh/persona` 中全部人设与记忆。包名和插件 ID 不变，不要同时安装同一插件的多个副本。旧目录不会被移动、删除或复制给 GPT。

### Web 版 CLI

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v1.4.0'
```

`web` 与桌面应用的 `desktop` 是不同的 profile。不要拿 Web 安装命令来判断桌面应用是否已安装。

### GitHub Release 备用包

[GitHub Releases](https://github.com/Tests4gptplay/dsh-kujira-persona/releases) 提供 npm 格式 `.tgz` 安装包；这是 GitHub 托管的附件，不是 npm Registry 发布。包内已包含运行入口和人设文字，不需要编译，也没有安装时执行的 build/prepare/postinstall 脚本。

### Windows 安装失败：`ERR_PNPM_EPERM`

若出现：

```text
EPERM: operation not permitted, rename
...dsh-kujira-persona_tmp_XXXXX_X -> ...dsh-kujira-persona
```

这是临时安装目录重命名被 Windows 拒绝，可能涉及旧目录残留或进程占用；`peer dependencies` 警告不能单独证明是此次失败原因。

1. 取消失败的安装，**完全退出 DSH Desktop**，确保安装任务也已结束。
2. 按 **Win + R** 打开 `%USERPROFILE%\.dsh\profiles\desktop\node_modules`。
3. 只清理失败安装留下的 `dsh-kujira-persona_tmp_*`，以及确认损坏/半安装的 `dsh-kujira-persona`。若已正常运行，不要删除正常目录。遇到目录链接，仅处理该链接项，不进入链接目标清理文件。
4. 重新打开 DSH，按上述 GitHub 标识安装、启用并重启，用 `/persona` 检查。

**不要删除**整个 `node_modules`、`.dsh`、`profiles/desktop`、`package.json`、`pnpm-lock.yaml` 或其他插件。尤其要保留 `%USERPROFILE%\.dsh\persona` 和 `%USERPROFILE%\.dsh\personas`，其中有人设与记忆。仍报错时检查目标文件占用或目录权限，不要关闭系统防护或批量结束陌生进程；可在 [Issues](https://github.com/Tests4gptplay/dsh-kujira-persona/issues) 提交脱敏日志。

## 人设与学习文件放在哪里

```text
~/.dsh/
├── persona/                  # 原版鲸鱼娘，原位保留
│   ├── 00-身份.md
│   ├── ...
│   └── 90-记忆.md
└── personas/
    └── gpt/                  # GPT 白龙娘的独立档案
        ├── 00-身份.md
        ├── 10-外观.md
        ├── 20-性格与表达.md
        ├── 70-学习规则.md
        └── 90-记忆.md
```

设置了 `DSH_HOME` 时使用该目录替代 `~/.dsh`。旧配置的 `personaDir`、`memoryFile`、`extraText` 继续只作用于鲸鱼娘；`personasDir` 指定新增角色的根目录。

每个角色首次使用时，将对应内置 Markdown 铺到自己的目录。只读取直接位于该目录的 `.md`，按文件名排序；以 `_` 或 `.` 开头的文件不注入，子目录不递归读取。改动下一次请求生效，无需重装。

**学习不是训练模型权重。** 它是把设定与记忆写入本机 Markdown，并在后续请求中加载。鲸鱼娘学到的内容不会自动进入龙娘；切回对应模型继续读取对应档案。聊天历史仍然保留，角色目录隔离不是历史清除。

## 命令与 AI 编辑

| 命令 | 作用 |
| --- | --- |
| `/persona` | 查看本会话选中的模型、人设与目录 |
| `/persona files` | 查看将注入的文件 |
| `/persona show` | 查看人设全文 |
| `/persona sync` | 仅同步当前角色的包内更新 |
| `/persona list` | 查看内置角色 ID |
| `/remember 一句话` | 给当前选中模型对应的角色追加一条记忆 |

刚创建会话、尚未发出请求且没有明确选中模型时，状态可能显示尚未请求；发送一条消息后即可准确显示。

AI 的 `persona_edit` 支持 `append` / `replace` / `delete` / `list`。`append` 的 `category` 可用 `character`、`world`、`meme`、`memory`，也可给当前角色目录内的 `.md` 文件名。`replace` 使用唯一匹配的 `oldText` 和 `newText`；`delete` 带 `oldText` 删除片段，不带则删除文件。

**写入归属跟随发起工具调用的模型请求**，不是点击切换后的待用模型。比如鲸鱼娘正在输出、你已把下一步切为 GPT，鲸鱼娘本轮的工具写入仍归鲸鱼娘。人工 `/remember` 则作用于当前选择、准备下一步使用的角色。

不希望 AI 编辑时设置 `allowAgentWrite: false`；人工 `/remember` 仍可用。插件不会主动联网搜索或自动学习，只有用户编辑、人工命令或模型实际调用工具时才写入。

文件写入由 DSH Host 的 Node 进程执行，受操作系统账户权限约束，不是提权能力。保留原有文件名限制与单文件滚动备份；备份是尽力而为，不是完整版本历史。

## 升级同步

每个角色有自己的 `.kujira-state.json`。缺失的默认文件会补齐；仍与上次内置版本一致的文件可更新；用户修改过的文件保留。`persona_edit` 明确删除的内置文件记录为已删除，不会在下次同步重新生成。直接在文件管理器删除默认文件时，后续同步仍可能按缺失文件补齐。

原版鲸鱼娘默认资料保持不变；升级不会挪动或重置你原来的目录。`sync: false` 关闭覆盖式同步；`seed: false` 关闭缺失默认文件的铺设。

## 配置

在 DSH 的本插件配置中设置下列字段；使用 profile patch 时按现有 `id: whale-persona` 条目修改 `config`，不要覆盖整个 profile。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 插件总开关 |
| `mode` | `auto` | `auto` 随模型切换；`fixed` 固定角色 |
| `persona` | `deepseek` | 固定模式选择 `deepseek` / `gpt` / `none` |
| `unknownPersona` | `none` | 无匹配模型时是否指定一个默认角色 |
| `modelRules` | `[]` | 显式路由映射，按顺序首先匹配 |
| `personaDir` | `~/.dsh/persona` | 旧版鲸鱼娘目录 |
| `memoryFile` | `<personaDir>/90-记忆.md` | 旧版鲸鱼娘记忆文件 |
| `personasDir` | `~/.dsh/personas` | 新角色目录根路径，GPT 位于其下 `gpt/` |
| `sharedDir` | 空 | 可选的共享用户偏好目录，只读取，不自动写入 |
| `allowAgentWrite` | `true` | 注册本插件的 AI 编辑工具 |
| `seed` / `sync` | `true` | 默认文件铺设 / 升级同步 |
| `extraText` | 空 | 旧版鲸鱼娘的额外文字，不自动共享给 GPT |

中转站自定义模型名示例：

```yaml
config:
  mode: auto
  modelRules:
    - provider: my-gateway
      model: private-gpt-*
      persona: gpt
    - model: my-deepseek-alias
      persona: deepseek
```

`provider` 与 `model` 支持 `*` 通配符，其他字符按字面匹配，匹配时不区分大小写；省略的一项不限制。显式规则先于内置规则。需要某个模型不加载人设时映射为 `none`。

固定沿用鲸鱼娘：

```yaml
config:
  mode: fixed
  persona: deepseek
```

共享偏好须显式设置 `sharedDir`。不要把旧鲸鱼娘目录当共享目录，否则会主动把鲸鱼娘设定带入其他角色。

## 运行边界

运行包只有人设路由、文件读取/编辑/同步，以及原有插件元数据与文字资源。没有后台巡检、轮询、watchdog、自动重试循环、额外技能/工具拦截、账号探测或子进程。没有新增运行依赖，也没有安装构建脚本。

实现使用 DSH 的 `system-prompt/assemble` 扩展点，在宿主确定本次模型选择后替换本插件自己的 `whale:persona` 段。其余提示词段、工具表、上下文与历史原样交还宿主。测试与验证脚本只保存在独立 QA 分支和临时环境，不进入主线或安装包。

兼容目标：DSH `0.2.1-rc.2`。内核集成、干净安装与桌面应用真实交互是不同的验证层级；发布说明分别列出已验证范围。

## 许可与署名

本仓库原有许可 **CC BY-NC-SA 4.0** 不变，非官方同人项目。DeepSeek 角色署名链保留 **上善无形 → ZipZipPipe**；GPT 视觉母题署名 **ZipZipPipe**，本插件新增的文字性格为原创默认设定。第三方角色设计权利不因本仓库许可而被重新授权，详见 [NOTICE.md](NOTICE.md)。

## 更新记录

见 [CHANGELOG.md](CHANGELOG.md)。
