import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {resolve,join} from 'node:path'
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {openDiary} from '../../daily-diary.js'
import {applyDiarySleep} from '../../diary-sleep.js'
import {applyDiaryIntegration} from '../../diary-integration.js'
const require=createRequire(resolve(process.env.DSH_TEST_ROOT,'package.json'))
const {Context}=await import(require.resolve('@deepseek-ai/cordis'))
const {AgentRegistry}=await import(require.resolve('@deepseek-ai/dsh-agent'))
const {LlmRuntime,LlmAdapter}=await import(require.resolve('@deepseek-ai/dsh-llm'))
const {default:SessionStore}=await import(require.resolve('@deepseek-ai/dsh-session'))
const {default:SystemPrompt}=await import(require.resolve('@deepseek-ai/dsh-system-prompt'))
const {default:Tools}=await import(require.resolve('@deepseek-ai/dsh-tools'))
const role={id:'gpt',label:'GPT'},tick=()=>new Promise(r=>setImmediate(r))
const settled=async sleep=>{await tick();while(['checking','running'].includes(sleep.snapshot().phase))await tick()}
class Adapter extends LlmAdapter{
 pause=true;started=Promise.withResolvers();signal=null;calls=0
 resolveModel(provider,model){return{provider,id:model,name:model}}
 async *stream(options){
  this.calls++;this.signal=options.signal;this.started.resolve()
  if(this.pause){if(!options.signal.aborted)await new Promise(r=>options.signal.addEventListener('abort',r,{once:true}));options.signal.throwIfAborted()}
  const list=JSON.parse(options.messages[0].content[0].text.split('清单：\n')[1])
  if(!options.messages.some(m=>m.role==='tool')){
   yield{type:'tool-call-delta',index:0,id:'save',name:'sleep_write',argumentsDelta:JSON.stringify({id:list[0].id,text:'Recovered worker writes normally',tags:[]})}
   yield{type:'finish',reason:{kind:'tool-calls'}}
  }else{yield{type:'text-delta',index:0,text:'done'};yield{type:'finish',reason:{kind:'stop'}}}
 }
}
async function fixture(){
 const home=await mkdtemp(join(tmpdir(),'diary-disposal-')),dir=join(home,'diaries/gpt/long');await mkdir(dir,{recursive:true});await writeFile(join(dir,'2026-10-24.md'),'SYNTHETIC OLD DIARY\n')
 const diary=openDiary({home,timeZone:'UTC',now:()=>new Date('2026-10-26T12:00:00Z')});await diary.ready
 const ctx=new Context();for(const plugin of [AgentRegistry,SessionStore,LlmRuntime,SystemPrompt,Tools])await ctx.plugin(plugin)
 const adapter=new Adapter(),unregister=ctx.llm.registerAdapter(['fixture'],adapter)
 let subscriptions=0,watchers=0;const wrap=fn=>(...args)=>{const off=fn(...args);subscriptions++;let alive=true;return()=>{if(alive){alive=false;subscriptions--;off()}}}
 const subscribe=diary.subscribe.bind(diary),subscribeWrites=diary.subscribeWrites.bind(diary)
 diary.subscribe=wrap(subscribe);diary.subscribeWrites=wrap(subscribeWrites)
 const catalog={resolve:async()=>role,subscribe:wrap(()=>()=>{})}
 diary.watchOwn=async()=>{watchers++;let alive=true;return()=>{if(alive){alive=false;watchers--}}}
 let sleep,integration,fiber
 const mount=async()=>{fiber=ctx.plugin({name:'diary-lifecycle-fixture',inject:['systemPrompt'],apply(scope){sleep=applyDiarySleep(scope,{diary,catalog});integration=applyDiaryIntegration(scope,{diary,requests:new WeakMap(),forInvocation:async()=>({entry:role})})}});await fiber;await tick();return sleep}
 await mount()
 return{ctx,diary,adapter,home,mount,get sleep(){return sleep},get integration(){return integration},get fiber(){return fiber},get subscriptions(){return subscriptions},get watchers(){return watchers},select:()=>sleep.select({provider:'fixture',model:'same-front-model',sessionId:'front',ready:true,timeZone:'UTC'}),close:async()=>{sleep.dispose();integration.dispose();await fiber.dispose();unregister();await ctx.fiber.dispose()}}
}
test('real Cordis unload/reload releases all four external subscriptions and allows diary writes',async()=>{
 const f=await fixture();try{
  assert.equal(f.subscriptions,4);await f.fiber.dispose();assert.equal(f.subscriptions,0)
  await f.mount();assert.equal(f.subscriptions,4);await f.diary.configure({enabled:true});await tick()
  const tool=f.ctx.tools.get('ai_diary');assert.ok(tool)
  const result=await tool.execute({action:'append',text:'AFTER REMOUNT',summary:'NORMAL SUMMARY'},{agent:{id:'writer'}})
  assert.equal(result.isError,undefined);assert.match(await readFile(join(f.home,'diaries/gpt/long/2026-10-26.md'),'utf8'),/AFTER REMOUNT/)
  await f.fiber.dispose();assert.equal(f.subscriptions,0);assert.equal(f.ctx.tools.get('ai_diary'),undefined)
 }finally{await f.close()}
})
test('actual active model signal aborts on fiber unload; remounted sleep saves normally',async()=>{
 const f=await fixture();try{
  await f.diary.configure({sleepEnabled:true});await f.select();await f.adapter.started.promise
  assert.equal(f.adapter.signal.aborted,false);assert.equal(f.watchers,1)
  await f.fiber.dispose();assert.equal(f.adapter.signal.aborted,true);assert.equal(f.watchers,0);assert.equal(f.subscriptions,0)
  assert.equal((await f.diary.pendingSleep(role)).length,1)
  f.adapter.pause=false;await f.mount();await f.select();await settled(f.sleep)
  assert.equal((await f.diary.pendingSleep(role)).length,0)
  assert.match(await readFile(join(f.home,'diaries/gpt/sleep/2026-10-24.md'),'utf8'),/Recovered worker writes normally/)
 }finally{await f.close()}
})
test('watcher resolving after unload is immediately released and cannot dispatch a model call',async()=>{
 const f=await fixture(),started=Promise.withResolvers(),release=Promise.withResolvers();let live=0
 try{
  f.diary.watchOwn=async()=>{started.resolve();await release.promise;live++;return()=>{live--}}
  await f.diary.configure({sleepEnabled:true});await f.select();await started.promise
  await f.fiber.dispose();assert.equal(f.subscriptions,0);release.resolve();await tick();await tick()
  assert.equal(live,0);assert.equal(f.adapter.calls,0)
  f.diary.watchOwn=async()=>()=>{};f.adapter.pause=false;await f.mount();await f.select();await settled(f.sleep)
  assert.equal((await f.diary.pendingSleep(role)).length,0)
 }finally{release.resolve();await f.close()}
})
test('captured old tool refuses after unload; explicit off/on and remount still write normally',async()=>{
 const f=await fixture();try{
  await f.diary.configure({enabled:true});await tick();const old=f.ctx.tools.get('ai_diary');assert.ok(old)
  await f.fiber.dispose();await assert.rejects(old.execute({action:'append',text:'SHOULD NOT WRITE',summary:'x'},{agent:{id:'old'}}),/已关闭|失效/)
  await f.mount();await f.diary.configure({enabled:false});assert.equal(f.ctx.tools.get('ai_diary'),undefined)
  await f.diary.configure({enabled:true});const fresh=f.ctx.tools.get('ai_diary');assert.ok(fresh)
  await fresh.execute({action:'append',text:'REENABLED WRITE',summary:'fine'},{agent:{id:'fresh'}})
  const text=await readFile(join(f.home,'diaries/gpt/long/2026-10-26.md'),'utf8');assert.match(text,/REENABLED WRITE/);assert.doesNotMatch(text,/SHOULD NOT WRITE/)
 }finally{await f.close()}
})
