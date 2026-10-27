import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
const code=await readFile(new URL('../../pet/client.js',import.meta.url),'utf8')
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function harness({fetcher,readyFor=()=>Promise.resolve()}={}){
 let cursor=0,dirty=false,tree;const hooks=[],pending=[],fetches=[],views=[];const controls={current:null}
 const React={createElement:(type,props,...children)=>({type,props:props??{},children}),useRef:value=>{const i=cursor++;return hooks[i]??={current:value}},useState:value=>{const i=cursor++;hooks[i]??={value:typeof value==='function'?value():value};return[hooks[i].value,next=>{const v=typeof next==='function'?next(hooks[i].value):next;if(!Object.is(v,hooks[i].value)){hooks[i].value=v;dirty=true}}]},useEffect:(fn,deps)=>{const i=cursor++,old=hooks[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps?.[j]))){pending.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()}})}},useSyncExternalStore:(_s,get)=>get()}
 class SpriteCanvas{constructor(_canvas,manifest){this.manifest=manifest;this.disposed=false;this.ready=readyFor(views.length);views.push(this)}update(task,_config,session){this.task=task;this.session=session}dispose(){this.disposed=true}}
 const window={TEST_runtime:{SpriteCanvas},__ModuleLoader__:{load:e=>{const plugin=e.factory(name=>name==='react'?React:{Menu:()=>null});plugin.apply(ctx)}}}
 const document={head:{appendChild(){}},createElement:()=>({remove(){}})}
 const ctx={effect:setup=>setup(),connection:{rpc:{call:async()=>({ok:true,value:{revision:0,route:{sessionId:''},config:{}}})}},slots:{inject:()=>{}},inject:()=>{},on:()=>{}}
 const fetch=async(url,options)=>{fetches.push({url,options});return fetcher?fetcher(url,options,fetches.length):{ok:true,json:async()=>({manifest:{role:new URL(url,'http://qa').searchParams.get('id')},urls:{}})}}
 const instrumented=code.replace("import('/api/kujira-pet/sprite-canvas.js'+(spriteAttempt?'?retry='+spriteAttempt:''))",'Promise.resolve(window.TEST_runtime)').replace('    function Pet(){','    window.TEST_Sprite=Sprite\n    function Pet(){')
 vm.runInNewContext(instrumented,{window,document,EventSource:class{},AbortController,navigator:{},fetch,console,setTimeout,clearTimeout})
 let current={route:{art:'minimax',model:'m1',sessionId:'s1'},task:{phase:'thinking',signal:1},config:{}}
 function render(patch){if(patch)current={...current,...patch};let loops=0;do{dirty=false;cursor=0;tree=window.TEST_Sprite({state:current,controls});tree.children[0].props.ref.current={};while(pending.length)pending.shift()();assert(++loops<20)}while(dirty);return tree}
 return{render,views,fetches,controls,state:()=>current,visible:()=>tree.children[0].props.style.visibility,dispose:()=>{for(const h of hooks)h?.cleanup?.()}}
}
test('one image-load failure retries on the next real action, not on a timer or every healthy frame',async()=>{
 const h=harness({readyFor:n=>n===0?Promise.reject(Error('image unavailable')):Promise.resolve()})
 try{h.render();await tick();h.render();assert.equal(h.visible(),'hidden');assert.equal(h.fetches.length,1)
  h.render({task:{phase:'thinking',signal:99}});await tick();h.render();assert.equal(h.fetches.length,1,'same-action signals do not loop retries')
  h.render({task:{phase:'responding',signal:2}});await tick();h.render();assert.equal(h.fetches.length,2);assert.equal(h.visible(),'visible')
  h.render({task:{phase:'completed',signal:3}});await tick();h.render();assert.equal(h.fetches.length,2)
 }finally{h.dispose()}
})
test('a temporary manifest failure can retry on a same-art model/session change',async()=>{
 const h=harness({fetcher:async(_url,_options,n)=>n===1?{ok:false}:{ok:true,json:async()=>({manifest:{role:'minimax'},urls:{}})}})
 try{h.render();await tick();h.render();assert.equal(h.visible(),'hidden');h.render({route:{art:'minimax',model:'m2',sessionId:'s2'}});await tick();h.render();assert.equal(h.fetches.length,2);assert.equal(h.visible(),'visible')}finally{h.dispose()}
})
test('late failed or successful old-role loading cannot replace the new role',async()=>{
 const old=deferred();const h=harness({readyFor:n=>n===0?old.promise:Promise.resolve()})
 try{h.render();await tick();h.render();h.render({route:{art:'claude',model:'m2',sessionId:'s2'}});await tick();h.render();assert.equal(h.visible(),'visible');assert.equal(h.controls.current.manifest.role,'claude');assert.equal(h.views[0].disposed,true)
  old.reject(Error('late old image failure'));await tick();h.render();assert.equal(h.controls.current.manifest.role,'claude');assert.equal(h.visible(),'visible')
  h.render({task:{phase:'responding',signal:2}});await tick();h.render();assert.equal(h.fetches.length,2,'old failure must not schedule a new-role retry')
 }finally{h.dispose()}
})

test('failed sprite offers a manual same-state retry and removes it after recovery',async()=>{
 const h=harness({readyFor:n=>n===0?Promise.reject(Error('temporary')):Promise.resolve()})
 try{
  h.render();await tick();const failed=h.render();assert.equal(h.visible(),'hidden');assert.equal(h.fetches.length,1)
  const button=failed.children.find(n=>n?.type==='button');assert(button);assert.equal(button.children[0],'重试加载动画')
  button.props.onClick();h.render();await tick();const recovered=h.render();assert.equal(h.fetches.length,2);assert.equal(h.visible(),'visible');assert(!recovered.children.some(n=>n?.type==='button'))
 }finally{h.dispose()}
})
