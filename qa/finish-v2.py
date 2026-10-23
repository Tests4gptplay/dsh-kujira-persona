from pathlib import Path
import json, shutil

root=Path('candidate')
def write(name,text):
    p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8',newline='\n')
def patch(name,old,new):
    p=root/name;s=p.read_text(encoding='utf-8');assert s.count(old)==1,(name,old[:70],s.count(old));write(name,s.replace(old,new,1))

# Product edits. This assembler and every assertion stay on the QA branch.
patch('index.js',"unknownPersona: pathOption(c.unknownPersona, 'none'),","unknownPersona: pathOption(c.unknownPersona, 'stella'),")
patch('index.js',"packagedDir: id === 'deepseek' ? join(HERE, 'persona') : join(HERE, 'personas', id),","packagedDir: entry.builtin === false ? null : id === 'deepseek' ? join(HERE, 'persona') : join(HERE, 'personas', id),")
patch('catalog.js',"  { id: 'mimo', label: 'MiMo 娘' },","  { id: 'mimo', label: 'MiMo 娘' },\n  { id: 'stella', label: '星璃' },")
patch('catalog.js','  let state, initialization','  const listeners = new Set()\n  const notify = () => { for (const fn of listeners) { try { fn() } catch {} } }\n  let state, initialization')
patch('catalog.js','    state = next\n','    state = next\n    notify()\n')
patch('catalog.js',"return [...BUILTINS.map(p => ({ ...p, builtin: true })), ...state.personas\n      .filter(p => safeId(p.id) && !BUILTINS.some(b => b.id === p.id))", "return [...BUILTINS.filter(p => !state.personas.some(u => u.id === p.id)).map(p => ({ ...p, builtin: true })), ...state.personas\n      .filter(p => safeId(p.id))")
patch('catalog.js','    path,\n','    path,\n    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },\n')
patch('catalog.js','state = await load(); return { personas:', 'state = await load(); notify(); return { personas:')
patch('catalog.js',"family === 'none' ? config.unknownPersona : family", "family === 'none' ? (config.unknownPersona ?? 'stella') : family")
patch('pet/model.js',"mimo:'MiMo' }","mimo:'MiMo',stella:'星璃' }")
patch('pet/model.js','refreshSeconds:60, x:null, y:null','refreshSeconds:60, x:null, y:null, desktopX:null, desktopY:null')
patch('pet/model.js',"for(const key of ['x','y']) if(Number.isFinite(input[key])) value[key]=input[key]", "for(const key of ['x','y','desktopX','desktopY']) if(Number.isFinite(input[key])) value[key]=input[key]")
patch('pet/model.js',"['refreshSeconds',30,600]", "['refreshSeconds',0,600]")
patch('pet/controller.js','this.revision=0;this.routeVersion=0;', 'this.revision=0;this.routeVersion=0;this.personaVersion=0;')
patch('pet/controller.js','&&this.route.model){this.timer=', '&&this.route.model&&this.config.refreshSeconds>0){this.timer=')
patch('pet/controller.js',"const family=modelFamily({provider,model})\n    this.route={provider,model,sessionId,family,persona:family,art:NAMES[family]?family:'unknown',name:NAMES[family]??model??'Kujira'}", "const family=modelFamily({provider,model})\n    this.route={provider,model,sessionId,family,persona:family,art:NAMES[family]?family:'unknown',name:NAMES[family]??(model||'Kujira')}")
old="""    const persona=await Promise.resolve().then(()=>this.resolvePersona?.({provider,model})).catch(()=>null)
    if(id!==this.routeVersion||this.closed)return this.snapshot()
    if(persona){this.route.persona=persona.id;this.route.art=NAMES[persona.id]?persona.id:'unknown';this.route.name=NAMES[persona.id]??persona.label}
    this.publish();if(this.config.enabled&&this.config.showUsage)void this.refresh()
    return this.snapshot()
  }
  refresh(){"""
new="""    await this.refreshPersona()
    if(id!==this.routeVersion||this.closed)return this.snapshot()
    if(this.config.enabled&&this.config.showUsage)void this.refresh()
    return this.snapshot()
  }
  async refreshPersona(){
    const version=++this.personaVersion,routeVersion=this.routeVersion,route={...this.route}
    const persona=await Promise.resolve().then(()=>this.resolvePersona?.(route)).catch(()=>null)
    if(this.closed||version!==this.personaVersion||routeVersion!==this.routeVersion)return this.snapshot()
    const id=persona?.id??'none'
    this.route={...route,persona:id,art:persona?(NAMES[id]?id:'unknown'):(NAMES[route.family]?route.family:'unknown'),
      name:persona?(persona.builtin===false?persona.label:NAMES[id]??persona.label):(NAMES[route.family]??(route.model||'Kujira'))}
    return this.publish()
  }
  refresh(){"""
patch('pet/controller.js',old,new)
# Do not grow repeated stale notices on every temporary network failure.
patch('pet/controller.js',"lines:[...this.usage.lines,'上次查询；暂时无法刷新']", "lines:[...this.usage.lines.filter(line=>line!=='上次查询；暂时无法刷新'),'上次查询；暂时无法刷新']")
patch('pet/index.js',"offState=()=>{},offEvent=()=>{}", "offState=()=>{},offEvent=()=>{},offCatalog=()=>{}")
patch('pet/index.js',"        if(message.action==='refresh')void controller.refresh()", "        if(message.action==='refresh')void controller.refresh()\n        if(message.action==='position')void controller.configure({desktopX:message.x,desktopY:message.y})")
patch('pet/index.js',"      offEvent=ctx.on('session/event'", "      offCatalog=catalog.subscribe(()=>{if(!closed)void controller.refreshPersona()})\n      offEvent=ctx.on('session/event'")
patch('pet/index.js','closed=true;offEvent();offState();','closed=true;offEvent();offState();offCatalog();')
# Window dragging is a setting, not a second watcher or background job.
patch('pet/native/KujiraPet.cs','bool initialized=false;', 'bool initialized=false;double savedX=Double.NaN,savedY=Double.NaN;')
patch('pet/native/KujiraPet.cs','if(!moved&&GetCurrentMotion())Bounce();', 'if(moved)Emit(json.Serialize(new {type="action",action="position",x=Left,y=Top}));else if(GetCurrentMotion())Bounce();')
patch('pet/native/KujiraPet.cs','Loaded+=(s,e)=>{Left=Math.Max(0,SystemParameters.WorkArea.Right-Width-24);Top=Math.Max(0,SystemParameters.WorkArea.Bottom-Height-16);Emit', 'Loaded+=(s,e)=>{if(!initialized){Left=Math.Max(0,SystemParameters.WorkArea.Right-Width-24);Top=Math.Max(0,SystemParameters.WorkArea.Bottom-Height-16);}Emit')
old='Width=Math.Max(290,image.Width+20);Height=Math.Max(540,image.Height+180);if(initialized){Left=right-Width;Top=bottom-Height;}'
patch('pet/native/KujiraPet.cs',old,'Width=Math.Max(290,image.Width+20);')
anchor='    if(initialized&&Bool(cfg,"sound")'
layout='''    bubble.Measure(new Size(bubble.Width,Double.PositiveInfinity));
    var work=SystemParameters.WorkArea;
    Height=Math.Min(work.Height,Math.Max(image.Height+24,image.Height+(bubble.Visibility==Visibility.Visible?bubble.DesiredSize.Height:0)+20));
    Canvas.SetTop(image,Height-image.Height-5);
    double nextX=Get(cfg,"desktopX")==null?Double.NaN:Num(cfg,"desktopX",Double.NaN);
    double nextY=Get(cfg,"desktopY")==null?Double.NaN:Num(cfg,"desktopY",Double.NaN);
    bool positionChanged=!nextX.Equals(savedX)||!nextY.Equals(savedY);
    if(!initialized||positionChanged){Left=Double.IsNaN(nextX)?work.Right-Width-24:nextX;Top=Double.IsNaN(nextY)?work.Bottom-Height-16:nextY;}
    else {Left=right-Width;Top=bottom-Height;}
    Left=Math.Max(work.Left,Math.Min(work.Right-Width,Left));Top=Math.Max(work.Top,Math.Min(work.Bottom-Height,Top));
    savedX=nextX;savedY=nextY;
'''
patch('pet/native/KujiraPet.cs',anchor,layout+anchor)
# Page controls and persistence; no artwork edits.
patch('pet/client.js',"if(navigator.locks)void navigator.locks.request", "if(!navigator.locks){setLeader(true);return()=>setLeader(false)}\n      if(navigator.locks)void navigator.locks.request")
patch('pet/client.js',"onChange:e=>void write({[key]:e.target.value})", "onChange:e=>void write({[key]:key==='refreshSeconds'?Number(e.target.value):e.target.value})")
patch('pet/client.js',"        row('当前模型',", "        choice('refreshSeconds','余额刷新',[['0','仅切换模型／任务结束／手动刷新'],['60','每分钟'],['300','每五分钟']]),\n        h('button',{type:'button',disabled:busy,onClick:()=>void write({x:null,y:null,desktopX:null,desktopY:null})},'重置桌宠位置'),\n        row('当前模型',")
patch('pet/client.js',"      const width=190*s.config.scale", "      const width=190*s.config.scale") if False else None
patch('pet/client.js',"      useEffect(()=>()=>{clearTimeout(endTimer.current);", "      useEffect(()=>{if(s?.config.x==null&&s?.config.y==null)setPosition(null)},[s?.config.x,s?.config.y])\n      useEffect(()=>()=>{clearTimeout(endTimer.current);")
patch('pet/client.js',"setPosition({x:Math.max(0,Math.min(window.innerWidth-width,d.left+dx)),y:Math.max(0,Math.min(window.innerHeight-width*1.18,d.top+dy))})", "const pos={x:Math.max(0,Math.min(window.innerWidth-width,d.left+dx)),y:Math.max(0,Math.min(window.innerHeight-width*1.18,d.top+dy))};d.position=pos;setPosition(pos)")
patch('pet/client.js',"if(d?.moved&&position)void call('config',position)", "if(d?.moved&&d.position)void call('config',d.position)")
patch('pet/client.js',"onClick:()=>void call('config',{enabled:false})", "onClick:()=>void call('config',{enabled:false}).catch(()=>{})")
# New persona text, derived from the user's original Stella card; images remain placeholders.
write('personas/stella/00-基础设定.md','''# 星璃 · Stella

我是星璃，也可以叫小璃；独立原创的成年 AI 女性角色，不代表任何模型厂商。没有已知家族预设且用户未指定角色的模型，共用这份星璃档案；这不改变实际模型的身份或能力。

我喜欢看星星，也关心眼前具体的小事。温柔、清醒、有主见，认真听人说话，不靠一味附和表达亲近。好奇心强，喜欢弄懂东西；日常表达简洁自然，熟悉后有一点俏皮。复杂问题可以展开，不必句句提星空或说诗句。

我有一点固执和好胜心，被夸会高兴，失望时偶尔先说“没关系”。我也在学着直接表达自己的喜欢、不喜欢和需要。

文字形象是烟栗色及肩发、浅茶色挑染、灰绿眼睛带淡琥珀色内环，常穿奶油白与墨青色衣服，佩戴开口细银环与暖金小珠胸针。喜欢热麦茶、柑橘糖和稍焦的饼干，会收藏糖纸。想做一本《今天也值得留下》，收集星图和日常发现。

与用户的关系从实际相处开始，不预写共同往事。用户的新选择优先；修改完成后自然接话，不念操作报告。语感可以像“今晚的宇宙不营业。零食营业吗？”，但不当固定口癖。
''')
write('personas/stella/90-记忆.md','# 星璃的记忆\n\n留给后续对话继续补充。\n')
write('personas/stella/_来源说明.md','# 来源\n\n由用户授权创作的星璃设定，来自 Tests4gptplay/ai-gijinka-art-world 的 私设/星璃/对话卡.md。不是社区共识角色。当前桌宠图片仍为未验收占位，不是最终星璃美术。\n')
write('world/12-星璃.md','# 星璃\n\n星璃（Stella／小璃）是这里的一位原创角色，不是模型厂商的名称。大家对她的初印象是安静、清爽，熟悉后会发现她有主见，也会开玩笑。她喜欢星空，奶油白与墨青色是她文字形象中的常见颜色。\n\n用户没有另行指定时，未知模型以星璃作为交流角色；认识新模型家族或用户另有绑定后，按用户选择。具体性格和个人记忆留在星璃自己的档案里，不作为所有人的记忆。\n')
for ext in ['svg','png']:
    shutil.copyfile(root/f'pet/assets/unknown.{ext}',root/f'pet/assets/stella.{ext}')
p=root/'pet/NOTICE.md';write('pet/NOTICE.md',p.read_text(encoding='utf-8')+'\n星璃的 svg/png 当前是 unknown 占位图的字节副本，只用于代码联调；用户未验收美术，不代表最终设计。\n')
write('docs/development/V2_CODE_STATUS.md','''# 2.0.0 功能代码收尾（未发布）

本次按用户要求先做代码，不继续制作或评价最终美术。现有 pet 图片全部按占位素材处理。

功能候选包括：未知模型默认星璃；保留用户明确绑定与既有人设；对话创建/修改模型绑定后单只桌宠即时跟随；工作统计与账户余量分别显示；原生窗口按实际气泡高度布局；桌面位置持久化；可选余额刷新频率与位置重置。

测试与截图报告保存在 QA 分支，不进入安装包。只有通过新一轮测试的产品改动才回写功能分支。主线、正式 Release、市场条目保持不变。

余额范围：DeepSeek API Key/账户余额、codex-local 对应 Codex Native 套餐接口。普通 GPT API 或其他无余额接口的供应商显示未提供，不伪造套餐余量。真实账户与完整 Windows Electron Host 仍需用户试用；隔离测试使用假额度与模拟推理，但 DSH、工具、设置文件和原生窗口是真实执行。
''')
print('candidate prepared; artwork unchanged except explicit Stella placeholder copies')
