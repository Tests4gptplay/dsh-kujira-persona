window.__ModuleLoader__.load({id:'dsh-kujira-persona',factory:(require)=>{
  const React=require('react'),h=React.createElement
  const {Menu,MenuSurface,MenuItemButton}=require('@deepseek-ai/dsh-client-ui-primitives')
  const {useEffect,useRef,useState,useSyncExternalStore}=React
  let spriteModule,spriteAttempt=0
  function apply(ctx){
    let snapshot=null,stream=null,disposed=false,connectionGeneration=0,firstStreamState=true,selectedSessionReady=null,clearSelection=()=>{},syncMenuTheme=()=>{},menuThemeSample=null
    const listeners=new Set()
    const adopt=next=>{if(!disposed&&(!snapshot||next.revision>=snapshot.revision)){snapshot=next;for(const fn of listeners)fn()}}
    const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
    const get=()=>snapshot
    const call=async(endpoint,payload={})=>{
      const generation=connectionGeneration;let r
      try{r=await ctx.connection.rpc.call('/api','kujira-pet/'+endpoint,payload)}catch(error){
        const status=/HTTP (\d{3})/.exec(error?.message??'')?.[1]
        const next=status==='401'||status==='403'?'宿主拒绝了请求（HTTP '+status+'），请重新连接 DSH。':status==='404'?'宿主菜单接口不可用（HTTP 404），请重启 DSH 以加载插件。':status?'宿主请求失败（HTTP '+status+'），请查看 DSH 日志。':'无法连接 DSH 宿主，请确认 DSH 仍在运行。'
        throw new Error(next)
      }
      if(!r.ok)throw new Error(r.error?.message??'宿主未能完成这次设置，请查看 DSH 日志。')
      if(generation===connectionGeneration&&typeof r.value?.revision==='number'){
        const latest=snapshot&&snapshot.revision>r.value.revision?snapshot:r.value,sessionId=String(payload.sessionId??'')
        if(endpoint==='select'&&r.value.route.sessionId===sessionId&&latest.route.sessionId===sessionId){
          selectedSessionReady={sessionId,revision:r.value.revision}
          // Readiness is local state too: notify with a new reference even if SSE
          // already supplied a newer server revision. Never roll that state back.
          adopt({...latest})
        }else adopt(r.value)
      }return r.value
    }
    const usePet=()=>useSyncExternalStore(subscribe,get,get)
    void call('state').catch(()=>{})
    stream=new EventSource('/api/kujira-pet/events')
    stream.onopen=()=>{connectionGeneration++;firstStreamState=true;selectedSessionReady=null}
    stream.onmessage=event=>{try{const state=JSON.parse(event.data),first=firstStreamState;if(first){snapshot=null;firstStreamState=false}adopt(state);if(first){clearSelection();syncMenuTheme()}}catch{}}
    const css=`
      .kujira-card{border:1px solid #b8c7d344;border-radius:14px;padding:18px;display:grid;gap:14px;background:var(--surface-color,transparent);font-size:14px}
      .kujira-row{display:flex;align-items:center;justify-content:space-between;gap:18px}.kujira-row input[type=range]{width:145px}
      .kujira-row select,.kujira-card button{border:1px solid #a2aab755;border-radius:8px;padding:6px 10px;background:var(--surface-color,transparent);color:inherit}
      .kujira-small{font-size:12px;opacity:.7;line-height:1.6}.kujira-bubble{padding:13px 16px;border-radius:18px 18px 4px 18px;background:#fffdf8;color:#293849;box-shadow:0 5px 23px #26344924;border:1px solid #e6ded3;line-height:1.55;font:13px/1.55 system-ui,"Microsoft YaHei",sans-serif;min-width:190px;max-width:245px;pointer-events:auto}
      .kujira-bubble strong{font-size:15px}.kujira-usage{margin-top:8px;padding-top:7px;border-top:1px solid #e8e1d7;color:#526579;font-size:12px}.kujira-pet canvas{display:block;width:100%;user-select:none;-webkit-user-drag:none;touch-action:none}
      .kujira-bubble button{background:none;border:0;color:#64748b;padding:0 2px;cursor:pointer}
      .kujira-settings{display:grid;gap:15px;min-width:0;padding:2px 0 16px}.kujira-card{min-width:0}
      .kujira-card h3{font-size:16px;margin:0}.kujira-card h4{font-size:14px;margin:0}
      .kujira-settings .kujira-row{flex-wrap:wrap;gap:8px}.kujira-settings .kujira-row select{max-width:100%}
      .kujira-folder{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #a2aab733}
      .kujira-folder:first-child{border-top:0}.kujira-folder-info{min-width:0;flex:1}.kujira-folder-info small{display:block;font-size:11px;opacity:.65;overflow-wrap:anywhere;margin-top:3px}
      .kujira-folder button{flex-shrink:0}.kujira-folder-list{max-height:270px;overflow-y:auto;border-radius:8px}
      .kujira-folder-summary{font-size:13px;font-variant-numeric:tabular-nums}.kujira-muted{opacity:.7}
      .kujira-diary-item{display:grid;gap:14px;min-width:0}
      .kujira-diary-warning{font-size:13px;line-height:1.6;margin:0}
      .kujira-diary-directory{display:grid;gap:7px;min-width:0}.kujira-diary-directory input{box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l2,#a2aab755);border-radius:8px;padding:8px 10px;background:var(--surface-color,transparent);color:inherit;font:inherit}
      .kujira-diary-actions{display:flex;flex-wrap:wrap;gap:8px}.kujira-diary-actions button:disabled{opacity:.55}
      .kujira-diary-directory input:focus-visible{outline:2px solid var(--dsw-alias-label-primary,currentColor);outline-offset:2px}
    `
    const style=document.createElement('style');style.textContent=css;document.head.appendChild(style)
    function RouteBinder({getDirectory,sessionId,selection}){
      const pet=usePet(),selected=useSyncExternalStore(selection.subscribe,selection.getSnapshot,selection.getSnapshot)
      return selected.key===sessionId?h(ModelFollower,{directory:getDirectory(),sessionId,selection}):null
    }
    function ModelFollower({directory,sessionId,selection}){
      const state=useSyncExternalStore(directory.store.subscribe,directory.store.getSnapshot,directory.store.getSnapshot)
      const pet=usePet();const current=state.current
      useEffect(()=>{void directory.load().catch(()=>{})},[directory])
      useEffect(()=>{
        const update=()=>{if(document.visibilityState!=='hidden'&&document.hasFocus()&&selection.getSnapshot().key===sessionId)void call('diary-front',{provider:current?.provider??'',model:current?.model??'',reasoningEffort:current?.reasoningEffort,sessionId:String(sessionId),ready:state.status==='ready'&&state.routable===true,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).catch(()=>{})}
        update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update)
        return()=>{window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)}
      },[current?.provider,current?.model,current?.reasoningEffort,state.status,state.routable,sessionId,selection,connectionGeneration])
      useEffect(()=>{
        if(!pet?.config.enabled)return
        const update=()=>{if(document.visibilityState!=='hidden'&&selection.getSnapshot().key===sessionId)void call('select',{provider:current?.provider??'',model:current?.model??'',sessionId:String(sessionId)}).catch(()=>{})}
        update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update)
        return()=>{window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)}
      },[current?.provider,current?.model,sessionId,selection,pet?.config.enabled,connectionGeneration])
      return null
    }
    function Usage({value}){return value?h('div',{className:'kujira-usage','data-kujira-usage':value.kind},h('div',null,value.title),...value.lines.map((t,i)=>h('div',{key:i},t)),...(value.windows??[]).filter(w=>w.resetAt).map((w,i)=>h('div',{key:'r'+i},`${w.label}重置：${new Date(w.resetAt).toLocaleString()}`))):null}
    function WorkStats({value}){return value?h('div',{className:'kujira-usage','data-kujira-stats':'session','aria-label':'会话工作统计'},...value.lines.map((line,i)=>h('div',{key:i},line))):null}
    function DiarySettings(){
      const [settings,setSettings]=useState(null),[directory,setDirectory]=useState(''),[busy,setBusy]=useState('load'),[error,setError]=useState(''),[notice,setNotice]=useState('')
      const mounted=useRef(false),pending=useRef(false)
      const run=async(action,task)=>{
        if(pending.current)return
        pending.current=true;setBusy(action);setError('');setNotice('')
        try{const result=await task();if(mounted.current)return result}
        catch(e){if(mounted.current)setError(e.message)}
        finally{pending.current=false;if(mounted.current)setBusy('')}
      }
      const load=()=>run('load',async()=>{const value=await call('diary-settings');if(mounted.current){setSettings(value);setDirectory(value.directory)}})
      useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false}},[])
      const save=patch=>run('save',async()=>{
        const value=await call('diary-config',patch)
        if(mounted.current){setSettings(value);if(Object.hasOwn(patch,'directory'))setDirectory(value.directory);setNotice(Object.hasOwn(patch,'directory')?'日记库已设置。':value.enabled?'AI 日记已开启。':'AI 日记已关闭。')}
      })
      const open=()=>run('open',async()=>{await call('diary-open-folder');if(mounted.current)setNotice('已请求打开日记库。')})
      const changed=!!settings&&directory.trim()!==settings.directory
      return h('section',{className:'kujira-diary-item','data-kujira-diary-settings':'true','aria-labelledby':'kujira-diary-title','aria-busy':!!busy},
        h('h4',{id:'kujira-diary-title'},'AI 日记'),
        h('label',{className:'kujira-row'},h('span',null,'启用 AI 日记'),h('input',{type:'checkbox',checked:settings?.enabled===true,disabled:!!busy||!settings,'aria-label':'启用 AI 日记','aria-describedby':'kujira-diary-warning',onChange:e=>void save({enabled:e.target.checked})})),
        h('p',{className:'kujira-diary-warning',id:'kujira-diary-warning'},'开启后会产生额外 token 消耗，消耗量不可控、无法预估。'),
        h('div',{className:'kujira-small'},'各角色在指定文件夹下拥有独立空间，自主决定何时写日记、写什么以及如何书写。'),
        h('label',{className:'kujira-diary-directory'},h('span',null,'日记库'),h('input',{type:'text',value:directory,disabled:!!busy||!settings,'aria-label':'日记库',spellCheck:false,onChange:e=>{setDirectory(e.target.value);setNotice('')}})),
        h('div',{className:'kujira-diary-actions'},
          h('button',{type:'button','aria-label':'设置日记库',disabled:!!busy||!settings||!changed||!directory.trim(),onClick:()=>void save({directory:directory.trim()})},busy==='save'?'正在保存…':'设置日记库'),
          h('button',{type:'button','aria-label':'打开日记库',title:settings?.directory,disabled:!!busy||!settings,onClick:()=>void open()},busy==='open'?'正在打开…':'打开日记库')),
        !settings?h('div',{className:'kujira-small'},busy==='load'?'正在读取日记设置…':'尚未读取日记设置。'):null,
        error?h('div',{role:'alert'},error):null,
        !settings&&!busy?h('button',{type:'button',onClick:()=>void load()},'重新读取日记设置'):null,
        notice?h('div',{className:'kujira-small',role:'status'},notice):null)
    }
    function SleepSettings(){
      const [settings,setSettings]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
      const alive=useRef(false),pending=useRef(false)
      useEffect(()=>{alive.current=true;void call('diary-settings').then(value=>{if(alive.current)setSettings(value)}).catch(e=>{if(alive.current)setError(e.message)});return()=>{alive.current=false}},[])
      const save=async enabled=>{if(pending.current)return;pending.current=true;setBusy(true);setError('');try{const value=await call('diary-config',{sleepEnabled:enabled});if(alive.current)setSettings(value)}catch(e){if(alive.current)setError(e.message)}finally{pending.current=false;if(alive.current)setBusy(false)}}
      return h('section',{className:'kujira-diary-item','data-kujira-sleep-settings':'true','aria-labelledby':'kujira-sleep-title',style:{borderTop:'1px solid #a2aab733',paddingTop:16}},
        h('h4',{id:'kujira-sleep-title'},'睡眠整理'),
        h('label',{className:'kujira-row'},h('span',null,'启用睡眠整理'),h('input',{type:'checkbox',checked:settings?.sleepEnabled===true,disabled:busy||!settings,'aria-label':'启用睡眠整理','aria-describedby':'kujira-sleep-description kujira-sleep-warning',onChange:e=>void save(e.target.checked)})),
        h('div',{className:'kujira-small',id:'kujira-sleep-description'},'仅在所有对话任务都空闲时，使用前台当前选择的同一模型，整理当前角色昨天及更早的日记。新任务开始时停止后台整理。'),
        h('p',{className:'kujira-diary-warning',id:'kujira-sleep-warning'},'会在后台自动调用 AI，产生额外 token 消耗，消耗量无法预估。'),
        settings?.sleepStatus?.phase==='error'?h('div',{role:'alert'},settings.sleepStatus.message):null,
        error?h('div',{role:'alert'},error):null)
    }
    function Settings(){
      const s=usePet(),[error,setError]=useState(''),[busy,setBusy]=useState(false)
      const [folders,setFolders]=useState(null),[folderError,setFolderError]=useState(''),[folderBusy,setFolderBusy]=useState('')
      const [folderLoading,setFolderLoading]=useState(false)
      const loadFolders=async()=>{setFolderLoading(true);setFolderError('');try{setFolders(await call('folders'))}catch(e){setFolderError(e.message)}finally{setFolderLoading(false)}}
      useEffect(()=>{let alive=true;void call('folders').then(value=>{if(alive)setFolders(value)}).catch(e=>{if(alive)setFolderError(e.message)});return()=>{alive=false}},[])
      const openFolder=async id=>{setFolderBusy(id);setFolderError('');try{await call('open-folder',{id});await loadFolders()}catch(e){setFolderError(e.message)}finally{setFolderBusy('')}}
      const bytes=n=>{if(!Number.isFinite(n))return '—';if(n<1024)return n+' B';const unit=n<1024*1024?'KB':'MB',value=n/(unit==='KB'?1024:1024*1024);return value.toLocaleString('zh-CN',{maximumFractionDigits:2})+' '+unit}
      const folderRow=item=>h('div',{className:'kujira-folder',key:item.id},
        h('div',{className:'kujira-folder-info'},h('div',null,h('strong',null,item.label),h('span',{className:'kujira-muted'},' · '+bytes(item.bytes))),h('small',{title:item.path},item.path)),
        h('button',{type:'button',disabled:!!folderBusy,onClick:()=>void openFolder(item.id),'aria-label':'打开'+item.label+'文件夹'},folderBusy===item.id?'正在打开…':'打开文件夹'))
      const visibleCharacters=(folders?.characters??[]).filter(item=>!item.hidden&&item.id!=='role:stella')
      const row=(label,control)=>h('label',{className:'kujira-row',key:label},h('span',null,label),control)
      const write=async patch=>{setBusy(true);setError('');try{await call('config',patch)}catch(e){setError(e.message)}finally{setBusy(false)}}
      const toggle=(key,label)=>row(label,h('input',{type:'checkbox',checked:s.config[key],'aria-label':label,disabled:busy,onChange:e=>void write({[key]:e.target.checked})}))
      const choice=(key,label,options)=>{const values=key==='refreshSeconds'&&!options.some(([v])=>v===String(s.config[key]))?[...options,[String(s.config[key]),'每 '+s.config[key]+' 秒']]:options;return row(label,h('select',{'aria-label':label,value:s.config[key],disabled:busy,onChange:e=>void write({[key]:key==='refreshSeconds'?Number(e.target.value):e.target.value})},...values.map(([v,t])=>h('option',{key:v,value:v},t))))}
      const range=(key,label,min,max)=>row(label,h('span',null,h('input',{'aria-label':label,type:'range',min,max,step:.05,value:s.config[key],onChange:e=>void write({[key]:Number(e.target.value)})}),h('small',{'data-kujira-scale-value':key},' '+s.config[key]+'×')))
      return h('div',{className:'kujira-settings','aria-label':'Kujira · 人设与桌宠'},
        s?h('section',{className:'kujira-card'},
          h('h3',null,'Kujira · 人设与桌宠'),
          h('div',{className:'kujira-small'},'随当前模型切换 AI 角色形象。'),
          toggle('enabled','启用桌宠'),toggle('showPet','显示桌宠形象'),
          choice('display','显示位置',[['auto','自动（Windows 桌面／其他系统页面内）'],['desktop','桌面窗口（Windows）'],['page','DSH 页面内']]),
          range('scale','角色大小',.55,1.6),range('bubbleScale','整个气泡大小',.8,1.4),
          choice('activity','活动程度',[['quiet','安静'],['normal','标准'],['lively','活泼']]),
          choice('bubble','气泡显示',[['always','常驻'],['tasks','仅工作与完成状态'],['hidden','隐藏']]),
          toggle('reducedMotion','减少动态'),toggle('sound','完成与出错提示音'),toggle('showUsage','显示余额或套餐余量'),toggle('showStats','显示工作统计'),
          choice('refreshSeconds','余额刷新',[['0','仅切换模型／任务结束／手动刷新'],['60','每分钟'],['300','每五分钟']]),
          h('button',{type:'button',disabled:busy,onClick:()=>void write({x:null,y:null,pageRight:null,pageBottom:null,desktopX:null,desktopY:null})},'重置桌宠位置'),
          row('当前形象',h('span',null,s.route.name+(s.route.model?' · '+s.route.model:''))),
          s.nativeError?h('div',{role:'status'},s.nativeError):null,
          s.config.enabled&&s.config.showUsage?h(React.Fragment,null,h(Usage,{value:s.usage}),h('button',{type:'button',disabled:busy,onClick:async()=>{setBusy(true);try{await call('refresh')}catch(e){setError(e.message)}finally{setBusy(false)}}},'刷新当前余额／套餐')):null,
          h('div',{className:'kujira-small'},'账户凭据仍在 DSH 原有账户设置中管理。'),
          error?h('div',{role:'alert'},error):null):h('section',{className:'kujira-card'},'正在读取 Kujira 设置…'),
        h('section',{className:'kujira-card'},
          h('h3',null,'世界观与人物档案'),
          h('div',{className:'kujira-small'},'打开本机文件夹查看各角色资料和记忆；尺寸为文件夹在磁盘上的实际文件大小。'),
          folders?h('div',{className:'kujira-folder-summary'},h('strong',null,'档案总计：'+bytes(folders.totalBytes)),h('div',{className:'kujira-small'},folders.groups.map(g=>g.label+' '+bytes(g.bytes)).join(' · '))):null,
          h('button',{type:'button',disabled:folderLoading||!!folderBusy,onClick:()=>void loadFolders()},folderLoading?'正在统计…':'刷新文件夹大小'),
          folders?h('div',null,...folders.groups.map(folderRow)):h('div',{className:'kujira-small'},'正在读取档案目录…'),
          folders?h('details',null,h('summary',null,'所有角色档案（'+visibleCharacters.length+'）'),h('div',{className:'kujira-folder-list'},...visibleCharacters.map(folderRow))):null,
          folderError?h('div',{role:'alert'},folderError):null,
          h('div',{className:'kujira-small'},'修改世界观、人物性格、记忆、模型绑定或档案存放位置，请在 DSH 对话中告诉 AI；这里用于查看与打开目录。')),
        h('section',{className:'kujira-card','aria-labelledby':'kujira-experiments-title'},h('h3',{id:'kujira-experiments-title'},'实验性功能'),h(DiarySettings),h(SleepSettings)))
    }
    function Sprite({state,controls}){
      const canvas=useRef(null),renderer=useRef(null),current=useRef(state),[ready,setReady]=useState(false)
      const failed=useRef(false),[retry,setRetry]=useState(0),[loadError,setLoadError]=useState(false)
      current.current=state
      useEffect(()=>{
        let closed=false,view=null;const abort=new AbortController();failed.current=false;setReady(false);setLoadError(false)
        const module=spriteModule??=import('/api/kujira-pet/sprite-canvas.js'+(spriteAttempt?'?retry='+spriteAttempt:'')).catch(error=>{spriteModule=null;spriteAttempt++;throw error})
        void Promise.all([module,fetch('/api/kujira-pet/art?id='+encodeURIComponent(state.route.art),{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('Animation manifest unavailable');return r.json()})]).then(async([runtime,art])=>{
          if(closed)return
          if(!art)throw new Error('Animation manifest unavailable')
          view=new runtime.SpriteCanvas(canvas.current,art.manifest,art.urls);renderer.current=view;controls.current=view
          view.update(current.current.task,current.current.config,current.current.route.sessionId)
          await view.ready
          if(!closed)setReady(true)
        }).catch(()=>{if(!closed){failed.current=true;setLoadError(true)}view?.dispose();if(renderer.current===view)renderer.current=null;if(controls.current===view)controls.current=null})
        return()=>{closed=true;abort.abort();view?.dispose();if(renderer.current===view)renderer.current=null;if(controls.current===view)controls.current=null}
      },[state.route.art,connectionGeneration,retry])
      // Retry a failed load only on a subsequent user/task transition, never on a timer.
      useEffect(()=>{if(failed.current){failed.current=false;setRetry(value=>value+1)}},[state.route.model,state.route.sessionId,state.task.phase,state.task.activity])
      useEffect(()=>renderer.current?.update(state.task,state.config,state.route.sessionId),[state])
      return h('div',{style:{position:'relative',aspectRatio:'320 / 380'}},
        h('canvas',{ref:canvas,width:320,height:380,'aria-label':state.route.name+' 动画桌宠',style:{visibility:ready?'visible':'hidden'}}),
        loadError?h('button',{type:'button',style:{pointerEvents:'auto'},onClick:()=>{failed.current=false;setRetry(value=>value+1)}},'重试加载动画'):null)
    }
    function Pet(){
      const s=usePet(),[position,setPosition]=useState(null),[leader,setLeader]=useState(!navigator.locks),[viewport,setViewport]=useState(()=>[window.innerWidth,window.innerHeight])
      const root=useRef(null),bubbleElement=useRef(null),[extent,setExtent]=useState({width:190,height:226}),[bubbleSize,setBubbleSize]=useState({width:277,height:100}),[menu,setMenu]=useState(null),[menuError,setMenuError]=useState('')
      const anchorInitialized=useRef(false),drag=useRef(null),controls=useRef(null),previous=useRef('idle'),previousPulse=useRef(null),audio=useRef(null)
      const enabled=!!s?.config.enabled&&s.renderer==='page'
      useEffect(()=>{if(!enabled)return;let release,aborted=false;const abort=new AbortController();if(!navigator.locks){setLeader(true);return()=>setLeader(false)}
      if(navigator.locks)void Promise.resolve().then(()=>navigator.locks.request('kujira-one-page-pet',{signal:abort.signal},async()=>{if(aborted)return;setLeader(true);await new Promise(r=>{release=r});setLeader(false)})).catch(()=>{if(!aborted&&!abort.signal.aborted)setLeader(true)});return()=>{aborted=true;abort.abort();release?.();setLeader(false)}},[enabled])
      useEffect(()=>{const phase=s?.task.phase,pulse=s?.task.pulse,temporaryError=pulse?.kind==='error'&&pulse.id!==previousPulse.current;if(enabled&&s.config.sound&&((previous.current!==phase&&['completed','error'].includes(phase))||temporaryError)){try{const Audio=window.AudioContext??window.webkitAudioContext;const a=audio.current??=new Audio(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.onended=()=>{o.disconnect();g.disconnect()};o.frequency.value=phase==='completed'?660:330;g.gain.setValueAtTime(.035,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.15);o.start();o.stop(a.currentTime+.16)}catch{}}previous.current=phase??'idle';previousPulse.current=pulse?.id??null},[s?.task.phase,s?.task.pulse?.id,enabled,s?.config.sound])
      useEffect(()=>{if(!enabled)return;const resize=()=>setViewport([window.innerWidth,window.innerHeight]);resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[enabled])
      const selectionReady=selectedSessionReady
      const savedAnchor=s?.config.pageRight!=null&&s?.config.pageBottom!=null?{right:s.config.pageRight,bottom:s.config.pageBottom}:null
      const anchor=position??savedAnchor
      useEffect(()=>{anchorInitialized.current=false;setPosition(savedAnchor)},[s?.config.x,s?.config.y,s?.config.pageRight,s?.config.pageBottom])
      useEffect(()=>()=>{void audio.current?.close()},[])
      const showPet=s?.config.showPet!==false,bubble=!!s&&s.config.bubble!=='hidden'&&(s.config.bubble==='always'||s.task.phase!=='idle')
      useEffect(()=>{
        if(!enabled||!leader)return
        const measure=()=>{
          if(bubbleElement.current){const el=bubbleElement.current;setBubbleSize(old=>old.width===el.offsetWidth&&old.height===el.offsetHeight?old:{width:el.offsetWidth,height:el.offsetHeight})}
          if(root.current){
            const rect=root.current.getBoundingClientRect();setExtent(old=>old.width===rect.width&&old.height===rect.height?old:{width:rect.width,height:rect.height})
            // Persisted x/y are legacy root top-left coordinates. Once the bubble is
            // measured, keep its visible bottom-right in memory so text cannot move the pet.
            const el=bubbleElement.current
            if(!anchorInitialized.current&&!savedAnchor&&selectionReady?.sessionId&&selectionReady.sessionId===s.route.sessionId&&s.revision>=selectionReady.revision&&s.config.x!=null&&(!bubble||el&&el.offsetWidth===bubbleSize.width&&el.offsetHeight===bubbleSize.height)){
              anchorInitialized.current=true;const next={right:rect.left+rect.width,bottom:rect.top+rect.height};setPosition(next)
              // Use readiness captured by this render, not a newly resolved global value.
              // Empty startup selection has no canonical session layout to migrate.
              // The existing select response completes initial history hydration.
              // Migrate once afterwards, never on subsequent text/size changes.
              void call('config',{pageRight:next.right,pageBottom:next.bottom}).catch(error=>setMenuError(error.message))
            }
          }
        }
        measure();const observer=new ResizeObserver(measure)
        if(root.current)observer.observe(root.current)
        if(bubbleElement.current)observer.observe(bubbleElement.current)
        return()=>observer.disconnect()
      },[enabled,leader,showPet,bubble,s?.config.scale,s?.config.bubbleScale,s?.config.x,s?.config.y,s?.config.pageRight,s?.config.pageBottom,selectionReady,bubbleSize.width,bubbleSize.height,viewport[0],viewport[1]])
      useEffect(()=>{const d=drag.current;drag.current=null;if(d?.moved&&d.sprite)controls.current?.endDrag();if(!enabled||!leader){setMenu(null);setMenuError('')}},[enabled,leader,showPet,bubble])
      if(!enabled||!leader)return null
      const availableHeight=Math.min(viewport[1],anchor?.bottom??viewport[1])
      const width=190*s.config.scale
      const clamp=p=>({x:Math.max(0,Math.min(p.x,viewport[0]-extent.width)),y:Math.max(0,Math.min(p.y,viewport[1]-extent.height))})
      const pos=anchor?{x:anchor.right-extent.width,y:anchor.bottom-extent.height}:(s.config.x!=null?{x:s.config.x,y:s.config.y??20}:null)
      const down=e=>{if(e.button!==0||drag.current||e.target.closest?.('button'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const rect=root.current.getBoundingClientRect();drag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false,sprite:e.currentTarget.dataset.kujiraDrag==='sprite'}}
      const move=e=>{const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!d.moved&&Math.abs(dx)+Math.abs(dy)>3){d.moved=true;if(d.sprite)controls.current?.startDrag()}if(!d.moved)return;const pos=clamp({x:d.left+dx,y:d.top+dy});d.position=pos;setPosition({right:pos.x+extent.width,bottom:pos.y+extent.height})}
      const finish=(e,cancel=false)=>{const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.moved){if(d.sprite)controls.current?.endDrag();if(d.position)void call('config',{...d.position,pageRight:d.position.x+extent.width,pageBottom:d.position.y+extent.height}).catch(error=>setMenuError(error.message))}else if(!cancel&&d.sprite){const rect=e.currentTarget.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height;controls.current?.interact(y<.45?'head_pat':x>.72&&y>.55?'tail':'poke')}}
      const handlers={onPointerDown:down,onPointerMove:move,onPointerUp:e=>finish(e),onPointerCancel:e=>finish(e,true),onLostPointerCapture:e=>finish(e,true)}
      const writeMenu=async patch=>{setMenu(null);setMenuError('');try{await call('config',patch)}catch(error){setMenuError(error.message)}}
      const select=id=>{const patch=id==='pet'?{showPet:!showPet}:id==='bubble'?{bubble:s.config.bubble==='hidden'?s.config.bubbleBeforeHidden:'hidden'}:{enabled:false};void writeMenu(patch)}
      return h(React.Fragment,null,
        showPet||bubble?h('div',{ref:root,className:'kujira-pet','data-kujira-pet':'single','data-persona':s.route.persona,'data-phase':s.task.phase,onContextMenu:e=>{e.preventDefault();e.stopPropagation();setMenu({x:e.clientX,y:e.clientY})},style:{position:'fixed',zIndex:900,display:'flex',flexDirection:'column',alignItems:'flex-end',...(anchor?{right:viewport[0]-Math.max(Math.min(extent.width,viewport[0]),Math.min(anchor.right,viewport[0])),bottom:viewport[1]-Math.max(Math.min(extent.height,viewport[1]),Math.min(anchor.bottom,viewport[1]))}:pos?{left:clamp(pos).x,top:clamp(pos).y}:{right:Math.min(22,Math.max(0,viewport[0]-extent.width)),bottom:Math.min(18,Math.max(0,viewport[1]-extent.height))}),pointerEvents:'none'}},
          bubble?h('div',{style:{position:'relative',width:bubbleSize.width*s.config.bubbleScale,height:bubbleSize.height*s.config.bubbleScale}},
            h('div',{ref:bubbleElement,className:'kujira-bubble','data-kujira-drag':'bubble',...handlers,style:{position:'absolute',bottom:0,right:0,transform:'scale('+s.config.bubbleScale+')',transformOrigin:'bottom right',boxSizing:'border-box',minWidth:0,width:277,maxWidth:viewport[0]/s.config.bubbleScale,maxHeight:Math.max(0,(availableHeight-(showPet?width*380/320:0))/s.config.bubbleScale),overflowY:'auto',overflowWrap:'anywhere',cursor:'grab',touchAction:'none'},'aria-live':'polite'},
              h('div',{style:{display:'flex',justifyContent:'space-between',gap:8}},h('strong',null,s.route.name),h('button',{'aria-label':'全部关闭',onClick:()=>void writeMenu({enabled:false})},'×')),
              h('div',null,s.task.text),s.task.progress?h('div',null,`${s.task.progress.done} / ${s.task.progress.total} 项`):null,
              s.config.showStats&&s.task.phase!=='idle'?h(WorkStats,{value:s.stats}):null,h(Usage,{value:s.usage}))):null,
          showPet?h('div',{'data-kujira-drag':'sprite',...handlers,style:{width,pointerEvents:'auto',cursor:drag.current?'grabbing':'grab',touchAction:'none'}},h(Sprite,{state:s,controls})):null):null,
        menuError?h('div',{role:'alert','data-kujira-menu-error':'',style:{position:'fixed',left:16,bottom:16,zIndex:1200,maxWidth:'min(420px, calc(100vw - 32px))',padding:'12px 16px',borderRadius:12,background:'var(--dsw-alias-bg-base)',color:'var(--dsw-alias-label-primary)',border:'1px solid var(--dsw-alias-border-l1)',pointerEvents:'auto'}},menuError,h('button',{type:'button',onClick:()=>setMenuError(''),style:{marginLeft:10},'aria-label':'关闭提示'},'关闭提示')):null,
        h(Menu,{open:!!menu,anchor:null,portal:true,getAnchorRect:()=>new DOMRect(menu?.x??0,menu?.y??0,0,0),items:[{id:'pet',label:showPet?'隐藏桌宠':'显示桌宠'},{id:'bubble',label:s.config.bubble==='hidden'?'显示气泡':'隐藏气泡'},{id:'close',label:'全部关闭'}],onSelect:select,onClose:()=>setMenu(null)}))
    }

    // Non-interactive public primitives only: a real Menu would install keyboard handlers.
    function MenuThemeSample(){
      const sample=useRef(null)
      useEffect(()=>{const node=sample.current;node.inert=true;menuThemeSample=node;syncMenuTheme();return()=>{if(menuThemeSample===node)menuThemeSample=null}},[])
      return h('div',{ref:sample,'aria-hidden':true,'data-kujira-menu-sample':'',style:{position:'fixed',left:-10000,top:0,visibility:'hidden',pointerEvents:'none'}},
        h(MenuSurface,{style:{visibility:'hidden',padding:4,minWidth:144,boxSizing:'border-box','--dsw-elevation-stroke-color':'var(--dsw-alias-border-l1)',boxShadow:'var(--dsw-elevation-prominent)'}},h(MenuItemButton,{onSelect:()=>{}},'菜单样式')))
    }

    // Read the host's resolved public menu tokens after ThemePresenter updates body.
    // WPF adapts the public primitives' resolved geometry and palette, not arbitrary CSS effects.
    ctx.inject(['theme'],scope=>{
      let frame,queued=null,sending=false,closed=false
      const send=async theme=>{queued=theme;if(sending)return;sending=true;try{while(queued&&!closed){const next=queued;queued=null;await call('menu-theme',next).catch(()=>{})}}finally{sending=false}}
      const sync=()=>{if(closed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
        const surface=menuThemeSample?.querySelector('[data-menu-material]'),item=menuThemeSample?.querySelector('[role=menuitem]');if(!surface||!item)return
        const probe=document.createElement('span'),canvas=document.createElement('canvas');canvas.width=canvas.height=1
        const paint=canvas.getContext('2d');if(!paint)return
        probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none';document.body.appendChild(probe)
        const color=token=>{probe.style.color='var('+token+')';return getComputedStyle(probe).color}
        const solid=(base,overlay)=>{paint.clearRect(0,0,1,1);paint.fillStyle=base;paint.fillRect(0,0,1,1);if(overlay){paint.fillStyle=overlay;paint.fillRect(0,0,1,1)}return '#'+Array.from(paint.getImageData(0,0,1,1).data).slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('')}
        try{
          const surfaceStyle=getComputedStyle(surface),itemStyle=getComputedStyle(item)
          const background=solid(color('--dsw-alias-bg-base'),getComputedStyle(surface.firstElementChild).backgroundColor),foreground=solid(background,itemStyle.color)
          const edges=(style,prefix,suffix='')=>['Top','Right','Bottom','Left'].map(edge=>parseFloat(style[prefix+edge+suffix])||0)
          const radii=el=>{const style=getComputedStyle(el),rect=el.getBoundingClientRect(),length=(value,size)=>parseFloat(value)*(value.endsWith('%')?size/100:1);return ['TopLeft','TopRight','BottomRight','BottomLeft'].map(corner=>{const parts=style['border'+corner+'Radius'].split(' ');return Math.min(length(parts[0],rect.width),length(parts[1]??parts[0],rect.height))})}
          // Official Menu adds 4px inset/min-width 144px to MenuSurface. Its border
          // is the zero-offset elevation hairline, not a CSS border-width.
          const shadows=surfaceStyle.boxShadow.split(/,(?![^()]*\))/),stroke=shadows.map(value=>value.includes('inset')?[]:(value.match(/-?[\d.]+px/g)??[]).map(parseFloat)).find(values=>values.length>=4&&values.slice(0,3).every(value=>value===0))?.[3]??0
          const geometry={surfaceRadius:radii(surface),surfacePadding:edges(surfaceStyle,'padding'),surfaceBorderWidth:edges(surfaceStyle,'border','Width').map(value=>value+Math.max(0,stroke)),surfaceMinWidth:parseFloat(surfaceStyle.minWidth)||0,itemRadius:radii(item),itemPadding:edges(itemStyle,'padding'),itemMinHeight:parseFloat(itemStyle.minHeight)||0,fontFamily:itemStyle.fontFamily,fontSize:parseFloat(itemStyle.fontSize),fontWeight:itemStyle.fontWeight==='bold'?700:parseFloat(itemStyle.fontWeight)||400,lineHeight:parseFloat(itemStyle.lineHeight)||item.firstElementChild.getBoundingClientRect().height}
          void send({background,foreground,border:solid(background,color('--dsw-alias-border-l1')),hover:solid(background,color('--dsw-alias-interactive-bg-hover')),hoverForeground:foreground,geometry})
        }catch{}finally{probe.remove()}
      })}
      const observer=new MutationObserver(sync);observer.observe(document.body,{attributes:true,attributeFilter:['style','class','data-ds-dark-theme']})
      const styles=new MutationObserver(sync);styles.observe(document.head,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','media','disabled']});document.head.addEventListener('load',sync,true)
      const visible=()=>{if(document.visibilityState!=='hidden')sync()}
      syncMenuTheme=sync;sync();scope.on('theme/change',sync);document.addEventListener('visibilitychange',visible)
      scope.effect(()=>()=>{closed=true;queued=null;observer.disconnect();styles.disconnect();document.head.removeEventListener('load',sync,true);cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visible);if(syncMenuTheme===sync)syncMenuTheme=()=>{}})
    })
    ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'kujira-persona',order:85,label:'Kujira · 人设',inject:()=>({})},Settings))
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'kujira-menu-theme-sample',order:0,inject:()=>({})},MenuThemeSample))
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'kujira-one-pet',order:900},Pet))
    ctx.inject(['modelDirectories','sessions','remote','remote.session','uiSession'],scope=>{
      const selection=scope.uiSession.adapter.current
      const clear=()=>{if(selection.getSnapshot().key===undefined&&document.visibilityState!=='hidden'){void call('select',{provider:'',model:'',sessionId:''}).catch(()=>{});void call('diary-front',{}).catch(()=>{})}}
      clearSelection=clear;const off=selection.subscribe(clear);clear();window.addEventListener('focus',clear);document.addEventListener('visibilitychange',clear)
      scope.on('dispose',()=>{if(clearSelection===clear)clearSelection=()=>{};off();window.removeEventListener('focus',clear);document.removeEventListener('visibilitychange',clear)})
      return scope.slots.inject('conversation.input.overlay',()=>scope.slots.register({name:'conversation.input.overlay',id:'kujira-model-follow',order:990,inject:sessionId=>({sessionId,selection,getDirectory:()=>scope.modelDirectories.directoryFor(sessionId)})},RouteBinder))
    })
    ctx.effect(()=>()=>{disposed=true;stream?.close();listeners.clear();style.remove()})
  }
  return {name:'kujira-pet-client',inject:['slots','connection','sessions','remote','remote.session'],apply}
}})


