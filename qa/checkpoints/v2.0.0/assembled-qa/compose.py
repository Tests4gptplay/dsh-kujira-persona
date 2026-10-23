from pathlib import Path
import shutil,json
root=Path.cwd();target=root/'candidate';pet=target/'pet';pet.mkdir(exist_ok=True)
for p in (root/'qa/pet-source').glob('*.js'):shutil.copy2(p,pet/p.name)
p=pet/'index.js';s=p.read_text().replace("ctx.inject(['sessions','connection']","ctx.inject(['sessions','connection','webServer']");p.write_text(s)
p=target/'index.js';s=p.read_text();s=s.replace("import { openCatalog } from './catalog.js'","import { openCatalog } from './catalog.js'\nimport { applyPet } from './pet/index.js'").replace('  const catalog = openCatalog(config)','  const catalog = openCatalog(config)\n  applyPet(ctx, { catalog, home: HOME })');p.write_text(s)
p=target/'package.json';o=json.loads(p.read_text());o['version']='1.7.0-alpha.1';o['exports']['./client']='./pet/client.js';o['dsh']['client']={'platform':'web','inject':['@deepseek-ai/dsh-client-ui-plugin-manager','@deepseek-ai/dsh-client-ui-model-selection']};o['files']+=['pet/*.js','pet/assets/*.svg','pet/assets/*.png','pet/native/win-x64/KujiraPet.exe','pet/NOTICE.md'];p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
(pet/'NOTICE.md').write_text('''# 桌宠图形与参考\n\n透明底 Q 版矢量草图为本项目原创绘制，SVG 为源图，PNG 为同图转换；不是图像生成模型输出，没有复制上游动画帧。\n\n角色识别母题沿用本项目 AI-gijinka 图鉴的署名链：DeepSeek 原型上善无形，ZipZipPipe 等角色外形整理，MiMo 外形参考甶丶；详见根目录 NOTICE.md。\n\n功能交互参考 QCYTSN/dsh-dafeiyu，代码自行实现，没有带入其 Helper、测试或图片。Codex 套餐复用 DSH Codex Native 已有只读账户接口。\n''')
