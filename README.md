# Kujira · AI 娘人设

**随 DSH 中选用的模型切换角色，在对话中继续养成自己的世界与人物。**

## 世界观与人物

**世界观**是大家共用的称呼、社区印象、梗和人物关系，让角色认识彼此。比如与 DeepSeek 鲸鱼娘聊天时，她也知道“猫猫”通常指 Gemini、“龙娘”指 GPT。故事发生在哪里、角色如何相处，都可以由你继续设定。

**人物**是每个角色自己的性格、喜好和记忆。切换模型家族时切换角色；同一家族的不同版本默认共用一个角色和已有记忆。已有多种 AI 娘基础预设，没有预设的模型也可以自行添加角色。

默认自称使用 DeepSeek、GPT、GLM 等模型家族名称，平时自然说“我”。白龙、鲸鱼、猫猫等保留为形象和别称，不会要求角色用“XX娘”介绍自己。你另起名字或使用自定义角色时，就按你选定的称呼来。

预设只是起点。称呼、性格、关系和模型对应的角色都能改；与你的要求不同，就按你的来。

## 扩充和修改，直接在 DSH 聊天框里说

补充世界观、修改人物性格、创建原创角色、给自定义模型指定角色，都可以通过对话让 AI 完成，不必手动编辑文件。例如：

> 把龙娘的语气改得活泼一点，保存到她的人设里。

> 把“龙娘和猫猫每周五一起做甜点”补进大家共同知道的设定。

> 创建一个叫星璃的角色，她喜欢看星星，说话温柔但简洁，让当前模型用这个角色。

之后还可以继续修改她的名字、性格和故事，或让其他模型也使用同一角色。通过对话保存后，后续聊天就会使用更新的设定，无须另外刷新或重启。

这里添加的是角色和模型之间的对应关系；尚未接入 DSH 的模型，先在 DSH 的模型设置中接入。

## 安装和升级

DSH Desktop：打开 **插件 → 添加插件**，输入当前发行版：

```text
github:Tests4gptplay/dsh-kujira-persona#v1.6.2
```

安装、启用后重启 DSH 一次。已有旧版时，先在插件列表卸载旧包，再安装新版。**保留 `.dsh/world`、`.dsh/persona`、`.dsh/personas` 中的设定与记忆。**你已经修改过的档案不会被新版预设覆盖，可以通过对话选择如何补充新内容。无需 npm 账号。

Web 版安装命令：

```bash
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v1.6.2'
```

Web 与 Desktop 分别安装。[GitHub Releases](https://github.com/Tests4gptplay/dsh-kujira-persona/releases) 也提供备用 `.tgz` 安装包。

### Windows 安装提示 EPERM

若出现 `dsh-kujira-persona_tmp_* -> dsh-kujira-persona` 重命名失败：取消安装，完全退出 DSH（含托盘），打开 `%USERPROFILE%\.dsh\profiles\desktop\node_modules`，只清理本插件失败安装的临时目录和确认损坏的半安装项，再重新安装。正常目录不需要删除；目录链接只处理链接本身。

保留其他插件、profile 配置，以及上述人设和记忆目录，无需删除整个 `node_modules`、`package.json` 或 `pnpm-lock.yaml`。仍有问题可在 [Issues](https://github.com/Tests4gptplay/dsh-kujira-persona/issues) 附上脱敏错误日志。

## 来源与更新记录

本插件是非官方同人项目。基础资料来自 [AI-gijinka 资料库](https://github.com/Tests4gptplay/ai-gijinka-art-world) 与社区作品的共性整理，人物和世界观都可以继续改写。

DeepSeek 形象署名链：上善无形 → ZipZipPipe；MiMo 形象作者：甶丶。其余来源与署名见 [NOTICE.md](NOTICE.md) 和 [资料来源](world/_资料来源.md)，许可见 [LICENSE](LICENSE)。版本变化见 [CHANGELOG.md](CHANGELOG.md)。
