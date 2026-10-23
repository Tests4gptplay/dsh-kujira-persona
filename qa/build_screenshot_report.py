from pathlib import Path
import base64
import hashlib
import html
import json
import re

ROOT = Path('report')
SOURCE = 'c5e633637689fe26254860dce862b41e4f1e068a'
RUN = '39930320166'

def load(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))

def result(number):
    value = load(f'result-{number:04d}.json')
    if not value.get('ok'):
        raise RuntimeError(f'Required observation {number} failed: {value.get("error")}')
    return value['result']

r = {n: result(n) for n in [1,3,4,5,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24,25,29]}
checks = {
    '实际图形界面安装完成': r[4]['guiInstallationCompleted'],
    '实际启用且组件运行': r[5]['enabledInGUI'],
    '中文说明包含两层结构与对话扩充': r[29]['chineseIntroductionVisible'] and r[29]['hasDialogueExpansion'],
    '精简AI指引与当前主线一致且进入真实请求': r[1]['guideMatchesCurrentMain'] and r[9]['conciseGuideActuallyInRequest'],
    '首次设定写入不同文件': '每周六' in r[10]['worldText'] and '柚子茶' in r[10]['personaText'] and not r[9]['worldHasTea'],
    '原有world与persona条目实际被替换': all(r[12][k] for k in ['worldChangedOnDisk','personaChangedOnDisk','nextRequestHasNewWorld','nextRequestHasNewPersona','oldWorldRemovedFromSystem','oldPersonaRemovedFromSystem']),
    '无旧助手历史的新会话收到更新内容': r[14]['assistantHistoryCount'] == 0 and r[14]['newWorldFromSystem'] and r[14]['newPersonaFromSystem'] and r[15]['freshConversationAnswer'],
    '换家族选择正确角色且不串私人偏好': r[16]['persona'] == 'GPT 白龙娘' and r[16]['hasSharedSunday'] and not r[16]['hasWhalePrivateTea'] and r[16]['assistantHistoryCount'] == 0,
    '同家族换版本沿用一个目录': r[18]['model'] == 'gpt-4.1' and r[18]['roleDirectories'] == ['gpt'] and r[18]['hasSunday'],
    '未知模型不强套角色': r[20]['unmappedHasNoPreset'],
    '自定义角色与模型绑定实际持久化': r[21]['currentPersona'] == '星璃' and r[21]['hasOwnPersonality'] and r[21]['registry']['bindings'][0]['persona'] == 'stella',
    '新角色仅共享名字而非完整个人内容': r[21]['sharedHasName'] and not r[21]['sharedHasPrivatePersonality'] and r[21]['noWhalePrivateTea'],
    '外部编辑后一次重载生效并完成对话': not r[23]['beforeReloadContainsExternalPhrase'] and r[23]['fileAlreadyContainsExternalPhrase'] and r[24]['afterReloadContainsPhrase'] and r[25]['finalAnswerVisible'],
}
if not all(checks.values()):
    raise RuntimeError('Some required observations did not match: ' + str(checks))
requests = [load(p.name) for p in sorted(ROOT.glob('request-*.json'))]
replies = [load(p.name) for p in sorted(ROOT.glob('reply-*.json'))]
results = [load(p.name) for p in sorted(ROOT.glob('result-*.json'))]
state = load('state.json')
pack = load('pack.json')[0]
request_count = len(requests)
reply_count = len(replies)
tool_count = sum(len(x.get('tool_calls', [])) for x in replies)
page_errors = sorted({error for item in results for error in item.get('snapshot',{}).get('pageErrors',[])})
head = load('main-readback.json')['object']['sha']
if head != SOURCE:
    raise RuntimeError('Main changed while report was prepared; review before delivery.')

files = [
    ('world/96-自补-世界观.md', r[12]['worldFile'], '原文；来源 result-0012.json'),
    ('persona/90-记忆.md', r[12]['personaFile'], '原文；来源 result-0012.json'),
    ('personas/stella/00-用户设定.md', r[21]['characterFile'], '原文；来源 result-0021.json'),
    ('personas/.kujira-catalog.json', json.dumps(r[21]['registry'],ensure_ascii=False,indent=2), '实际读取结果的格式化JSON；来源 result-0021.json'),
    ('world/88-外部试用.md', r[24]['externalFile'], '原文；来源 result-0024.json'),
]
(ROOT / 'files-after.json').write_text(json.dumps({'note':'从实际测试读回结果汇集；不是测试结束后再次访问已销毁的Runner。绑定索引为解析后格式化表示。','files':[{'path':p,'content':text,'evidence':source} for p,text,source in files]},ensure_ascii=False,indent=2),encoding='utf-8')

cases = [
    ('01  添加插件','command-0003.png','在隔离profile卸载测试副本后，使用实际“添加插件”窗口输入当前主线打包的本地 .tgz 路径。测试覆盖本地tarball安装，不冒充市场或远程下载安装。'),
    ('02  安装完成','command-0004.png','实际点击安装，得到 Installed / Version 1.6.1 / Enable now；随后启用，组件显示运行中。版本字符串仍为1.6.1，精确内容由主线提交定位，并非旧发行包。'),
    ('03  中文介绍页','command-0029.png','实际切换DSH为中文，打开插件详情。世界观、人物、随模型切换、在DSH对话里扩充，以及用户选择优先均已显示。旧的长篇实现说明不再出现。'),
    ('04  聊天认人与首次保存','command-0010.png','DeepSeek路由载入鲸鱼娘。真实工具分别保存“周六一起烤饼干”到world和“喜欢柚子茶”到小鲸个人档案；共同文件没有私人偏好。690字符的精简AI指引实际出现在请求中。'),
    ('05  修改原有条目','command-0013.png','用户要求改成周日和乌龙茶。两个真实replace调用改动原文；文件与随后的系统提示词都含新内容，不再含旧条目，不是只追加一份互相矛盾的记录。'),
    ('06  新会话仍然生效','command-0015.png','新会话没有旧助手历史，用户问题也未给出星期和饮品答案。其系统提示词已带入周日与乌龙茶，随后完成对话。此项检查的是保存内容进入上下文，不是品牌模型的独立记忆能力。'),
    ('07  切换模型家族','command-0017.png','通过真实模型选择器切到gpt-4o，载入白龙娘。新请求共享周日约定，但没有小鲸的乌龙茶偏好。菜单明确标注TEST RELAY。'),
    ('08  同家族换版本','command-0019.png','通过真实选择器从gpt-4o切换到gpt-4.1，仍使用personas/gpt。只有一个GPT角色目录，共同约定保留。'),
    ('09  自定义人物与模型绑定','command-0022.png','未知模型最初没有强套角色。真实persona_manage创建星璃，写入人物文件和绑定索引；下一次请求及下一个新会话都选中星璃。公共名录仅加入名字，不复制她的完整私人人设。'),
    ('10  外部修改后定向刷新','command-0025.png','外部文件写入“橘子星河”暗号后，重载前请求不含该文字；一次world reload后，实际请求包含新暗号，最终对话完成。期间没有重启DSH。'),
]
for _, image, _ in cases:
    if not (ROOT / image).is_file():
        raise RuntimeError('Missing screenshot: '+image)

esc = lambda s: html.escape(str(s))
status = '13项功能检查取得预期结果；测试驱动在最后整理文件截图时失败。'
limits = '真实DSH Web与真实插件工具执行，模型端由当前ChatGPT助手阅读实际请求后人工中转回复和工具调用；没有使用真实DeepSeek/GPT账号，不是独立模型行为盲测。自然回复示例由本助手编写，不能据此保证其他模型的表现。界面耗时包含GitHub中转与人工检查，Usage 0 tok不是性能或费用测量。未测试Windows Electron、长期运行或所有安装来源。'
setup = [
    '首次环境准备运行39929175780在系统字体下载过慢时被取消，DSH尚未启动；改用测试机已有Chrome后进入本轮试用。',
    '测试命令0006在页面刚切换时选中了侧栏搜索框，导致发送按钮未启用；改用精确聊天编辑器定位后完成。',
    '测试命令0008存在字符串转义错误，没有执行；后续改写命令完成了同一核对。',
    '全部上述应用场景完成、中文介绍页截图保存后，命令0030的JSON转义错误使驱动退出。该命令只用于整理额外的文件截图，未执行；原始截图、对话、工具结果和已读回的文件原文均已上传保存。GitHub应用试用运行因此显示failure，而非success。',
    '本报告根据已保存证据在独立报告步骤中重新生成，没有重写测试结果，没有把收尾失败改成全绿。',
]
summary = {'sourceCommit':SOURCE,'runId':RUN,'functionalChecks':checks,'functionalPassCount':sum(checks.values()),'functionalCheckCount':len(checks),'modelRequests':request_count,'modelReplies':reply_count,'realPluginToolCalls':tool_count,'userMessages':7,'aiGuideCharacters':r[1]['guideCharacters'],'pageJavaScriptErrors':page_errors,'driverFinalState':state,'mainUnchanged':head==SOURCE,'packageFileCount':pack.get('entryCount'),'packageSHA256':(ROOT/'package.sha256').read_text().split()[0],'packageIncludesQA':any(f['path'].startswith(('qa/','.github/','tests/')) for f in pack['files']),'method':limits}
(ROOT/'checks.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')

style = '''body{margin:0;background:#f3f5f8;color:#203040;font:16px/1.7 "Noto Sans CJK SC","Microsoft YaHei",Arial,sans-serif}main{max-width:1160px;margin:auto;padding:42px 24px}h1{font-size:34px;line-height:1.3;margin:0 0 16px}h2{font-size:24px;margin:0 0 12px}h3{font-size:18px}.hero,.section{background:white;border:1px solid #dce3eb;border-radius:14px;padding:28px;margin-bottom:24px}.tag{font-size:13px;color:#516579;letter-spacing:1px}.notice{background:#fff6e5;border-left:4px solid #c38c2d;padding:16px 20px;margin:22px 0}.metrics{display:flex;flex-wrap:wrap;gap:12px}.metric{flex:1;min-width:135px;background:#edf3f7;padding:14px;border-radius:9px}.metric strong{display:block;font-size:27px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:11px;border-bottom:1px solid #e0e6ed;text-align:left;vertical-align:top}.pass{color:#146a4d}figure{margin:22px 0 0}img{display:block;width:100%;border:1px solid #e0e6ed;border-radius:6px}figcaption{font-size:13px;color:#576b7d;margin-top:9px}pre{font:14px/1.7 "Microsoft YaHei",monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f7fa;padding:18px;border-radius:8px}code{overflow-wrap:anywhere}a{color:#2361a1}.muted{color:#5b6c7d;font-size:14px}@media print{body{background:white}main{padding:0}.section{break-inside:avoid;border:0;border-radius:0}img{max-height:230mm;object-fit:contain}.notice{border:1px solid #aaa}}'''
parts = [f'<div class="hero"><div class="tag">KUJIRA · REAL DSH WEB TRIAL · 2026-10-23</div><h1>实际界面与设定持久化复测</h1><p>{esc(status)}</p><div class="metrics"><div class="metric"><strong>{len(checks)}/{len(checks)}</strong>功能检查</div><div class="metric"><strong>{request_count}/{reply_count}</strong>模型请求 / 中转回复</div><div class="metric"><strong>{tool_count}</strong>真实插件工具调用</div><div class="metric"><strong>{len(cases)}</strong>精选实拍截图</div></div><div class="notice"><b>测试边界</b><br>{esc(limits)}</div><p>测试对象：<code>{SOURCE}</code>。包内版本仍为1.6.1，包含未发布的说明精简改动；没有覆盖现有发行包。</p><p>环境：Ubuntu 22.04、Node 24、Chrome、官方DSH 0.2.1-rc.2发布构建。官方源码标签对应提交为<code>687f282e8625c6b8d11ff58211a90524be2e4317</code>；本轮不是从源码重新编译DSH。</p><p class="muted">当前主线未变；市场、发行包与用户本机未由本次测试修改。</p></div>']
parts.append('<section class="section"><h2>结果速览</h2><table><tr><th>检查项</th><th>结果</th></tr>'+''.join('<tr><td>'+esc(k)+'</td><td class="pass">已观察到预期结果</td></tr>' for k in checks)+'</table></section>')
for title,image,detail in cases:
    encoded=base64.b64encode((ROOT/image).read_bytes()).decode('ascii')
    parts.append('<section class="section"><h2>'+esc(title)+'</h2><p>'+esc(detail)+'</p><figure><img alt="'+esc(title)+'" src="data:image/png;base64,'+encoded+'"><figcaption>实际DSH界面截图 · '+image+'。聊天回复由助手人工中转；界面、请求、工具执行和文件保存由DSH产生。</figcaption></figure></section>')
parts.append('<section class="section"><h2>文件可查：实际读回的内容</h2><p>以下原文来自本次应用试用已保存的读回结果；不是另造的示例文件。完整JSON及路径在附带证据中。</p>')
for path,text,source in files:
    parts.append('<h3>'+esc(path)+'</h3><p class="muted">'+esc(source)+'</p><pre>'+esc(text)+'</pre>')
parts.append('</section>')
parts.append('<section class="section"><h2>发现与执行说明</h2><p>精简说明已在中英文界面生效。不过DSH仍把同一简介用于包说明与组件说明，因此页面有两处重复。这是本次观察到的显示体验问题，没有为此改宿主代码。</p>'+''.join('<p>'+esc(t)+'</p>' for t in setup)+'</section>')
parts.append('<section class="section"><h2>证据索引</h2><p><a href="https://github.com/Tests4gptplay/dsh-kujira-persona/actions/runs/'+RUN+'">实际应用试用运行 '+RUN+'</a> · <a href="https://github.com/Tests4gptplay/dsh-kujira-persona/tree/qa/ui-docs-rerun-20261023/qa/live">原始请求与结果</a></p><p>本压缩包包含原始PNG、request/reply/result JSON、安装日志、checks.json、files-after.json和文件清单。截图已嵌入本HTML，离线也可阅读。</p><pre>'+esc(json.dumps({k:v for k,v in summary.items() if k not in ['functionalChecks','method']},ensure_ascii=False,indent=2))+'</pre></section>')
html_report='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kujira DSH 截图测试报告</title><style>'+style+'</style><main>'+''.join(parts)+'</main></html>'
(ROOT/'Kujira_DSH_截图测试报告.html').write_text(html_report,encoding='utf-8')

md=['# Kujira · DSH实际界面与设定持久化复测','',status,'',f'测试对象：`{SOURCE}`。包内版本仍为1.6.1，但这是包含未发布文案修订的当前主线测试包。','',limits,'',f'本轮7条用户消息，{request_count}次真实请求，{reply_count}次助手中转回复，{tool_count}次真实插件工具调用。','', '## 功能结果','']
md.extend('| '+k+' | 取得预期结果 |' for k in checks)
for title,image,detail in cases:
    md.extend(['','## '+title,'',detail,'',f'![{title}](screenshots/{image})'])
md.extend(['','## 文件读回',''])
for path,text,source in files:
    md.extend(['### '+path,source,'```text',text.rstrip(),'```',''])
md.extend(['## 执行异常与边界',''])
md.extend(setup)
md.extend(['','DSH仍在包说明和组件说明重复使用同一段简介；本轮未改宿主。','',f'[应用试用运行](https://github.com/Tests4gptplay/dsh-kujira-persona/actions/runs/{RUN}) · [原始证据](live/)','','本次没有修改主线、发行包、市场或用户本机。测试脚本和证据只在QA分支。'])
(ROOT/'REPORT.md').write_text('\n\n'.join(md),encoding='utf-8')
(ROOT/'README.txt').write_text('解压后打开 Kujira_DSH_截图测试报告.html。截图已嵌入，可离线浏览。\nREPORT.md为文字与图片索引；原始请求、工具结果、落盘文件读回和PNG均保留。\n功能场景已完成；原测试驱动在最后整理额外截图时因JSON转义错误失败，报告中如实注明。\n',encoding='utf-8')
# Export current synthetic trial material only. Remove any ephemeral URL login token from text logs.
for p in ROOT.glob('*.log'):
    content=p.read_text(encoding='utf-8',errors='replace')
    p.write_text(re.sub(r'([?&]token=)[^\s&#]+',r'\1[redacted]',content),encoding='utf-8')
for stale in ['report-data.json','evidence-sha256.json']:
    (ROOT/stale).unlink(missing_ok=True)
hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.iterdir() if p.is_file()}
(ROOT/'evidence-sha256.json').write_text(json.dumps(hashes,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'functionalChecks':len(checks),'allExpected':all(checks.values()),'screenshots':len(cases),'requests':request_count,'replies':reply_count,'toolCalls':tool_count,'driverFinalStage':state['stage'],'htmlBytes':len(html_report.encode()),'mainUnchanged':head==SOURCE},ensure_ascii=False))
