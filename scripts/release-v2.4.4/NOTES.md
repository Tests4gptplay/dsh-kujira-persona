## 更小的桌宠安装包 / Smaller desktop pet package

144 张桌宠动画图集改用 256 色 PNG。安装包约 **41 MB**，比 2.4.3 小约 **79%**，保留原有动作、帧数、尺寸和透明背景。

Kujira now uses indexed PNG for all 144 desktop pet sprite sheets. The installation package is about **41 MB**, roughly **79% smaller** than 2.4.3. The existing animations, frame counts, dimensions, and transparent backgrounds are retained.

## 安装与升级 / Install & upgrade

DSH Desktop：打开 **插件 → 添加插件**，在 **包名或地址** 填入：

```text
github:Tests4gptplay/dsh-kujira-persona#v2.4.4
```

安装或升级前，先关闭已显示的桌宠和提示气泡。也可以把下方的 [安装包下载地址](https://github.com/Tests4gptplay/dsh-kujira-persona/releases/download/v2.4.4/dsh-kujira-persona-2.4.4.tgz) 填到同一入口。npm 安装沿用现有包名：`dsh-kujira-persona@2.4.4` 或 `@tests4gptplay/dsh-kujira-persona@2.4.4`。

In DSH Desktop, close visible pets and bubbles before installing or updating, then enter the GitHub source above in **Plugins → Add Plugin**. For npm upgrades, keep the package name you already use.

Web：

```sh
dsh plugin --profile web add 'github:Tests4gptplay/dsh-kujira-persona#v2.4.4'
```
