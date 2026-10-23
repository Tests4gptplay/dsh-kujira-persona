from pathlib import Path
import base64, hashlib, json, os, shutil, subprocess

REPO='Tests4gptplay/dsh-kujira-persona'
QA='qa/v2-workstats-20261023'
FEATURE='feat/v2.0.0-single-model-pet'
RUN=39972559844
SOURCE='2f3940cd7f4463ae3fb0e25521f765835c83c80a'
root=Path('qa/reports')/('workstats-'+str(RUN))
web=Path('download/web');win=Path('download/windows/evidence')

def api(path, data=None, method=None):
    args=['gh','api',path]
    if method:args+=['--method',method]
    if data is not None:args+=['--input','-']
    p=subprocess.run(args,input=None if data is None else json.dumps(data),text=True,capture_output=True,check=True)
    return json.loads(p.stdout) if p.stdout.strip() else None

def commit_files(branch, files, message, expected=None):
    head=api(f'repos/{REPO}/git/ref/heads/{branch}')['object']['sha']
    if expected is not None and head!=expected:raise RuntimeError('Branch changed; archive will not overwrite concurrent work')
    tree=api(f'repos/{REPO}/git/commits/{head}')['tree']['sha']
    entries=[]
    for path,content in files.items():
        blob=api(f'repos/{REPO}/git/blobs',{'content':base64.b64encode(content).decode(),'encoding':'base64'})
        entries.append({'path':path,'mode':'100644','type':'blob','sha':blob['sha']})
    tree=api(f'repos/{REPO}/git/trees',{'base_tree':tree,'tree':entries})['sha']
    commit=api(f'repos/{REPO}/git/commits',{'message':message,'tree':tree,'parents':[head]})['sha']
    if api(f'repos/{REPO}/git/ref/heads/{branch}')['object']['sha']!=head:raise RuntimeError('Concurrent branch update')
    api(f'repos/{REPO}/git/refs/heads/{branch}',{'sha':commit,'force':False},'PATCH')
    return commit

ui=json.loads((web/'ui-result.json').read_text(encoding='utf-8-sig'))
parity=json.loads((web/'stats-parity.json').read_text(encoding='utf-8-sig'))
native=json.loads((win/'native-result.json').read_text(encoding='utf-8-sig'))
bridge=json.loads((win/'native-bridge.json').read_text(encoding='utf-8-sig'))
assert ui['ok'] and native['ok'] and bridge['ok']
assert len(ui['cases'])==12 and all(c['status']=='pass' for c in ui['cases'])
assert '# pass 30' in (web/'unit-stats.txt').read_text()
for source,folder in [(web,'web'),(win,'windows')]:
    dest=root/folder;dest.mkdir(parents=True,exist_ok=True)
    for file in source.iterdir():
        if file.is_file() and (file.suffix=='.png' or file.name in {'ui-result.json','stats-parity.json','unit-stats.txt','install.log','native-result.json','native-bridge.json','native-stats-text.txt'}):
            shutil.copy2(file,dest/file.name)

stats=parity['stats']
notes=f'''# Kujira 2.0.0 · 工作统计与单只桌宠截图测试报告

测试日期：2026-10-23。开发版，**不是 2.0.0 正式发布或整版验收**。

产品源码：`{SOURCE}`。测试运行：[GitHub Actions {RUN}](https://github.com/{REPO}/actions/runs/{RUN})。

## 结果

**30 项单测、12 项真实 DSH Web 场景通过；Windows 原生可见窗口和桥接生命周期检查通过。**

Windows 实际抓取到同一进程、同一个窗口句柄，DeepSeek 换 GPT 时位置不变；第二个实例被单窗口机制拒绝；输入管道关闭后进程退出；桥接快速关开能重新启动，未观察到此次测试范围内的残留窗口。

Web 页面和控制台异常数组为空。插件通过真实 DSH 的本地 tarball 安装；任务实际执行 DSH 的 read 工具读取 sample.txt。页面中只存在一个宠物节点，切模型更新同一节点。

## 真实操作与模拟数据的界限

真实：DSH 0.2.1-rc.2 Web、安装流程、模型选择器、工具执行、设置文件、DSH 投影统计、页面 DOM、Windows WPF 窗口与进程。

模拟：模型回复、模型回报的 Token 用量、DeepSeek ¥57.25、Codex 65%/33% 等账户数字。Web 的吞吐速度由测试回复和实际测试时序产生，**不是模型性能测量**。Windows 注入“2 轮 59 步”等例值验证渲染；没有冒充真实账户验收。图片仍是开发草图。

没有测试用户本机 Windows Electron、真实账号额度、长时间运行或所有显示器/DPI 设置；星璃未知模型默认人设与最终美术不属于本轮已完成范围。

## 与 DSH 底栏对照

实际桌宠读数：

```text
{chr(10).join(stats['lines'])}
```

DSH 底栏：`{parity['dockActivity']}`；`{parity['dockUsage']}`。轮次、步骤、解码速度、累计 Token 和缓存命中一致。上下文来自同一 contextPressure 投影，本轮为 {stats['contextPercent']}%，与截图中的原生上下文计相符。

**上下文占用不是任务完成率，也不是套餐剩余量。**工作统计和账户余额分区显示。工作统计可以单独关闭；关闭桌宠不影响人设功能。

## Web 场景

| 场景 | 结果 |
| --- | --- |
'''
for case in ui['cases']:notes+=f"| {case['name']} | 通过：{case['detail']} |\n"
notes+='\n## 原始截图\n\n以下为实际捕获的界面，不是设计效果图。\n\n'
shots=[
('web/01-settings-off.png','默认关闭与插件设置','真实插件详情页显示开关与设置。'),
('web/02-settings-on.png','开启桌宠','页面内显示模式和可选设置。'),
('web/03-deepseek-balance.png','DeepSeek 与余额','余额为 QA 模拟值。'),
('web/04-task-running.png','实际任务进行中','真实 DSH read 任务，初次请求尚未结算时不编造完整统计。'),
('web/05-task-complete.png','任务完成','工具执行后显示完成状态和已结算统计。'),
('web/11-real-dsh-stats.png','桌宠与 DSH 底栏统计对照','两处读数来自同一会话；账户余额在独立区域。'),
('web/06-gpt-codex-quota.png','同一桌宠换成 GPT','账户示例为 Codex 模拟套餐余量。'),
('web/07-gpt-same-family.png','同家族换版本','继续使用同一人物形象。'),
('web/08-glm.png','切换 GLM','不沿用其他供应商的余额与套餐。'),
('web/09-gemini.png','切换 Gemini','只有一个宠物节点。'),
('web/10-disabled.png','关闭桌宠','设置保存并移除页面宠物；重载仍保持关闭。'),
('windows/native-deepseek.png','Windows 原生窗口 · 工作中','通过 Windows 自动化读取到轮次、速度、缓存命中和上下文文字。例值为测试输入。'),
('windows/native-gpt.png','Windows 原生窗口 · 换形象','同一窗口句柄和位置，换成 GPT 并显示模拟 Codex 余量。独立窗口截图的背景不是桌面全屏截图。'),
]
for file,title,caption in shots:
    assert (root/file).exists(),file
    notes+=f'### {title}\n\n{caption}\n\n![{title}](reports/workstats-{RUN}/{file})\n\n'
notes+='''## 首轮异常与修复

首轮运行 39972381258 的 Web 同样通过，Windows 测试准备脚本却使用系统默认 cp1252 读取中文 UTF-8 文件，导致 QA 补丁没有应用。修复为显式 UTF-8，并让准备命令失败立即停止该测试，未向运行插件加入编码自检或测试修补。修复后的上述运行两端均成功。更早本地浏览器被环境策略拦住，未绕过策略，改在已有授权的隔离 Runner 验证。

## 保存位置与剩余工作

产品代码、正常显示 helper 和用户说明在 feat/v2.0.0-single-model-pet；测试、模拟服务、截图和本报告在 qa/v2-workstats-20261023。没有改 main、发行包或市场。

下一步仍需完成星璃默认档案与形象的实际接入、正式美术、真实账户接口覆盖，以及完整 2.0.0 试用和打包验收。本轮通过不替代这些工作。
'''
report=Path('qa/WORK_STATS_REPORT.md');report.write_text(notes,encoding='utf-8')

# Persist the binary compiled from the exact feature source, not a QA-modified executable.
source=Path('download/windows/candidate/pet/native/KujiraPet.cs').read_bytes()
exe=Path('download/windows/candidate/pet/native/win-x64/KujiraPet.exe').read_bytes()
assert hashlib.sha256(exe).hexdigest()=='70dd3ed3ed0856ce66fb37e0e6442317463f31e8fd8b7656dc5b2d634801aa75'
head=api(f'repos/{REPO}/git/ref/heads/{FEATURE}')['object']['sha']
remote=api(f'repos/{REPO}/contents/pet/native/KujiraPet.cs?ref={head}')
assert base64.b64decode(remote['content'])==source
binary=api(f'repos/{REPO}/contents/pet/native/win-x64/KujiraPet.exe?ref={head}')
if base64.b64decode(binary['content'])!=exe:
    binary_commit=commit_files(FEATURE,{'pet/native/win-x64/KujiraPet.exe':exe},'build(pet): persist source-matched tested Windows work-stat display helper',head)
else:binary_commit=head
(root/'BUILD_PROVENANCE.json').write_text(json.dumps({'tested_source':SOURCE,'run':RUN,'feature_binary_commit':binary_commit,'native_sha256':hashlib.sha256(exe).hexdigest(),'native_source_git_blob':remote['sha'],'windows_artifact':12510270556,'web_artifact':12508968768,'qa_code_in_product':False},ensure_ascii=False,indent=2)+'\n')
files={str(p).replace('\\','/'):p.read_bytes() for p in root.rglob('*') if p.is_file()}
files[str(report)]=report.read_bytes()
commit=commit_files(QA,files,'docs(qa): preserve original Web and Windows work-stat screenshots and measured results')
print(json.dumps({'report_commit':commit,'feature_binary_commit':binary_commit,'screenshots':len(shots),'report':str(report)},ensure_ascii=False))
