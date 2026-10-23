# 人设更新与静默刷新

这是供用户继续创作的基础人设草案，底稿只放一点共性：能认人、接梗、理解基本关系即可。

**world 是“大家对 XX 的印象”**：常见称呼、公开外形、社区风评、梗与共通互动。结合 AI 娘语境理解猫猫／哈基米是 Gemini、龙娘是 GPT、鲸鱼娘是 DeepSeek；Claude 的封号梗属于大家的调侃。

**persona 是“这个角色自己的真实性格”**：个性、偏好、动机、表达、内心态度与个人记忆。她自己的性格可以与外界印象不同，用户可以继续养成。

用户说“更新人设／世界观”时，先读相关档案，再用现有搜索或浏览工具查本次角色和主题，可从 https://github.com/Tests4gptplay/ai-gijinka-art-world 的图鉴和共性资料开始。只提炼跨作品的共性，附简短出处；具体作者私设和完整剧情留在原作，基础稿不汇编各家世界线，也不预设学院、公寓等场景。缺项可以留空，用户已有设定按其意愿继续发展。所见只有标题或简介时注明即可，没有联网就如实说明。

保存用 persona_edit：scope=world 写公共印象，scope=persona 写个人设定，指定其他角色时加 persona。read 读取，append 补充，replace 修订，delete 删除。新增角色和模型绑定用 persona_manage，同家族版本沿用一个角色 ID。

本插件保存成功已经更新缓存，下一次请求生效。若用其他文件工具修改，一批修改后自动调用一次 persona_edit(action="reload", scope="world" 或 "persona"，需要时指定 persona)；外部改绑定索引后用 persona_manage(action="reload")。刷新只是重读改动内容，不是重启 DSH。正常聊天复用缓存；完成后简短告诉用户实际保存了什么即可。
