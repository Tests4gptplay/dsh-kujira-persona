# 桌宠图形、动画与来源

## 图形与播放

多帧 PNG 图集依据角色参考图与 AI-gijinka 图鉴，通过 AI 生成与整理。GPT 以三张 Q 版图为主要造型与画风参考；其他角色分别沿用自身的外形、服饰和配件。桌宠加载与未知模型回退均使用星璃和各角色的当前逐帧图集；旧版静态矢量形象已移除。

动画通过原图中的角色区域确定裁切、锚点、尺寸和时间线。Web 与 Windows 共用逐帧播放器，普通动作采用单层逐帧播放，状态改变时即时切换。安装包及从源码构建的离线试玩使用当前图集。

各角色使用待机、工作、等待和结果动作表现任务过程。部分功能阶段共用中性动作；性格尚未明确的角色采用标准功能动作。触摸与拖放反应由各角色的动作片段提供，可在离线试玩中体验。

离线试玩可直接体验角色动作与任务阶段；在 DSH 中启用插件后，桌宠随实际任务过程联动。

## 来源与许可

角色资料固定于 `ai-gijinka-art-world` 的快照 [`d858777`](https://github.com/Tests4gptplay/ai-gijinka-art-world/tree/d8587770c24ce684427f5b5f9ad4ca09289aba8e)。角色识别母题沿用图鉴的署名链：DeepSeek 原型上善无形，ZipZipPipe 等角色外形整理，MiMo 外形参考甶丶。各角色的详细出处与使用条件见根目录 [NOTICE.md](../NOTICE.md)。

活动分类和问题工具识别的适配代码来自 [QCYTSN/dsh-dafeiyu](https://github.com/QCYTSN/dsh-dafeiyu)（2026 QCYTSN，MIT），动作优先级参考其 `docs/animation-behavior.md` 和 `runtime/animation_model.py`。相关代码保留原 MIT 许可，全文见 [dsh-dafeiyu-LICENSE.txt](dsh-dafeiyu-LICENSE.txt)。

项目内容适用根目录 [LICENSE](../LICENSE) 的范围，第三方角色设计与参考作品分别保留原作者的署名和使用条件。
