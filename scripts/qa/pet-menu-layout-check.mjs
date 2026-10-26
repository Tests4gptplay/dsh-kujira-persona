import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {settings} from '../../pet/model.js'
import {PetController} from '../../pet/controller.js'
const code=await readFile(process.env.KUJIRA_CLIENT_TEST_FILE??new URL('../../pet/client.js',import.meta.url),'utf8')
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve()}
// Component/geometry harness, not a browser paint or Windows desktop test.
function harness(config={},backend=null,initialHeight=120,locks){
 const slots=new Map(),calls=[],hooks=[],pending=[],events=new Map(),observers=new Set();let cursor=0,dirty=true,tree,plugin,source,selectResponse=null,bubbleHeight=initialHeight
 let state={revision:1,renderer:'page',config:settings({enabled:true,...config}),route:{name:'GPT',persona:'gpt',art:'gpt',sessionId:'qa'},task:{phase:'working',text:'Work'}}
 const Menu=()=>null,Fragment=Symbol('Fragment')
 const React={Fragment,createElement:(type,props,...children)=>({type,props:props??{},children}),useSyncExternalStore:(_s,get)=>get(),useRef:value=>{const i=cursor++;return hooks[i]??=( {current:value})},useState:value=>{const i=cursor++;hooks[i]??={value:typeof value==='function'?value():value};return[hooks[i].value,next=>{const v=typeof next==='function'?next(hooks[i].value):next;if(v!==hooks[i].value){hooks[i].value=v;dirty=true}}]},useEffect:(fn,deps)=>{const i=cursor++,old=hooks[i];if(!old||!deps||deps.some((v,j)=>!Object.is(v,old.deps?.[j]))){hooks[i]={deps};pending.push(()=>{old?.cleanup?.();hooks[i].cleanup=fn()})}}}
 const window={innerWidth:900,innerHeight:700,addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k)}
 const document={visibilityState:'visible',head:{appendChild(){}},createElement:()=>({remove(){}}),addEventListener(){},removeEventListener(){}}
 const ctx={slots:{inject:(_n,fn)=>fn(),register:(spec,component)=>slots.set(spec.id,component)},connection:{rpc:{call:async(_a,endpoint,payload)=>{calls.push({endpoint,payload});if(endpoint==='kujira-pet/select'&&selectResponse)return selectResponse;if(endpoint==='kujira-pet/config'&&backend){const result=await backend(payload);if(!result.ok)return result;state={...state,config:result.value.config,revision:result.value.revision};dirty=true;return{ok:true,value:state}}if(endpoint==='kujira-pet/config'){state={...state,revision:state.revision+1,config:settings({...state.config,...payload})};dirty=true}return{ok:true,value:state}}}},inject:()=>{},on:()=>{}}
 class EventSource{constructor(){source=this}close(){}}
 class ResizeObserver{constructor(fn){this.fn=fn;observers.add(this)}observe(){}disconnect(){observers.delete(this)}}
 window.__ModuleLoader__={load:e=>{plugin=e.factory(name=>name==='react'?React:{Menu})}}
 vm.runInNewContext(code.replace('const usePet=',"window.TEST_get=get;window.TEST_subscribe=subscribe;window.TEST_ready=()=>selectedSessionReady;window.TEST_select=(sessionId='qa')=>call('select',{sessionId});const usePet="),{window,document,navigator:{locks},EventSource,ResizeObserver,AbortController,DOMRect:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height})}},setTimeout,clearTimeout,console})
 plugin.apply(ctx);let lastSnapshot=window.TEST_get();window.TEST_subscribe(()=>{const next=window.TEST_get();if(next!==lastSnapshot){lastSnapshot=next;dirty=true}})
 const nodes=()=>{const all=[];const visit=n=>{if(!n||typeof n!=='object')return;all.push(n);n.children?.forEach(visit)};visit(tree);return all}
 const find=(key,value)=>nodes().find(n=>n.props[key]===value)
 function render(){
  let loops=0
  do{dirty=false;cursor=0;tree=slots.get('kujira-one-pet')();
   const root=find('data-kujira-pet','single'),bubble=find('data-kujira-drag','bubble'),sprite=find('data-kujira-drag','sprite')
   if(bubble)bubble.props.ref.current={offsetWidth:270,offsetHeight:bubbleHeight}
   if(root){const width=Math.max(bubble?270*state.config.bubbleScale:0,sprite?sprite.props.style.width:0),height=(bubble?bubbleHeight*state.config.bubbleScale:0)+(sprite?sprite.props.style.width*380/320:0);root.props.ref.current={getBoundingClientRect:()=>({left:root.props.style.left??window.innerWidth-width-(root.props.style.right??22),top:root.props.style.top??window.innerHeight-height-(root.props.style.bottom??18),width,height})}}
   while(pending.length)pending.shift()()
   assert(++loops<20,'render loop')
  }while(dirty)
  return tree
 }
 const update=patch=>{state={...state,...patch,revision:state.revision+1};source.onmessage({data:JSON.stringify(state)});dirty=true;render()}
 const menu=()=>nodes().find(n=>n.type===Menu)
 const drag=(kind,dx,dy,button=0,finish=true)=>{const node=find('data-kujira-drag',kind);assert(node);const capture=new Set(),target={dataset:{kujiraDrag:kind},setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id),getBoundingClientRect:()=>({left:0,top:0,width:190,height:226})};const event={button,pointerId:1,clientX:5,clientY:5,target:{closest:()=>null},currentTarget:target,preventDefault(){}};node.props.onPointerDown(event);node.props.onPointerMove({...event,clientX:5+dx,clientY:5+dy});if(finish)node.props.onPointerUp({...event,clientX:5+dx,clientY:5+dy});render()}
 return{calls,find,menu,render,drag,async rejectedSelect(){selectResponse={ok:false,error:{message:'test select unavailable'}};try{await window.TEST_select()}finally{selectResponse=null}},async staleSelect(id='qa',responseRoute=state.route){selectResponse={ok:true,value:{...state,route:responseRoute,revision:state.revision-1}};dirty=false;await window.TEST_select(id);selectResponse=null;return dirty},selectionReady:()=>window.TEST_ready(),state:()=>state,update,async ready(select=true){await tick();if(select)await window.TEST_select();render()},async selected(id='qa'){await window.TEST_select(id);render()},async selectedBeforeCommit(height){await window.TEST_select();for(const observer of [...observers])observer.fn();bubbleHeight=height;render()},async select(id){menu().props.onSelect(id);await tick();render()},resize(w,h){window.innerWidth=w;window.innerHeight=h;events.get('resize')();render()},height(h){bubbleHeight=h;render();for(const observer of [...observers])observer.fn();render()}}
}
test('settings preserve old defaults and the tasks bubble policy across hide/show',async()=>{
 assert.equal(settings({}).showPet,true)
 const c=new PetController({config:{enabled:true,bubble:'tasks'},resolvePersona:()=>({}),queryUsage:async()=>null})
 await c.configure({bubble:'hidden'});assert.equal(c.config.bubbleBeforeHidden,'tasks')
 await c.configure({bubble:c.config.bubbleBeforeHidden});assert.equal(c.config.bubble,'tasks');c.dispose()
})
test('host Menu has exactly three actions; right-click opens without a drag; close is settings-only',async()=>{
 const h=harness();await h.ready();const root=h.find('data-kujira-pet','single')
 root.props.onContextMenu({clientX:899,clientY:699,preventDefault(){},stopPropagation(){}});h.render()
 const menu=h.menu().props;assert.equal(menu.open,true);assert.equal(menu.portal,true);assert.deepEqual(Array.from(menu.items,x=>x.id),['pet','bubble','close']);assert.equal(menu.getAnchorRect().x,899)
 const count=h.calls.length;h.drag('sprite',20,30,2);assert.equal(h.calls.length,count)
 menu.onClose();h.render();assert.equal(h.menu().props.open,false)
 await h.select('close');assert.equal(h.state().config.enabled,false);assert.equal(h.find('data-kujira-pet','single'),undefined)
})
test('bubble-only drag reaches exact viewport bottom, with no sprite node, including scale/text changes',async()=>{
 const h=harness({x:100,y:100});await h.ready();await h.select('pet');assert.equal(h.find('data-kujira-drag','sprite'),undefined)
 h.drag('bubble',0,1000);await tick();h.render();assert.equal(h.state().config.y,700-120)
 h.update({config:settings({...h.state().config,bubbleScale:1.4})});h.height(200);h.drag('bubble',0,1000);await tick();h.render();assert.equal(h.state().config.y,700-280)
 h.resize(500,400);h.drag('bubble',1000,1000);await tick();h.render();assert.equal(h.state().config.x,500-270*1.4);assert.equal(h.state().config.y,400-280)
 await h.select('pet');const style=h.find('data-kujira-pet','single').props.style;assert.equal(style.bottom,0);assert.equal(style.right,0)
})
test('both hidden remove the entire overlay, restore through settings, and preserve tasks preference',async()=>{
 const h=harness({bubble:'tasks'});await h.ready();await h.select('bubble');assert.equal(h.state().config.bubbleBeforeHidden,'tasks');await h.select('bubble');assert.equal(h.state().config.bubble,'tasks')
 await h.select('pet');await h.select('bubble');assert.equal(h.find('data-kujira-pet','single'),undefined)
 h.update({config:settings({...h.state().config,showPet:true})});assert(h.find('data-kujira-drag','sprite'));assert.equal(h.find('data-kujira-drag','bubble'),undefined)
})
test('task-mode idle removes bubble space and restores it when selected task changes',async()=>{
 const h=harness({showPet:false,bubble:'tasks'});await h.ready();h.update({task:{phase:'idle',text:'Idle'}});assert.equal(h.find('data-kujira-pet','single'),undefined)
 h.update({task:{phase:'working',text:'Another session'}});assert(h.find('data-kujira-drag','bubble'));h.height(300);h.drag('bubble',0,1000);await tick();assert.equal(h.state().config.y,400)
})

test('task visibility interruption clears stale pointer drag before the bubble returns',async()=>{
 const h=harness({showPet:false,bubble:'tasks'});await h.ready();h.drag('bubble',20,20,0,false)
 h.update({task:{phase:'idle',text:'Idle'}});h.update({task:{phase:'working',text:'Back'}})
 h.drag('bubble',0,1000);await tick();assert.equal(h.state().config.y,580)
})

test('actual controller save failure is visible beside the three-item menu; success clears it',async()=>{
 const c=new PetController({config:{enabled:true,showUsage:false},resolvePersona:()=>({}),queryUsage:async()=>null,persist:async()=>{const e=new Error('private filesystem path');e.code='ENOSPC';throw e}})
 const backend=async patch=>{try{return{ok:true,value:await c.configure(patch)}}catch(e){return{ok:false,error:{code:e.code,message:e.message}}}}
 const h=harness({},backend);await h.ready()
 for(const id of ['pet','bubble','close']){await h.select(id);const alert=h.find('role','alert');assert(alert);assert.match(alert.children[0],/磁盘空间不足/);assert.equal(h.menu().props.items.length,3);assert.equal(h.state().config.enabled,true)}
 c.persist=async()=>{};await h.select('pet');assert.equal(h.find('role','alert'),undefined);assert.equal(h.state().config.showPet,false);c.dispose()
})
test('host transport failures show a safe actionable classification without request secrets',async()=>{
 const h=harness({},async()=>{throw new Error('transport failure for /api/kujira-pet/config?token=private-secret: HTTP 403')});await h.ready();await h.select('close')
 const message=h.find('role','alert').children[0];assert.match(message,/HTTP 403/);assert.match(message,/重新连接 DSH/);assert(!message.includes('private-secret'))
})

const bounds=h=>h.find('data-kujira-pet','single').props.ref.current.getBoundingClientRect()
const bottom=h=>{const b=bounds(h);return b.top+b.height}
test('legacy position migrates once after measurement; dynamic text preserves bottom and never writes',async()=>{
 const h=harness({x:100,y:100});await h.ready();await tick();h.render();const initial=bounds(h),foot=bottom(h)
 assert.equal(initial.left,100);assert.equal(initial.top,100)
 assert.equal(h.state().config.pageBottom,foot);assert.equal(h.state().config.pageRight,370)
 const writes=()=>h.calls.filter(c=>c.endpoint==='kujira-pet/config').length
 assert.equal(writes(),1);h.height(172);await tick();h.render();assert.equal(bottom(h),foot);assert.equal(bounds(h).top,48)
 h.height(120);assert.equal(bottom(h),foot);assert.equal(writes(),1)
 const reloaded=harness(h.state().config,null,172);await reloaded.ready();assert.equal(bottom(reloaded),foot);assert.equal(reloaded.calls.filter(c=>c.endpoint==='kujira-pet/config').length,0)
})
test('drag stores both anchors and compatible top-left; reload and reset preserve intended semantics',async()=>{
 const h=harness();await h.ready();h.drag('bubble',-120,-100);await tick();h.render();const c=h.state().config,foot=bottom(h),r=bounds(h)
 assert.equal(c.x,r.left);assert.equal(c.y,r.top);assert.equal(c.pageBottom,foot)
 const reloaded=harness(c,null,172);await reloaded.ready();assert.equal(bottom(reloaded),foot)
 reloaded.update({config:settings({...c,x:null,y:null,pageRight:null,pageBottom:null})});assert.equal(reloaded.find('data-kujira-pet','single').props.style.bottom,18)
})
test('migration save failure is visible once and does not retry on text updates',async()=>{
 const h=harness({x:50,y:50},async()=>({ok:false,error:{message:'设置文件无法保存：磁盘空间不足'}}));await h.ready();await tick();h.render()
 assert.match(h.find('role','alert').children[0],/磁盘空间不足/)
 h.height(172);await tick();h.render();assert.equal(h.calls.filter(c=>c.endpoint==='kujira-pet/config').length,1)
})

test('real controller persists new page anchors alongside untouched native coordinates',async()=>{
 let saved;const c=new PetController({config:{enabled:true,x:20,y:30,desktopX:41,desktopY:42},resolvePersona:()=>({}),queryUsage:async()=>null,persist:async next=>{saved=next}})
 await c.configure({pageRight:500,pageBottom:600});assert.equal(saved.pageRight,500);assert.equal(saved.pageBottom,600);assert.equal(saved.x,20);assert.equal(saved.y,30);assert.equal(saved.desktopX,41);assert.equal(saved.desktopY,42)
 await c.configure({x:null,y:null,pageRight:null,pageBottom:null});assert.equal(saved.pageRight,null);assert.equal(saved.pageBottom,null);assert.equal(saved.desktopX,41);c.dispose()
})

test('legacy migration waits for actual select completion, not an initial short idle bubble',async()=>{
 const h=harness({x:542,y:122.375},null,125);await h.ready(false)
 assert.equal(h.state().config.pageBottom,null);assert.equal(h.calls.filter(c=>c.endpoint==='kujira-pet/config').length,0)
 h.height(179);await h.selected();await tick();h.render()
 assert.equal(h.state().config.pageBottom,122.375+179+225.625);assert.equal(bounds(h).top,122.375)
 assert.equal(h.calls.filter(c=>c.endpoint==='kujira-pet/config').length,1)
 h.height(125);assert.equal(bottom(h),527);h.height(179);assert.equal(bottom(h),527)
})

test('old ResizeObserver cannot consume select readiness before hydrated DOM commits',async()=>{
 const h=harness({x:542,y:122.375},null,125);await h.ready(false)
 await h.selectedBeforeCommit(179);await tick();h.render()
 assert.equal(h.state().config.pageBottom,527);assert.equal(bounds(h).top,122.375)
 assert.equal(h.calls.filter(c=>c.endpoint==='kujira-pet/config').length,1)
})

test('startup empty selection cannot migrate before the actual selected session hydrates',async()=>{
 const h=harness({x:542,y:122.375},null,125);await h.ready(false)
 h.update({route:{name:'星璃',persona:'stella',art:'stella',sessionId:''}});await h.selected('');await tick();h.render()
 assert.equal(h.state().config.pageBottom,null);assert.equal(h.calls.filter(c=>c.endpoint==='kujira-pet/config').length,0)
 h.update({route:{name:'MiniMax',persona:'minimax',art:'minimax',sessionId:'qa'}});h.height(179);await h.selected();await tick();h.render()
 assert.equal(h.state().config.pageBottom,527);assert.equal(bounds(h).top,122.375)
 assert.equal(h.calls.filter(c=>c.endpoint==='kujira-pet/config').length,1)
})

test('late select response explicitly notifies readiness without reverting newer SSE state',async()=>{
 const h=harness({x:542,y:122.375},null,179);await h.ready(false)
 h.update({task:{phase:'completed',text:'SSE already finished'}});const revision=h.state().revision
 assert.equal(await h.staleSelect(),true,'ready must notify even when server response is older than SSE')
 h.render();await tick();h.render();assert.equal(h.state().config.pageBottom,527);assert(h.state().revision>=revision);assert.equal(h.state().task.text,'SSE already finished')
})
test('late wrong-session response cannot replace readiness of the current session',async()=>{
 const h=harness();await h.ready();const ready=h.selectionReady()
 await h.staleSelect('old-session',{...h.state().route,sessionId:'old-session'});assert.equal(h.selectionReady(),ready)
})

test('missing or rejected select does not block display, drag/config, or later recovery',async()=>{
 const h=harness({x:120,y:90});await h.ready(false)
 assert(h.find('data-kujira-drag','sprite'));assert(h.find('data-kujira-drag','bubble'));assert.equal(h.selectionReady(),null)
 await assert.rejects(h.rejectedSelect(),/test select unavailable/);h.render()
 assert(h.find('data-kujira-pet','single'));assert.equal(h.state().config.pageBottom,null)
 h.drag('bubble',25,35);await tick();h.render()
 assert.notEqual(h.state().config.pageBottom,null);assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/config').length,1)
 await h.selected();assert.equal(h.selectionReady().sessionId,'qa');assert(h.find('data-kujira-pet','single'))
})

test('rejected Web Locks request falls back to usable overlay without a timeout gate',async()=>{
 const h=harness({},null,120,{request:()=>Promise.reject(new Error('Lock service unavailable'))});await h.ready(false);await tick();h.render()
 assert(h.find('data-kujira-pet','single'));assert(h.find('data-kujira-drag','sprite'));h.drag('bubble',20,20);await tick();h.render();assert.notEqual(h.state().config.pageBottom,null)
})
test('normal pending Web Lock is not bypassed and acquired lock releases on disable',async()=>{
 let acquire,settled=false;const wait=new Promise(resolve=>{acquire=resolve});const locks={request:async(_name,_options,fn)=>{await wait;await fn();settled=true}}
 const h=harness({},null,120,locks);await h.ready(false);await tick();h.render();assert.equal(h.find('data-kujira-pet','single'),undefined)
 acquire();await tick();h.render();assert(h.find('data-kujira-pet','single'))
 h.update({config:settings({...h.state().config,enabled:false})});await tick();assert.equal(settled,true);assert.equal(h.find('data-kujira-pet','single'),undefined)
})

test('user 200 percent scale is not silently reduced to fit a smaller viewport',async()=>{
 const h=harness({scale:2,bubbleScale:0.2});await h.ready();h.resize(300,250);const sprite=h.find('data-kujira-drag','sprite');assert.equal(sprite.props.style.width,380);assert.equal(h.state().config.scale,2);assert.equal(h.state().config.bubbleScale,0.2)
})
