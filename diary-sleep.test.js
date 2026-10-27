import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {createRequire} from 'node:module'
import {openDiary} from './daily-diary.js'
import {applyDiarySleep,collectResponse} from './diary-sleep.js'
const require=createRequire(process.env.DSH_TEST_ROOT?resolve(process.env.DSH_TEST_ROOT,'package.json'):import.meta.url)
const {Context}=await import(require.resolve('@deepseek-ai/cordis'))
const {AgentRegistry}=await import(require.resolve('@deepseek-ai/dsh-agent'))
const {LlmRuntime,LlmAdapter}=await import(require.resolve('@deepseek-ai/dsh-llm'))
const {default:SessionStore}=await import(require.resolve('@deepseek-ai/dsh-session'))
const {scopeTarget}=await import(require.resolve('@deepseek-ai/dsh-scope'))
const role={id:'gpt',label:'GPT'}
async function settled(sleep){await new Promise(r=>setImmediate(r));while(['checking','running'].includes(sleep.snapshot().phase))await new Promise(r=>setTimeout(r,1))}
class Adapter extends LlmAdapter{
 seen=[];failOnce=false;noTools=false;pause=false;started=Promise.withResolvers();aborted=false
 resolveModel(provider,model){return{provider,id:model,name:model,reasoning:{efforts:[{id:'high',name:'High'}],defaultEffort:'high'}}}
 async *stream(options){
  this.seen.push(structuredClone({...options,signal:undefined}));this.started.resolve()
  if(this.failOnce){this.failOnce=false;throw Error('temporary network failure')}
  if(this.noTools){yield{type:'text-delta',index:0,text:'stopped'};yield{type:'finish',reason:{kind:'stop'}};return}
  if(this.pause){await new Promise(resolve=>options.signal.addEventListener('abort',resolve,{once:true}));this.aborted=true;options.signal.throwIfAborted()}
  const list=JSON.parse(options.messages[0].content[0].text.split('清单：\n')[1]),id=list[0].id
  const results=options.messages.filter(m=>m.role==='tool')
  const tool=results.length===0?{name:'sleep_read',args:{id}}:results.length===1?{name:'sleep_write',args:{id,text:'AI freely chose this memory',tags:['own choice']}}:null
  if(tool){yield{type:'tool-call-delta',index:0,id:'call-'+results.length,name:tool.name,argumentsDelta:JSON.stringify(tool.args)};yield{type:'finish',reason:{kind:'tool-calls'}}}
  else{yield{type:'text-delta',index:0,text:'done'};yield{type:'finish',reason:{kind:'stop'}}}
 }
}
async function fixture({old=true,today=false}={}){
 const home=await mkdtemp(join(tmpdir(),'sleep-private-')),dir=join(home,'diaries/gpt/long');await mkdir(dir,{recursive:true})
 if(old)await writeFile(join(dir,'2026-10-24.md'),'PRIVATE OLD BODY\n')
 if(today)await writeFile(join(dir,'2026-10-26.md'),'PRIVATE TODAY BODY\n')
 const diary=openDiary({home,timeZone:'UTC',now:()=>new Date('2026-10-26T12:00:00Z')});await diary.ready
 const ctx=new Context(),fibers=[];for(const plugin of [AgentRegistry,SessionStore,LlmRuntime]){const f=ctx.plugin(plugin);await f;fibers.push(f)}
 const adapter=new Adapter(),unregister=ctx.llm.registerAdapter(['fixture'],adapter),catalog={resolve:async()=>role,subscribe:()=>()=>{}}
 const sleep=applyDiarySleep(ctx,{diary,catalog,personaContext:async()=> 'ROLE PERSONA'})
 const select=()=>sleep.select({provider:'fixture',model:'exact-front-model',reasoningEffort:'high',sessionId:'front',ready:true,timeZone:'UTC'})
 return{home,ctx,diary,adapter,sleep,catalog,select,close:async()=>{sleep.dispose();unregister();for(const f of fibers.reverse())await f.dispose()}}
}
test('real DSH llm fixture: list first, role tools read/write, exact front model, sleep-only enabled, zero chat messages',async()=>{
 const f=await fixture({today:true});try{await f.diary.configure({sleepEnabled:true});await f.select();await settled(f.sleep);assert.equal(f.diary.settings().enabled,false);assert.equal(f.adapter.seen.length,3)
 for(const request of f.adapter.seen){assert.equal(request.provider,'fixture');assert.equal(request.model,'exact-front-model');assert.equal(request.reasoningEffort,'high')}
 const first=f.adapter.seen[0];assert.equal(JSON.stringify(first.messages).includes('PRIVATE OLD BODY'),false);assert.equal(JSON.stringify(first.messages).includes('PRIVATE TODAY BODY'),false);assert.match(first.messages[0].content[0].text,/需要整理.*长期记忆/);assert.deepEqual(first.tools.map(t=>t.name),['sleep_read','sleep_write'])
 assert.ok(JSON.stringify(f.adapter.seen[1].messages).includes('PRIVATE OLD BODY'));assert.equal(JSON.stringify(f.adapter.seen).includes('PRIVATE TODAY BODY'),false)
 assert.equal((await f.diary.pendingSleep(role)).length,0);assert.equal(f.ctx.sessions.list().length,0);assert.equal(f.ctx.agents.list().length,0)
 const saved=await readFile(join(f.home,'diaries/gpt/sleep/2026-10-24.md'),'utf8');assert.match(saved,/AI freely chose/);assert.match(saved,/源 long\/2026-10-24.md/)
 await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,3,'no changes means no repeated model call')
 }finally{await f.close()}
})
test('no old/changed work means zero model preparation/requests, including today-only data',async()=>{const f=await fixture({old:false,today:true});try{await f.diary.configure({sleepEnabled:true});await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,0)}finally{await f.close()}})
test('any other role running or queued blocks sleep; front arrival aborts only the auxiliary call',async()=>{
 const f=await fixture();const agent={id:'another-role',session:{id:'another-role'},status:'running',inbox:{hasPending:false},whenIdle:async()=>{}}
 const detach=f.ctx.agents.enter(agent,undefined)
 try{await f.diary.configure({sleepEnabled:true});await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,0)
 agent.status='idle';agent.inbox.hasPending=true;f.ctx.emit(scopeTarget(agent,agent),'agent/status',{agent,status:'idle'});await settled(f.sleep);assert.equal(f.adapter.seen.length,0)
 agent.inbox.hasPending=false;f.adapter.pause=true;f.ctx.emit(scopeTarget(agent,agent),'agent/status',{agent,status:'idle'});await f.adapter.started.promise
 agent.status='running';f.ctx.emit(scopeTarget(agent,agent),'agent/status',{agent,status:'running'});await settled(f.sleep);assert.equal(f.adapter.aborted,true);assert.equal(agent.status,'running');assert.equal((await f.diary.pendingSleep(role)).length,1)
 }finally{detach();await f.close()}
})
test('model change while asynchronous role resolution is pending is not a lost wake',async()=>{
 const f=await fixture();let release;const gate=new Promise(r=>{release=r}),entered=Promise.withResolvers();let first=true
 f.catalog.resolve=async()=>{if(first){first=false;entered.resolve();await gate}return role}
 try{await f.diary.configure({sleepEnabled:true});await f.select();await entered.promise;await f.sleep.select({provider:'fixture',model:'new-front-model',reasoningEffort:'high',sessionId:'front',ready:true});release();await settled(f.sleep);assert.ok(f.adapter.seen.length>0);assert.ok(f.adapter.seen.every(r=>r.model==='new-front-model'))}finally{release();await f.close()}
})
test('collector handles block-end-only output and exact tool arguments without duplicate delta text',async()=>{const signal=new AbortController().signal;async function* stream(){yield{type:'text-delta',index:0,text:'pre'};yield{type:'block-end',index:0,block:{type:'text',text:'complete'}};yield{type:'block-end',index:1,block:{type:'tool-call',id:'x',name:'sleep_read',arguments:'{"id":"listed"}'}};yield{type:'finish',reason:{kind:'tool-calls'}}}const r=await collectResponse(stream(),signal);assert.equal(r.blocks[0].text,'complete');assert.equal(r.blocks[1].arguments,'{"id":"listed"}')})

test('one transient model failure is not blacklisted: next normal event retries without an immediate busy loop',async()=>{const f=await fixture();try{await f.diary.configure({sleepEnabled:true});await settled(f.sleep);f.adapter.failOnce=true;await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,1);assert.equal(f.sleep.snapshot().phase,'error');await new Promise(r=>setTimeout(r,30));assert.equal(f.adapter.seen.length,1);await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,4);assert.equal((await f.diary.pendingSleep(role)).length,0)}finally{await f.close()}})
test('foreground pause resumes on idle with pending content preserved',async()=>{const f=await fixture(),agent={id:'front-test',session:{id:'front-test'},status:'idle',inbox:{hasPending:false},whenIdle:async()=>{}};const detach=f.ctx.agents.enter(agent,undefined);try{await f.diary.configure({sleepEnabled:true});f.adapter.pause=true;await f.select();await f.adapter.started.promise;agent.status='running';f.ctx.emit(scopeTarget(agent,agent),'agent/status',{agent,status:'running'});await settled(f.sleep);assert.equal((await f.diary.pendingSleep(role)).length,1);f.adapter.pause=false;agent.status='idle';f.ctx.emit(scopeTarget(agent,agent),'agent/status',{agent,status:'idle'});await settled(f.sleep);assert.equal((await f.diary.pendingSleep(role)).length,0)}finally{detach();await f.close()}})
test('natural source list has no size gate; unchanged no-progress batch waits for a source change',async()=>{const f=await fixture();try{await writeFile(join(f.home,'diaries/gpt/long/2026-10-24.md'),['X'.repeat(13000),...Array.from({length:9},(_,i)=>'paragraph '+i)].join('\n\n'));f.adapter.noTools=true;await f.diary.configure({sleepEnabled:true});await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,1);const list=JSON.parse(f.adapter.seen[0].messages[0].content[0].text.split('清单：\n')[1]);assert.equal(list.length,10);assert.equal(list[0].characters,13000);assert.ok(!JSON.stringify(f.adapter.seen[0].messages).includes('X'.repeat(20)));await new Promise(r=>setTimeout(r,30));assert.equal(f.adapter.seen.length,1);await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,1);await writeFile(join(f.home,'diaries/gpt/long/2026-10-24.md'),'changed source');await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,2)}finally{await f.close()}})

test('missing role watcher is rebuilt on next ordinary event without a poll',async()=>{const f=await fixture({old:false});try{let watches=0,available=false,notify;f.diary.watchOwn=async(_entry,fn)=>{watches++;if(!available)return null;notify=fn;return()=>{}};await f.diary.configure({sleepEnabled:true});await f.select();await settled(f.sleep);const absentWatches=watches;available=true;await f.select();await settled(f.sleep);assert.ok(watches>absentWatches);const activeWatches=watches;notify('watch-error');await f.select();await settled(f.sleep);assert.ok(watches>activeWatches);assert.equal(f.adapter.seen.length,0)}finally{await f.close()}})

test('unstarted discarded LLM stream is not a permanent busy lock',async()=>{const f=await fixture();try{const control=new AbortController(),unused=f.ctx.llm.stream({provider:'fixture',model:'other',messages:[],signal:control.signal});control.abort();await unused.return?.();await f.diary.configure({sleepEnabled:true});await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,3);assert.equal((await f.diary.pendingSleep(role)).length,0)}finally{await f.close()}})
test('actual outside LLM iteration blocks sleep and its completed cancellation resumes it',async()=>{const f=await fixture(),control=new AbortController();try{f.adapter.pause=true;const stream=f.ctx.llm.stream({provider:'fixture',model:'other',messages:[],signal:control.signal});const outside=(async()=>{for await(const _ of stream){}})();await f.adapter.started.promise;await f.diary.configure({sleepEnabled:true});await f.select();await settled(f.sleep);assert.equal(f.adapter.seen.length,1);f.adapter.pause=false;control.abort();await outside;await settled(f.sleep);assert.equal(f.adapter.seen.length,4);assert.equal((await f.diary.pendingSleep(role)).length,0)}finally{control.abort();await f.close()}})
