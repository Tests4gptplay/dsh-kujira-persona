window.__ModuleLoader__.load({id:'dsh-kujira-persona',factory:(require)=>{
  const React=require('react'),h=React.createElement
  const {useEffect,useRef,useState,useSyncExternalStore}=React
  function apply(ctx){
    let snapshot=null,stream=null,disposed=false
    const listeners=new Set()
    const adopt=next=>{if(!disposed&&(!snapshot||next.revision>=snapshot.revision)){snapshot=next;for(const fn of listeners)fn()}}
    const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
    const get=()=>snapshot
    const call=async(endpoint,payload={})=>{const r=await ctx.connection.rpc.call('/kujira-pet',endpoint,payload);if(!r.ok)throw new Error(r.error?.message??'暂不可用');adopt(r.value);return r.value}
    const usePet=()=>useSyncExternalStore(subscribe,get,get)
    void call('state').catch(()=>{})
    stream=new EventSource('/api/kujira-pet/events')
    stream.onmessage=event=>{try{adopt(JSON.parse(event.data))}catch{}}
    const css=`
      @keyframes kujira-breathe{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-5px) rotate(1deg)}}
      @keyframes kujira-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) rotate(-3deg)}70%{transform:translateY(-6px) rotate(3deg)}}
      .kujira-card{border:1px solid #b8c7d344;border-radius:14px;padding:18px;display:grid;gap:14px;background:var(--surface-color,transparent);font-size:14px}
      .kujira-row{display:flex;align-items:center;justify-content:space-between;gap:18px}.kujira-row input[type=range]{width:145px}
      .kujira-row select,.kujira-card button{border:1px solid #a2aab755;border-radius:8px;padding:6px 10px;background:var(--surface-color,transparent);color:inherit}
      .kujira-small{font-size:12px;opacity:.7;line-height:1.6}.kujira-bubble{padding:13px 16px;border-radius:18px 18px 4px 18px;background:#fffdf8;color:#293849;box-shadow:0 5px 23px #26344924;border:1px solid #e6ded3;line-height:1.55;font:13px/1.55 system-ui,"Microsoft YaHei",sans-serif;min-width:190px;max-width:245px;pointer-events:auto}
      .kujira-bubble strong{font-size:15px}.kujira-usage{margin-top:8px;padding-top:7px;border-top:1px solid #e8e1d7;color:#526579;font-size:12px}.kujira-pet img{display:block;width:100%;user-select:none;-webkit-user-drag:none;touch-action:none;filter:drop-shadow(0 6px 4px #24304a15)}
      .kujira-live{animation:kujira-breathe 5s ease-in-out infinite}.kujira-hop{animation:kujira-hop .65s ease-in-out 1}.kujira-bubble button{background:none;border:0;color:#64748b;padding:0 2px;cursor:pointer}
    `
    const style=document.createElement('style');style.textContent=css;document.head.appendChild(style)
    function RouteBinder({directory,sessionId}){
      const state=useSyncExternalStore(directory.store.subscribe,directory.store.getSnapshot,directory.store.getSnapshot)
      const pet=usePet();const current=state.current
      useEffect(()=>{if(pet?.config.enabled)void directory.load().catch(()=>{})},[directory,pet?.config.enabled])
      useEffect(()=>{
        if(!pet?.config.enabled||!current)return
        const update=()=>{if(document.visibilityState!=='hidden')void call('select',{provider:current.provider,model:current.model,sessionId:String(sessionId)}).catch(()=>{})}
        update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update)
        return()=>{window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)}
      },[current?.provider,current?.model,sessionId,pet?.config.enabled])
      return null
    }
    function Usage({value}){return value?h('div',{className:'kujira-usage','data-kujira-usage':value.kind},h('div',null,value.title),...value.lines.map((t,i)=>h('div',{key:i},t)),...(value.windows??[]).filter(w=>w.resetAt).map((w,i)=>h('div',{key:'r'+i},`${w.label}重置：${new Date(w.resetAt).toLocaleString()}`))):null}
    function Settings(){
      const s=usePet(),[error,setError]=useState(''),[busy,setBusy]=useState(false)
      if(!s)return h('section',{className:'kujira-card'},'正在读取桌宠设置…')
      const write=async patch=>{setBusy(true);setError('');try{await call('config',patch)}catch(e){setError(e.message)}finally{setBusy(false)}}
      const row=(label,control)=>h('label',{className:'kujira-row',key:label},h('span',null,label),control)
      const toggle=(key,label)=>row(label,h('input',{type:'checkbox',checked:s.config[key],'aria-label':label,disabled:busy,onChange:e=>void write({[key]:e.target.checked})}))
      const choice=(key,label,options)=>row(label,h('select',{'aria-label':label,value:s.config[key],disabled:busy,onChange:e=>void write({[key]:e.target.value})},...options.map(([v,t])=>h('option',{key:v,value:v},t))))
      const range=(key,label,min,max)=>row(label,h('input',{'aria-label':label,type:'range',min,max,step:.05,value:s.config[key],onChange:e=>void write({[key]:Number(e.target.value)})}))
      return h('section',{className:'kujira-card','aria-label':'Kujira 桌宠设置'},
        h('div',null,h('strong',null,'一只桌宠，随模型换形象'),h('div',{className:'kujira-small'},'桌宠可随时关闭；世界观和人设功能不受影响。')),
        toggle('enabled','启用桌宠'),
        choice('display','显示位置',[['auto','自动（Windows 桌面／其他系统页面内）'],['desktop','桌面窗口（Windows）'],['page','DSH 页面内']]),
        range('scale','角色大小',.55,1.6),range('bubbleScale','气泡大小',.8,1.4),
        choice('activity','活动程度',[['quiet','安静'],['normal','标准'],['lively','活泼']]),
        choice('bubble','气泡显示',[['always','常驻'],['tasks','仅工作与完成状态'],['hidden','隐藏']]),
        toggle('reducedMotion','减少动态'),toggle('sound','完成与出错提示音'),toggle('showUsage','显示余额或套餐余量'),
        row('当前模型',h('span',null,s.route.name+(s.route.model?' · '+s.route.model:''))),
        h('div',{className:'kujira-small'},'形象跟随当前对话的模型；后台任务不会把它换成另一个角色。同一家族各版本保持同一形象。'),
        s.nativeError?h('div',{role:'status'},s.nativeError):null,
        s.config.enabled&&s.config.showUsage?h(React.Fragment,null,h(Usage,{value:s.usage}),h('button',{type:'button',disabled:busy,onClick:async()=>{setBusy(true);try{await call('refresh')}catch(e){setError(e.message)}finally{setBusy(false)}}},'刷新当前余额／套餐')):null,
        h('div',{className:'kujira-small'},'DeepSeek 显示当前接入的余额；Codex Native 显示套餐窗口余量。凭据仍在 DSH 原有账户设置中管理。'),
        error?h('div',{role:'alert'},error):null)
    }
    function Pet(){
      const s=usePet(),[position,setPosition]=useState(null),[reaction,setReaction]=useState(false),[leader,setLeader]=useState(!navigator.locks)
      const drag=useRef(null),endTimer=useRef(null),previous=useRef('idle'),audio=useRef(null)
      const enabled=!!s?.config.enabled&&s.renderer==='page'
      useEffect(()=>{if(!enabled)return;let release,aborted=false;const abort=new AbortController();if(navigator.locks)void navigator.locks.request('kujira-one-page-pet',{signal:abort.signal},async()=>{if(aborted)return;setLeader(true);await new Promise(r=>{release=r});setLeader(false)}).catch(()=>{});return()=>{aborted=true;abort.abort();release?.();setLeader(false)}},[enabled])
      useEffect(()=>{if(enabled&&s.config.sound&&previous.current!==s.task.phase&&['completed','error'].includes(s.task.phase)){try{const Audio=window.AudioContext??window.webkitAudioContext;const a=audio.current??=new Audio(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=s.task.phase==='completed'?660:330;g.gain.setValueAtTime(.035,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.15);o.start();o.stop(a.currentTime+.16)}catch{}}previous.current=s?.task.phase??'idle'},[s?.task.phase,enabled,s?.config.sound])
      useEffect(()=>()=>{clearTimeout(endTimer.current);void audio.current?.close()},[])
      if(!enabled||!leader)return null
      const width=190*s.config.scale,bubble=s.config.bubble!=='hidden'&&(s.config.bubble==='always'||s.task.phase!=='idle')
      const pos=position??(s.config.x!=null?{x:s.config.x,y:s.config.y??20}:null)
      const down=e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);const rect=e.currentTarget.parentElement.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false}}
      const move=e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>3)d.moved=true;setPosition({x:Math.max(0,Math.min(window.innerWidth-width,d.left+dx)),y:Math.max(0,Math.min(window.innerHeight-width*1.18,d.top+dy))})}
      const up=()=>{const d=drag.current;drag.current=null;if(d?.moved&&position)void call('config',position).catch(()=>{});else if(!s.config.reducedMotion){setReaction(true);clearTimeout(endTimer.current);endTimer.current=setTimeout(()=>setReaction(false),700)}}
      return h('div',{className:'kujira-pet','data-kujira-pet':'single','data-persona':s.route.persona,'data-phase':s.task.phase,style:{position:'fixed',zIndex:900,width,...(pos?{left:Math.min(pos.x,window.innerWidth-width),top:Math.min(pos.y,window.innerHeight-width*1.18)}:{right:22,bottom:18}),pointerEvents:'none'}},
        bubble?h('div',{className:'kujira-bubble',style:{position:'absolute',bottom:'95%',right:8,fontSize:13*s.config.bubbleScale},'aria-live':'polite'},
          h('div',{style:{display:'flex',justifyContent:'space-between',gap:8}},h('strong',null,s.route.name),h('button',{'aria-label':'关闭桌宠',onClick:()=>void call('config',{enabled:false})},'×')),
          h('div',null,s.task.text),s.task.progress?h('div',null,`${s.task.progress.done} / ${s.task.progress.total} 项`):null,
          s.task.inputTokens+s.task.outputTokens>0?h('div',{className:'kujira-small'},`本轮 ${s.task.inputTokens+s.task.outputTokens} tokens`):null,h(Usage,{value:s.usage})):null,
        h('img',{src:'/api/kujira-pet/image?id='+encodeURIComponent(s.route.art),alt:s.route.name+' 桌宠',draggable:false,
          className:s.config.reducedMotion?'':reaction?'kujira-hop':'kujira-live',style:{pointerEvents:'auto',cursor:drag.current?'grabbing':'grab',animationDuration:reaction?'.65s':s.config.activity==='quiet'?'9s':s.config.activity==='lively'?'2.8s':'5s'},onPointerDown:down,onPointerMove:move,onPointerUp:up,onPointerCancel:()=>{drag.current=null}}))
    }
    ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:'dsh-kujira-persona',id:'kujira-pet-settings',order:30,inject:()=>({})},Settings))
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'kujira-one-pet',order:900},Pet))
    ctx.inject(['modelDirectories','sessions'],scope=>scope.slots.inject('conversation.input.overlay',()=>scope.slots.register({name:'conversation.input.overlay',id:'kujira-model-follow',order:990,inject:sessionId=>({sessionId,directory:scope.modelDirectories.directoryFor(sessionId)})},RouteBinder)))
    ctx.on('dispose',()=>{disposed=true;stream?.close();listeners.clear();style.remove()})
  }
  return {name:'kujira-pet-client',inject:['slots','connection'],apply}
}})
