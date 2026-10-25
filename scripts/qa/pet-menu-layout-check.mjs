import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {settings} from '../../pet/model.js'
import {PetController} from '../../pet/controller.js'
const code=await readFile(new URL('../../pet/client.js',import.meta.url),'utf8')
const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve()}
// Component/geometry harness, not a browser paint or Windows desktop test.
function harness(config={},backend=null){
 const slots=new Map(),calls=[],hooks=[],pending=[],events=new Map(),observers=new Set();let cursor=0,dirty=true,tree,plugin,source,bubbleHeight=120
 let state={revision:1,renderer:'page',config:settings({enabled:true,...config}),route:{name:'GPT',persona:'gpt',art:'gpt'},task:{phase:'working',text:'Work'}}
 const Menu=()=>null,Fragment=Symbol('Fragment')
 const React={Fragment,createElement:(type,props,...children)=>({type,props:props??{},children}),useSyncExternalStore:(_s,get)=>get(),useRef:value=>{const i=cursor++;return hooks[i]??=( {current:value})},useState:value=>{const i=cursor++;hooks[i]??={value:typeof value==='function'?value():value};return[hooks[i].value,next=>{const v=typeof next==='function'?next(hooks[i].value):next;if(v!==hooks[i].value){hooks[i].value=v;dirty=true}}]},useEffect:(fn,deps)=>{const i=cursor++,old=hooks[i];if(!old||!deps||deps.some((v,j)=>!Object.is(v,old.deps?.[j]))){hooks[i]={deps};pending.push(()=>{old?.cleanup?.();hooks[i].cleanup=fn()})}}}
 const window={innerWidth:900,innerHeight:700,addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k)}
 const document={visibilityState:'visible',head:{appendChild(){}},createElement:()=>({remove(){}}),addEventListener(){},removeEventListener(){}}
 const ctx={slots:{inject:(_n,fn)=>fn(),register:(spec,component)=>slots.set(spec.id,component)},connection:{rpc:{call:async(_a,endpoint,payload)=>{calls.push({endpoint,payload});if(endpoint==='kujira-pet/config'&&backend){const result=await backend(payload);if(!result.ok)return result;state={...state,config:result.value.config,revision:result.value.revision};dirty=true;return{ok:true,value:state}}if(endpoint==='kujira-pet/config'){state={...state,revision:state.revision+1,config:settings({...state.config,...payload})};dirty=true}return{ok:true,value:state}}}},inject:()=>{},on:()=>{}}
 class EventSource{constructor(){source=this}close(){}}
 class ResizeObserver{constructor(fn){this.fn=fn;observers.add(this)}observe(){}disconnect(){observers.delete(this)}}
 window.__ModuleLoader__={load:e=>{plugin=e.factory(name=>name==='react'?React:{Menu})}}
 vm.runInNewContext(code,{window,document,navigator:{},EventSource,ResizeObserver,AbortController,DOMRect:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height})}},setTimeout,clearTimeout,console})
 plugin.apply(ctx)
 const nodes=()=>{const all=[];const visit=n=>{if(!n||typeof n!=='object')return;all.push(n);n.children?.forEach(visit)};visit(tree);return all}
 const find=(key,value)=>nodes().find(n=>n.props[key]===value)
 function render(){
  let loops=0
  do{dirty=false;cursor=0;tree=slots.get('kujira-one-pet')();
   const root=find('data-kujira-pet','single'),bubble=find('data-kujira-drag','bubble'),sprite=find('data-kujira-drag','sprite')
   if(bubble)bubble.props.ref.current={offsetWidth:270,offsetHeight:bubbleHeight}
   if(root){const width=Math.max(bubble?270*state.config.bubbleScale:0,sprite?190*state.config.scale:0),height=(bubble?bubbleHeight*state.config.bubbleScale:0)+(sprite?190*state.config.scale*380/320:0);root.props.ref.current={getBoundingClientRect:()=>({left:root.props.style.left??900-width-22,top:root.props.style.top??700-height-18,width,height})}}
   while(pending.length)pending.shift()()
   assert(++loops<20,'render loop')
  }while(dirty)
  return tree
 }
 const update=patch=>{state={...state,...patch,revision:state.revision+1};source.onmessage({data:JSON.stringify(state)});dirty=true;render()}
 const menu=()=>nodes().find(n=>n.type===Menu)
 const drag=(kind,dx,dy,button=0,finish=true)=>{const node=find('data-kujira-drag',kind);assert(node);const capture=new Set(),target={dataset:{kujiraDrag:kind},setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id),getBoundingClientRect:()=>({left:0,top:0,width:190,height:226})};const event={button,pointerId:1,clientX:5,clientY:5,target:{closest:()=>null},currentTarget:target,preventDefault(){}};node.props.onPointerDown(event);node.props.onPointerMove({...event,clientX:5+dx,clientY:5+dy});if(finish)node.props.onPointerUp({...event,clientX:5+dx,clientY:5+dy});render()}
 return{calls,find,menu,render,drag,state:()=>state,update,async ready(){await tick();render()},async select(id){menu().props.onSelect(id);await tick();render()},resize(w,h){window.innerWidth=w;window.innerHeight=h;events.get('resize')();render()},height(h){bubbleHeight=h;render();for(const observer of [...observers])observer.fn();render()}}
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
 await h.select('pet');const style=h.find('data-kujira-pet','single').props.style;assert.equal(style.top,0);assert.equal(style.left,122)
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
