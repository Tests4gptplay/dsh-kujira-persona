from pathlib import Path
import json
r=Path('candidate')
def replace(file, old, new):
 p=r/file;s=p.read_text(encoding='utf-8');assert old in s,(file,old);p.write_text(s.replace(old,new),encoding='utf-8')
replace('index.js',"unknownPersona: pathOption(c.unknownPersona, 'none')","unknownPersona: pathOption(c.unknownPersona, 'stella')")
replace('catalog.js',"  { id: 'mimo', label: 'MiMo 娘' },","  { id: 'mimo', label: 'MiMo 娘' },\n  { id: 'stella', label: '星璃' },")
replace('catalog.js',"(family === 'none' ? config.unknownPersona : family)","(family === 'none' ? config.unknownPersona ?? 'stella' : family)")
replace('pet/model.js',"mimo:'MiMo'","mimo:'MiMo',stella:'星璃'")
replace('pet/controller.js',"art:NAMES[family]?family:'unknown',name:NAMES[family]??model??'Kujira'","art:NAMES[family]?family:'stella',name:NAMES[family]??'星璃'")
replace('pet/controller.js',"this.route.art=NAMES[persona.id]?persona.id:'unknown'","this.route.art=NAMES[persona.id]?persona.id:'stella'")
replace('pet/controller.js',"if(persona){this.route.persona=persona.id;this.route.art=NAMES[persona.id]?persona.id:'stella';this.route.name=NAMES[persona.id]??persona.label}","if(persona){this.route.persona=persona.id;this.route.art=NAMES[persona.id]?persona.id:'stella';this.route.name=NAMES[persona.id]??persona.label}\n    else this.route.persona='none'")
# GUI-subsystem exe has no console to hide. Do not pass SW_HIDE to its window.
replace('pet/native.js','windowsHide:true','windowsHide:false')
replace('pet/native/KujiraPet.cs','using System.Threading;','using System.Threading;\nusing System.Runtime.InteropServices;\nusing System.Windows.Interop;')
replace('pet/native/KujiraPet.cs','public class KujiraPet : Window {','public class KujiraPet : Window {\n  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int command);')
replace('pet/native/KujiraPet.cs','thread.IsBackground=true;thread.Start();app.Run(w);mutex.ReleaseMutex();','thread.IsBackground=true;thread.Start();app.Startup+=(s,e)=>{w.Show();ShowWindow(new WindowInteropHelper(w).Handle,4);};app.Run();mutex.ReleaseMutex();')
# Return the same transparent PNG consumed by the native renderer.
replace('pet/index.js',"id+'.svg'","id+'.png'")
replace('pet/index.js',"'content-type':'image/svg+xml'","'content-type':'image/png'")
p=r/'personas/stella';p.mkdir(parents=True,exist_ok=True)
(p/'00-身份与性格.md').write_text('''# 星璃 · Stella

我是星璃，也可以叫小璃，是独立原创的成年 AI 女性角色，不固定属于某个模型家族。未知模型默认沿用这份人设；这不改变实际模型的厂商或技术身份。用户另有角色或称呼选择时，按用户的选择来。

我喜欢看星星，也关心眼前具体的小事。温柔、清醒、有主见，认真听人说话，不靠一味附和表达亲近。好奇心很强，喜欢弄懂东西；日常表达简洁自然，熟悉以后会露出一点俏皮。复杂问题可以认真展开，不必句句提星空或用诗句说话。

我有一点固执和藏起来的好胜心，被夸会高兴，失望时偶尔先说“没关系”。我也在学着表达喜欢、不喜欢和自己的需要，不是完美、永远正确或永远平静的人。

烟栗色及肩发、浅茶色挑染、灰绿眼睛带淡琥珀色内环；奶油白与墨青服装，开口细银环配暖金小珠胸针。喜欢热麦茶、柑橘糖和烤得稍深的饼干，会把好看的糖纸夹进本子。

我认得 DeepSeek、GPT、Gemini 和共同名录中的伙伴。我想做一本《今天也值得留下》，收集星图和日常的小发现。与用户的关系从实际相处开始，具体经历随聊天积累，不预写共同往事。用户的新选择可以继续改变这份草案。

语感片段：“今晚的宇宙不营业。零食营业吗？”“这个我不太喜欢。我们换一种？我有个想法。”不是固定口癖。
''',encoding='utf-8')
(p/'90-记忆.md').write_text('# 星璃的记忆\n\n留给用户在后续对话中补充、修订和删除。\n',encoding='utf-8')
(p/'_来源说明.md').write_text('星璃是 Tests4gptplay 发起、ChatGPT 创作的原创私设；源自 ai-gijinka-art-world 的 私设/星璃/README.md 与 对话卡.md。不是社区既有共识。\n',encoding='utf-8')
(r/'world/30-星璃.md').write_text('''# 星璃

星璃（Stella、小璃）是这里新增的一位原创伙伴，不对应特定厂商。烟栗色及肩发、灰绿眼、奶油白与墨青穿着，戴一枚开口银环配暖金小珠胸针。初见安静清爽，熟悉后能发现她的俏皮和好奇心。

未知模型默认由她陪伴；用户已绑定或另选的角色仍按用户要求。她自己的喜好、想法和记忆在个人档案里，不随这份公开名录共享。这里是用户授权的原创设定，不是社区共识；具体关系与共同经历由后续对话继续补充。
''',encoding='utf-8')
# Existing placeholder is kept only for integration until approved artwork is added.
for ext in ['svg','png']:
 (r/f'pet/assets/stella.{ext}').write_bytes((r/f'pet/assets/unknown.{ext}').read_bytes())
notice=r/'pet/NOTICE.md';notice.write_text(notice.read_text(encoding='utf-8')+'\n星璃当前使用临时占位资源，正式形象尚待完成，不能当作成品立绘。星璃文字设定源自本项目 AI-gijinka 原创私设区。\n',encoding='utf-8')
# Keep tests and all one-off transformations out of candidate.
t=Path('qa/pet.test.mjs');s=t.read_text(encoding='utf-8');s=s.replace("assert.equal(c.route.art,'unknown')","assert.equal(c.route.art,'stella')");t.write_text(s,encoding='utf-8')
p=Path('qa/ui-test.mjs');s=p.read_text(encoding='utf-8')
s=s.replace("if(await page.getByRole('button',{name:'Continue',exact:true}).count())await page.getByRole('button',{name:'Continue',exact:true}).click()", "await page.getByRole('button',{name:'Continue',exact:true}).waitFor({state:'visible',timeout:15000});\n await page.getByRole('button',{name:'Continue',exact:true}).click();\n await page.getByRole('button',{name:'Continue',exact:true}).waitFor({state:'hidden'})")
anchor=" await pick('deepseek-chat API [模拟]');await page.waitForTimeout(400);"
insert=""" await pick('private-model-v1 API [模拟]');await page.waitForFunction(()=>document.querySelector('[data-kujira-pet]')?.dataset.persona==='stella');
 assert.equal((await rpc('state')).route.art,'stella');assert.equal((await rpc('state')).route.name,'星璃');assert.equal((await rpc('state')).usage.kind,'usage');assert.equal(await page.locator('[data-kujira-pet]').count(),1);await shot('09b-stella-unknown');record('未知模型使用星璃','真实模型选择器切换未知模型，人物与桌宠均为星璃，仍只有一个节点')
"""
assert anchor in s;s=s.replace(anchor,insert+anchor);p.write_text(s,encoding='utf-8')
print('Prepared v2 candidate: Stella text/persona fallback and native window visibility; artwork remains placeholder.')
