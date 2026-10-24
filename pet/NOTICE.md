# 桌宠图形与参考

早期透明底 Q 版矢量草图保留为加载失败时的备用图；对应同名 SVG / PNG 为代码联调用图。

`*-v1.png` 等多帧图集是本轮依据用户参考与图鉴制作的 AI 生成候选美术。它们不是原作者的连续帧，也不表示已经取得用户的最终美术验收。GPT 以用户提供的三张 Q 版图为主要造型与画风约束；其他角色分别核对自身参考，不以 GPT 换色代替。

动画通过测量原图中的实际角色区域确定裁切、锚点、尺寸和时间线。图集布局可能与生成提示中的格数不同；只接入实际存在且通过检查的帧。没有把超出画布的姿态当作完整帧。功能状态共用中性动作的情况记在 manifest 的 `fallbackSources` 中，不宣称每个状态都有独立绘制。

角色识别母题沿用本项目 AI-gijinka 图鉴的署名链：DeepSeek 原型上善无形，ZipZipPipe 等角色外形整理，MiMo 外形参考甶丶；详见根目录 NOTICE.md。

功能交互参考 [QCYTSN/dsh-dafeiyu](https://github.com/QCYTSN/dsh-dafeiyu)；活动分类和问题工具识别的适配代码来自该项目（2026 QCYTSN，MIT），完整许可保留在 dsh-dafeiyu-LICENSE.txt。动作优先级参考其 docs/animation-behavior.md 和 runtime/animation_model.py；没有带入其 Helper 或成品图片。Codex 套餐继续复用 DSH Codex Native 已有只读账户接口。

本轮角色依据固定到 `ai-gijinka-art-world` 的 `d8587770c24ce684427f5b5f9ad4ca09289aba8e`。第三方角色设计的来源与使用条件仍依根目录 NOTICE.md 分别保留；生成新的表现形式不改变原角色的权利条件。

当前分支仍是开发候选。功能联调通过、源图几何检查、实际尺寸视觉检查和用户最终美术验收是不同的状态，不相互替代。

