import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {settings} from '../../pet/model.js'
const code=await readFile(process.env.PET_CLIENT??new URL('../../pet/client.js',import.meta.url),'utf8')
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
function harness(enabled=true,overrides={}){
 const slots=new Map(),effects=new Map(),calls=[],directories=new Map(),injects=[];let plugin,active,source,revision=1,current={key:'s-0'},state={config:settings({enabled,...overrides}),route:{sessionId:'s-0'},revision:1}
 const listeners=new Set(),selection={getSnapshot:()=>current,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}}
 function target(){const map=new Map();return{addEventListener:(name,fn)=>{if(!map.has(name))map.set(name,new Set());map.get(name).add(fn)},removeEventListener:(name,fn)=>map.get(name)?.delete(fn),emit:name=>{for(const fn of map.get(name)??[])fn()}}}
 const window=target(),document={...target(),visibilityState:'visible',hasFocus:()=>true,head:{appendChild(){}},createElement:()=>({remove(){}})}
 const React={createElement:(type,props,...children)=>({type,props,children}),useRef:value=>({current:value}),useState:value=>[typeof value==='function'?value():value,()=>{}],useSyncExternalStore:(_subscribe,get)=>get(),useEffect:(fn,deps)=>{const index=active.cursor++,prev=active.hooks[index];if(!prev||deps?.some((v,i)=>v!==prev.deps?.[i])){prev?.cleanup?.();active.pending.push(()=>{active.hooks[index]={deps,cleanup:fn()}})}}}
 function render(component,props,key){const item=effects.get(key)??{hooks:[],cursor:0,pending:[]};effects.set(key,item);active=item;item.cursor=0;item.pending=[];const out=component(props);for(const effect of item.pending)effect();active=null;return out}
 function directory(id){if(!directories.has(id))directories.set(id,{store:{subscribe:()=>()=>{},getSnapshot:()=>({status:'ready',routable:true,current:{provider:'fixture',model:id==='s-0'?'gpt':'claude',reasoningEffort:'high'}})},load:async()=>{}});return directories.get(id)}
 const ctx={slots:{inject:(_name,fn)=>fn(),register:(spec,component)=>slots.set(spec.id,{spec,component})},connection:{rpc:{call:async(_api,endpoint,payload)=>{calls.push({endpoint,payload});if(endpoint==='kujira-pet/select')state={...state,route:payload,revision:++revision};return{ok:true,value:state}}}},uiSession:{adapter:{current:selection}},modelDirectories:{directoryFor:directory},inject:(deps,fn)=>{injects.push(deps);return fn(ctx)},on:()=>()=>{}}
 class EventSource{constructor(){source=this}close(){}}
 window.__ModuleLoader__={load:entry=>{plugin=entry.factory(name=>{if(name==='@deepseek-ai/dsh-client-ui-primitives')return {Menu:()=>null};assert.equal(name,'react');return React})}}
 vm.runInNewContext(code,{window,document,EventSource,AbortController,navigator:{},console,setTimeout,clearTimeout,MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{}})
 plugin.apply(ctx)
 const mount=(id,key=id)=>{const slot=slots.get('kujira-model-follow'),props=slot.spec.inject(id),child=render(slot.component,props,'binder-'+key);if(child)render(child.type,child.props,'follower-'+key);return child}
 return{calls,mount,renderSettings:()=>render(slots.get('kujira-persona').component,{},'settings'),injects,source:()=>source,window,document,setSelection:key=>{current={key};for(const fn of listeners)fn()},state:()=>state}
}
test('main selection owns all 50 simultaneously mounted overlay occurrences and focus/visibility updates',async()=>{
 const h=harness();await tick();for(let i=0;i<50;i++)h.mount('s-'+i);await tick()
 assert.deepEqual(h.calls.filter(x=>x.endpoint==='kujira-pet/select').map(x=>x.payload.sessionId),['s-0'])
 h.setSelection('s-23');h.mount('s-23');await tick();h.calls.length=0
 // The old instance intentionally remains mounted here (embedded occurrence / stale cleanup).
 h.window.emit('focus');h.document.emit('visibilitychange');await tick()
 assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/select').every(x=>x.payload.sessionId==='s-23'),true)
 assert.equal(h.state().route.sessionId,'s-23');assert.equal(h.state().route.model,'claude')
})
test('no selected Session clears stale work, including after returning from a hidden document',async()=>{
 const h=harness();await tick();h.mount('s-0');await tick();h.calls.length=0;h.document.visibilityState='hidden';h.setSelection(undefined);await tick();assert.equal(h.calls.length,0)
 h.document.visibilityState='visible';h.window.emit('focus');await tick();assert.equal(h.state().route.sessionId,'');assert.equal(h.state().route.model,'')
})
test('SSE reconnect resets revision and reselects the same authoritative current Session',async()=>{
 const h=harness();await tick();h.mount('s-0');await tick();h.calls.length=0
 h.source().onopen();h.source().onmessage({data:JSON.stringify({config:{enabled:true},route:{sessionId:''},revision:0})});h.mount('s-0');await tick()
 assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/select').length,1);assert.equal(h.state().route.sessionId,'s-0')
})
test('SSE reconnect without a selected Session clears a stale server route once, not every frame',async()=>{
 const h=harness();await tick();h.setSelection(undefined);await tick();h.calls.length=0
 h.source().onopen();h.source().onmessage({data:JSON.stringify({config:{enabled:true},route:{sessionId:'other-window'},revision:0})});await tick()
 assert.equal(h.state().route.sessionId,'');assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/select').length,1)
 h.source().onmessage({data:JSON.stringify({config:{enabled:true},route:{sessionId:''},revision:1})});await tick();assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/select').length,1)
})

test('Diary current-model follower stays active when the pet is disabled, without select readiness',async()=>{
 const h=harness(false);await tick();h.mount('s-0');await tick()
 assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/select').length,0)
 const calls=h.calls.filter(x=>x.endpoint==='kujira-pet/diary-front');assert.equal(calls.length,1)
 const p=calls[0].payload;assert.equal(p.provider,'fixture');assert.equal(p.model,'gpt');assert.equal(p.reasoningEffort,'high');assert.equal(p.sessionId,'s-0');assert.equal(p.ready,true);assert.equal(typeof p.timeZone,'string')
 h.setSelection(undefined);await tick();const clear=h.calls.filter(x=>x.endpoint==='kujira-pet/diary-front').at(-1);assert.equal(Object.keys(clear.payload).length,0)
})
test('only the selected focused visible page supplies the background diary route',async()=>{
 const h=harness(false);await tick();h.document.hasFocus=()=>false;h.mount('s-0');await tick();assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/diary-front').length,0)
 h.document.hasFocus=()=>true;h.window.emit('focus');await tick();assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/diary-front').length,1)
 h.calls.length=0;h.document.visibilityState='hidden';h.document.emit('visibilitychange');await tick();assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/diary-front').length,0)
})

test('custom scale labels show the true saved value without writing back slider bounds',async()=>{
 const h=harness(true,{scale:2,bubbleScale:0.2,refreshSeconds:1800});await tick();const tree=h.renderSettings();await tick();const nodes=[];const visit=n=>{if(!n||typeof n!=='object')return;nodes.push(n);n.children?.flat(Infinity).forEach(visit)};visit(tree)
 const scales=nodes.filter(n=>n.props?.['data-kujira-scale-value']);assert.equal(scales.find(n=>n.props['data-kujira-scale-value']==='scale').children[0],' 2×');assert.equal(scales.find(n=>n.props['data-kujira-scale-value']==='bubbleScale').children[0],' 0.2×')
 assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/config').length,0);const slider=nodes.find(n=>n.type==='input'&&n.props['aria-label']==='角色大小');assert.equal(slider.props.value,2);slider.props.onChange({target:{value:'1.25'}});await tick();assert.equal(h.calls.filter(x=>x.endpoint==='kujira-pet/config').at(-1).payload.scale,1.25)
 assert(nodes.some(n=>n.type==='option'&&n.props.value==='1800'))
})
