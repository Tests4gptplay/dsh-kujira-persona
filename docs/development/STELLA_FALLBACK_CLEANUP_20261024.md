# Kujira 2.0.0 · 星璃默认回退与旧素材清理

日期：2026-10-24。分支：`feat/v2.0.0-single-model-pet`。

## 行为

- 初始无模型、取消选择、未识别模型家族、映射为空时，桌宠显示星璃。
- 已识别的模型家族继续使用各自角色；用户显式绑定优先，自定义人物的名称保留。
- 自定义人物暂未提供专属桌宠动画时，使用星璃的逐帧素材。
- Web 使用真实 PNG 图集画布，Windows 使用相同图集的原生逐帧协议。

## 从当前开发分支清理

- 删除 `pet/assets/<role>.png` 15 张旧静态人物图。
- 删除 `pet/assets/<role>.svg` 15 张旧人物矢量图。
- 删除 `pet/assets/unknown.png` 和 `pet/assets/unknown.svg`。
- 废弃旧静态图片接口，打包白名单移除旧素材路径。
- 保留 15 个角色动画 manifest 所引用的 40 张 PNG 图集。
- `ai-gijinka-art-world` 中的角色参考、作者资料和星璃原创形象保持原样。

## 已完成检查

- Node.js: 8 组自动选角输入、初始与取消选择、显式绑定覆盖、解绑返回星璃、自定义角色身份保留。
- Node.js: 原生桌宠发送未知角色时采用 `stella-core-v1.png` 逐帧图，不发旧 `unknown.png`。
- Chromium: 使用当前 `AnimationPlayer` 和 `SpriteCanvas` 绘制星璃待机、工作状态，实际画布有可见像素，0 条页面脚本错误。
- 角色资产：15 个 manifest 引用 40 张有效生产图集。
- npm pack: 120 个运行文件，与源码逐文件匹配；包内 40 张图集、0 张旧 SVG、0 张旧静态角色 PNG、0 个 QA 文件。
- QA 中路由、原生协议、manifest、离线试玩的旧静态回退断言已同步更新。

## 测试交付

- `Kujira_v2_Stella_Clean_20261024.tgz`：83,731,892 bytes；SHA256 `52706eb9739b8d0ac0cfc6a5e7957cd0b7d57ee49a9bb8ec6143f20d1d01dc22`。
- `Kujira_v2_Stella_Clean_Playable_20261024.zip`：83,567,098 bytes；SHA256 `0ef68dbbc6bf50ddfc2d515823fe3f2f0d01d943f388751cba4d0ffacef94bf2`。
- 旧候选压缩包保留历史文件名供追溯；测试和更新以本轮新候选为准。

测试环境：独立 Node.js 与 Chromium 浏览器组件验证；原有真实 DSH 联动结果见 `REMOTE_DSH_QA_20261024.json`。本次没有写入已安装的用户 DSH profile。正式 main、Release 和市场版本保持原状态。
