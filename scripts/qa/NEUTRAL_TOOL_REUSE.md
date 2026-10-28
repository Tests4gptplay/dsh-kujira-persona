# 未知工具工作姿态复用

未知工具仍处于working。13个角色采用已审命令动作的最后停手姿态，单帧非循环，沿用AnimationPlayer末帧保持；无需新增定时器或状态引擎。

|角色|末帧内容|绑定|
|---|---|---|
|DeepSeek|持电脑，停手看设备|neutral_tool|
|MiniMax|持已闭合场记板，看监视器|neutral_tool|
|Claude|双手停于文稿处理台边|neutral_tool|
|Kimi|停手观察书卷处理器|neutral_tool|
|Gemini|手离启动处，观察台面|neutral_tool|
|Qwen|双手停在设备外侧|neutral_tool|
|GLM|持任务板，停止点选|neutral_tool|
|Llama|双手台边静置，半睁眼向下观察|neutral_tool|
|Hunyuan|双手收回，站于模型台旁|neutral_tool|
|MiMo|持设备停手，观察工作台|neutral_tool|
|Mistral|手收回，观察工作台|neutral_tool|
|Grok|持资料板停手，观察任务|neutral_tool|
|Doubao|手离开触发位置，持板观察|neutral_tool|

每个neutral_tool.frames[0]等于同角色authored_commanding.frames最后一项，时长沿用该末帧。测试验证首次显示即为停手姿态，并在60秒后仍保持该姿态。

Stella使用新绘authored_working：专注工作面，包含短眨眼的3姿态循环，同时作为generic working与using-tool。GPT沿用中性idle。
