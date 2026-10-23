from pathlib import Path
import os,json,base64,hashlib,urllib.request,subprocess,tarfile,re,shutil,html,zipfile
REPO='Tests4gptplay/dsh-kujira-persona'
BASE='55611ec683902edad5873c21f9196a1f500d8790'
BRANCH='qa/v2-code-completion-20261023'
RUN=int(os.environ['TEST_RUN'])
TOKEN=os.environ['GH_TOKEN']
def api(path,data=None,method=None):
 raw=None if data is None else json.dumps(data).encode()
 req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,data=raw,method=method or ('GET' if data is None else 'POST'),headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'})
 with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
def load(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def put(p,s):Path(p).parent.mkdir(parents=True,exist_ok=True);Path(p).write_text(s,encoding='utf-8',newline='\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def gitsha(b):return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
run=api(f'actions/runs/{RUN}');assert run['conclusion']=='success',run['conclusion']
ui=load('input/web/ui-result.json');native=load('input/windows/evidence/native-result.json');bridge=load('input/windows/evidence/native-bridge.json');layout=load('input/windows/evidence/native-layout.json')
assert ui['ok'] and native['ok'] and bridge['ok'] and layout['ok']
assert all(c['status']=='pass' for c in ui['cases'])
unit=Path('input/unit/unit-final.txt').read_text();assert '# fail 0' in unit
count=int(re.search(r'# tests (\d+)',unit).group(1))
parity=load('input/web/stats-parity.json')
root=Path('candidate');win=Path('input/windows/candidate/pet/native')
assert (root/'pet/native/KujiraPet.cs').read_bytes()==(win/'KujiraPet.cs').read_bytes(),'Native source differs'
shutil.copyfile(win/'win-x64/KujiraPet.exe',root/'pet/native/win-x64/KujiraPet.exe')
assert api('git/ref/heads/feat/v2.0.0-single-model-pet')['object']['sha']==BASE,'Feature branch changed; inspect before publishing'
report_url=f'https://github.com/{REPO}/blob/{BRANCH}/qa/V2_CODE_REPORT.md'
headline=f'> **2.0.0 功能候选，未发布。** 本轮 {count} 项单测、{len(ui["cases"])} 项真实 DSH Web 场景及 Windows 原生窗口/生命周期检查通过。模型回复和账户额度为隔离模拟；当前美术全部为未验收占位。详见 [截图测试报告]({report_url})。下文 v1.6.2 地址仍是正式稳定版。'
p=root/'README.md';s=p.read_text(encoding='utf-8');s=headline+'\n\n'+s.split('\n\n',1)[1]
section='''## 2.0.0 可选桌宠（开发候选）

桌宠默认关闭，在插件详情页打开“启用桌宠”。始终显示一只：切换模型时替换人物形象，同家族不同版本沿用一个角色。未知模型默认使用原创角色星璃；用户明确指定的角色优先。通过对话修改模型绑定后，桌宠立即跟随，无须再切换一次模型。

设置支持页面内／Windows 桌面显示、角色与气泡大小、活动程度、减少动态、完成／出错提示音，以及位置重置。桌面位置与页面位置分别保存。关闭桌宠不关闭原有世界观、人设与对话修改功能。

工作气泡分别显示任务阶段、轮次与步骤、生成速度、累计 Token、缓存命中和上下文占用，可独立关闭工作统计。上下文百分比不是任务完成率，也不是套餐余量；数据来自 DSH 已有统计，不额外扫描日志。

DeepSeek 按实际 API Key／账户接入显示余额；`codex-local` 复用 Codex Native 的套餐查询接口。普通 GPT API 不会被当作 Codex 套餐，其他没有余额接口的接入显示未提供。可选择每分钟、每五分钟或只在切换模型／任务结束／手动操作时刷新；临时查询失败会保留并标明上次结果。

**当前图片仅用于功能联调，不是最终美术。** 本轮未验证真实账户数值、完整 Windows Electron Host、跨多屏/DPI或长期运行；不把这些隔离测试当作全面兼容保证。源码和安装包不带测试驱动、模拟服务或开发验证脚本。

'''
assert '## 安装和升级' in s;s=s.replace('## 安装和升级',section+'## 安装和升级',1);put(p,s)
p=root/'CHANGELOG.md';s=p.read_text(encoding='utf-8');marker='## 1.6.2';assert marker in s
put(p,'# 更新记录\n\n## 2.0.0（功能候选，未发布）\n\n- 新增可选的单只模型联动桌宠、设置页、Windows 原生显示和页面显示。\n- 未知模型默认星璃；保留用户角色、显式绑定和独立记忆，对话改绑定后即时联动。\n- 显示 DSH 工作统计，与 DeepSeek 余额／Codex Native 套餐分开。\n- 补齐窗口内容布局、位置保存、刷新设置和重复网络故障时的上次结果。\n- 美术仍为占位，待用户另行讨论；未发布、未更新市场。\n- 测试、截图与模拟仅在 QA；报告：'+report_url+'\n\n'+marker+s.split(marker,1)[1])
for lang in ['zh','en']:
 p=root/f'locale/{lang}.json';v=json.loads(p.read_text(encoding='utf-8'))
 v['meta']['description']=('随 DSH 中选用的模型切换 AI 角色；未知模型默认使用星璃，也可以自己指定。\n\n【世界观】大家共用的称呼、印象、梗和人物关系。\n【人物】各自的性格、喜好和记忆；同家族不同版本延续同一角色。\n\n补充世界观、修改人设、创建角色或指定模型对应角色，直接在 DSH 聊天框里告诉 AI。\n\n【可选桌宠】在本页设置中开启，始终只有一只，随模型换形象，显示工作状态、统计和可用的余额／套餐信息。关闭桌宠不影响人设功能。\n\n预设只是起点；与你的要求不同，就按你的来。' if lang=='zh' else 'Characters follow your selected DSH model. Unrecognized models use Stella by default; your own character choices take precedence.\n\nWORLD: Shared names, impressions, jokes and relationships.\nCHARACTERS: Individual personalities, preferences and memories. Versions in one family share a character.\n\nAdd lore, edit personas, create characters or assign a model by talking to the AI in DSH chat.\n\nOPTIONAL PET: Enable one model-linked companion in the settings below to display work status, statistics and available balance or plan information. Turning it off does not disable personas.\n\nPresets are only a starting point. Your choices come first.')
 put(p,json.dumps(v,ensure_ascii=False,indent=2)+'\n')
p=root/'package.json';manifest=json.loads(p.read_text());manifest['description']='DSH 人设与可选单只桌宠：模型联动、共享世界观、独立记忆与对话扩充';put(p,json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
status=f'''# 2.0.0 功能代码收尾

功能候选已通过本轮隔离检查；不是发布或美术验收。

- 未知模型默认星璃，实际模型身份不被更名；已有用户角色和明确绑定优先。
- 对话创建／修改／解除绑定通过原有工具保存，桌宠随目录变更即时更新，不额外轮询。
- 页面／Windows 原生单只桌宠，开关、大小、气泡、减少动态、声音、位置与刷新设置。
- DSH 工作统计、DeepSeek 余额、Codex Native 套餐分区显示；没有数据时不伪造。
- Windows 显示程序由同一候选的 C# 源码编译并测试，已替换旧二进制。

本轮：{count} 项单测、{len(ui['cases'])} 项 Web 场景通过；原生窗口、缩放文本范围、单窗口、跨模型同进程、关闭与快速重开通过。
测试运行：https://github.com/{REPO}/actions/runs/{RUN}
图文证据：{report_url}

限定：假额度／模拟推理，真实 DSH、真实工具与文件、真实 Windows WPF 窗口；不是各品牌模型自主表现或真实账户账单验收，也未覆盖完整 Electron Host、多屏 DPI 或长期运行。

用户要求先完成代码，美术以后单独讨论。全部现有图片仍是未验收占位；星璃沿用占位，不宣称完成其最终立绘。测试和模拟不进入产品主线或安装包；主线、正式版本和市场不改。
'''
put(root/'docs/development/V2_CODE_STATUS.md',status)
p=root/'docs/development/V2_HANDOFF.md';s=p.read_text(encoding='utf-8');put(p,'# 最新接续状态\n\n先看 [功能收尾状态](V2_CODE_STATUS.md) 与 [图文报告]('+report_url+')。用户已恢复开发，并要求先完成代码、之后讨论美术。以下是保留的历史检查点，旧的暂停指令和旧失败不代表当前状态。\n\n---\n\n'+s)
# Build the final candidate using the exact tested native binary, then inspect the package outside runtime.
Path('delivery').mkdir(exist_ok=True)
packed=json.loads(subprocess.check_output(['npm','pack','./candidate','--ignore-scripts','--json','--pack-destination','delivery'],text=True))[0]
tgz=Path('delivery')/packed['filename']
with tarfile.open(tgz) as t:
 names=t.getnames();assert not any(any(x in n for x in ['/qa/','/.github/','/tests/','/scripts/','/docs/development/']) for n in names)
 pkg=json.load(t.extractfile('package/package.json'));assert pkg['version']=='2.0.0' and not pkg.get('scripts') and not pkg.get('dependencies') and not pkg.get('devDependencies')
 assert t.extractfile('package/pet/native/win-x64/KujiraPet.exe').read()==(win/'win-x64/KujiraPet.exe').read_bytes()
 assert 'package/personas/stella/00-基础设定.md' in names and 'package/pet/stats.js' in names
facts={'version':'2.0.0','status':'development-candidate-not-release','test_run':RUN,'unit_tests':count,'web_cases':len(ui['cases']),'package_files':len(names),'package_size':tgz.stat().st_size,'sha256':sha(tgz.read_bytes()),'native_sha256':sha((win/'win-x64/KujiraPet.exe').read_bytes()),'qa_files':0,'runtime_dependencies':0,'install_scripts':0,'artwork':'unapproved-placeholders'}
put('delivery/package-facts.json',json.dumps(facts,ensure_ascii=False,indent=2)+'\n')
base_tree=api('git/commits/'+BASE)['tree']['sha'];old={x['path']:x['sha'] for x in api('git/trees/'+base_tree+'?recursive=1')['tree'] if x['type']=='blob'}
allowed={'index.js','catalog.js','pet/model.js','pet/controller.js','pet/index.js','pet/client.js','pet/native/KujiraPet.cs','pet/native/win-x64/KujiraPet.exe','pet/NOTICE.md','pet/assets/stella.svg','pet/assets/stella.png','personas/stella/00-基础设定.md','personas/stella/90-记忆.md','personas/stella/_来源说明.md','world/12-星璃.md','docs/development/V2_CODE_STATUS.md','docs/development/V2_HANDOFF.md','README.md','CHANGELOG.md','package.json','locale/zh.json','locale/en.json'}
changed={}
for f in root.rglob('*'):
 if not f.is_file() or '.git' in f.parts:continue
 name=f.relative_to(root).as_posix();b=f.read_bytes()
 if old.get(name)!=gitsha(b):assert name in allowed,name;changed[name]=b
def make_commit(parent,changes,message):
 tree=api('git/commits/'+parent)['tree']['sha'];entries=[]
 for name,b in changes.items():
  obj=api('git/blobs',{'content':base64.b64encode(b).decode(),'encoding':'base64'});assert obj['sha']==gitsha(b)
  entries.append({'path':name,'mode':'100644','type':'blob','sha':obj['sha']})
 tree=api('git/trees',{'base_tree':tree,'tree':entries})['sha']
 return api('git/commits',{'message':message,'tree':tree,'parents':[parent]})['sha']
product=make_commit(BASE,changed,'feat(v2): complete Stella fallback, live pet bindings, settings and tested native helper')
# Preserve selected original evidence without credentials or complete request streams.
report_dir=Path('qa/reports/v2-code-'+str(RUN));report_dir.mkdir(parents=True,exist_ok=True)
for source,sub,names in [(Path('input/web'),'web',['ui-result.json','stats-parity.json','stella-prompt-check.json','install.log']), (Path('input/windows/evidence'),'windows',['native-result.json','native-bridge.json','native-layout.json','native-stats-text.txt'])]:
 for f in list(source.glob('*.png'))+[source/n for n in names]:
  if f.exists():dest=report_dir/sub/f.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,dest)
put(report_dir/'unit-final.txt',unit);put(report_dir/'package-facts.json',json.dumps(facts,ensure_ascii=False,indent=2)+'\n')
images=sorted(report_dir.rglob('*.png'))
md=f'''# Kujira 2.0.0 功能代码与截图测试报告

本轮完成代码候选，**没有验收美术，没有发布或更新市场**。全部截图是实际执行画面，图片仍为占位。

源码：[{product}](https://github.com/{REPO}/commit/{product})；基线 `{BASE}`。
运行：[GitHub Actions {RUN}](https://github.com/{REPO}/actions/runs/{RUN})。

## 结果

{count} 项单测通过；{len(ui['cases'])} 项真实 DSH Web 场景通过；Windows 实际窗口、统计文本、放大气泡边界、同一窗口换模型、单实例、关闭与快速重开均通过。页面异常 {len(ui['pageErrors'])} 项，控制台异常 {len(ui['consoleErrors'])} 项。保存 {len(images)} 张截图。

| 场景 | 结果与范围 |
|---|---|
'''
for c in ui['cases']:md+='| '+c['name']+' | '+c['detail'].replace('|','／')+'；'+c['status']+' |\n'
md+='''
## 数据与验收边界

模型回复与余额／套餐为 QA 模拟。真实的是 DSH 安装与界面、模型选择器、read/persona_manage 工具执行、文件持久化、提示词组装和 Windows WPF 程序。截图中的速度由模拟响应计算，不能用于模型性能比较；额度不是用户的真实余额。

未知模型的真实请求已含星璃档案；修改／解除绑定后桌宠无须切换模型就更新。既有用户自定义星璃记录、明确 none 选项和其他显式绑定优先。

工作统计直接取 DSH 的已有投影。上下文占用不是任务完成度、不是套餐剩余量。读数对照如下：

```json
'''+json.dumps(parity,ensure_ascii=False,indent=2)+'\n```\n\n'
md+='''## Windows 与安装包

Windows 运行的是本候选 C# 源码直接编译的显示程序，放大后通过 UI Automation 检查统计文字处于窗口内。窗口按气泡高度伸缩，保持角色下缘位置；原始结果中 positionStable 对应本轮脚本的角色右下锚点检查，不表示窗口顶边不变。截屏是独立窗口捕获，不等于用户真实多屏桌面的合成效果。

没有在用户本机安装，没有使用真实账户；完整 Electron Host、多屏/DPI、长期运行仍不在本轮范围。当前美术明确未通过，留待用户之后讨论。

包清单：

```json
'''+json.dumps(facts,ensure_ascii=False,indent=2)+'\n```\n\n'
md+='''## 本轮修正与历史记录

本轮补上未知模型默认星璃、绑定变化即时通知、位置保存与重置、可选刷新频率、重复查询失败时保留最后结果，以及气泡高度适配。没有把 QA、模拟服务或验证脚本加入运行包。

之前工作统计复测第一次在 Windows QA 中文编码处失败；后续已修复测试脚本，成功运行 39972559844。更早的 Preview Notice 阻塞和固定等待导致的窗口检查失败，保留在旧 QA 分支。本报告只陈述本轮结果，不抹去旧失败。

## 截图

'''
labels={'11-real-dsh-stats':'工作统计与真实 DSH 底栏对照','12-unknown-stella':'未知模型使用星璃（占位图）','13-stella-prompt':'新会话的星璃档案实际进入请求','14-live-binding':'真实工具绑定后立即换角色','15-unbind-stella':'解除绑定后恢复星璃','16-settings-final':'完整设置、刷新与位置重置','native-stella-large':'Windows 放大气泡与统计文字边界'}
for f in images:
 label=labels.get(f.stem,f.stem);rel=f.relative_to(Path('qa')).as_posix();md+=f'### {label}\n\n![{label}]({rel})\n\n'
put('qa/V2_CODE_REPORT.md',md)
summary={'status':'checks-passed-feature-ref-update-pending','source_base':BASE,'product_commit':product,'feature_branch':'feat/v2.0.0-single-model-pet','test_run':RUN,'unit_tests':count,'web_cases':len(ui['cases']),'screenshots':len(images),'report':report_url,'modified_product_paths':sorted(changed),'package':facts,'not_done':['artwork acceptance','real-account verification','full Electron Host / multi-monitor / long-running acceptance','release and market update']}
put('qa/V2_CODE_DELIVERY.json',json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
qa_changes={f.as_posix():f.read_bytes() for f in report_dir.rglob('*') if f.is_file()}
qa_changes.update({p:Path(p).read_bytes() for p in ['qa/V2_CODE_REPORT.md','qa/V2_CODE_DELIVERY.json']})
qa_parent=api('git/ref/heads/'+BRANCH)['object']['sha'];qa_commit=make_commit(qa_parent,qa_changes,'qa(v2): archive real screenshots and code-completion evidence')
api('git/refs/heads/'+BRANCH,{'sha':qa_commit,'force':False},'PATCH')
# A portable report contains the original images, not generated substitutes.
body='<h1>Kujira 2.0.0 功能测试</h1><p>美术未验收；模拟额度与推理，真实 DSH 与原生窗口。</p><pre>'+html.escape(md.split('## 截图')[0])+'</pre>'
for f in images:body+='<h2>'+html.escape(labels.get(f.stem,f.stem))+'</h2><img style="max-width:100%;height:auto" src="data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode()+'">'
put('delivery/Kujira_v2_功能截图报告.html','<!doctype html><html lang="zh"><meta charset="utf-8"><title>Kujira v2 功能测试</title><style>body{max-width:1120px;margin:36px auto;padding:0 20px;font:16px/1.7 system-ui}pre{white-space:pre-wrap}img{border:1px solid #ddd}</style><body>'+body+'</body></html>')
shutil.copyfile('qa/V2_CODE_DELIVERY.json','delivery/code-candidate.json')
with zipfile.ZipFile('delivery/Kujira_v2_代码与截图报告.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write('delivery/Kujira_v2_功能截图报告.html','Kujira_v2_功能截图报告.html')
 z.write('qa/V2_CODE_REPORT.md','qa/V2_CODE_REPORT.md')
 for f in report_dir.rglob('*'):
  if f.is_file():z.write(f,f.as_posix())
print(json.dumps(summary,ensure_ascii=False))
