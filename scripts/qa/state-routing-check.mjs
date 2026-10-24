import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyTask,reduceTask} from '../../pet/task.js'
import {toolActivity} from '../../pet/activity.js'
import {PetController} from '../../pet/controller.js'
import {buildStandardManifest} from '../../pet/standard-manifest.js'
import {AnimationPlayer} from '../../pet/animation.js'
import {artFor} from '../../pet/art.js'
const ev=(type,data={})=>({type,data})
const start=()=>reduceTask(emptyTask(),ev('turn/start'))
const speech=(t,activity)=>reduceTask(t,ev('assistant/activity',{activity}))
const call=(t,id,name)=>reduceTask(t,ev('tool/call',{name,callId:id}))
const result=(t,id)=>reduceTask(t,ev('tool/result',{callId:id}))

test('semantic signals distinguish reasoning and visible reply without content',()=>{
 let t=start(); assert.equal(t.phase,'thinking')
 t=speech(t,'responding'); assert.equal(t.phase,'responding');assert.equal(t.text,'正在回复')
 assert.equal(speech(t,'responding'),t)
 t=speech(t,'thinking');assert.equal(t.phase,'thinking')
 assert.equal(speech(t,'invented'),t)
 assert.equal(speech(emptyTask(),'responding').phase,'idle')
})
test('tools and all concurrent approvals dominate assistant chunks',()=>{
 let t=speech(start(),'responding');t=call(t,'a','write_file');t=call(t,'b','exec_command')
 assert.equal(t.activity,'commanding');assert.equal(speech(t,'responding'),t)
 t=result(t,'b');assert.equal(t.activity,'editing');t=result(t,'a');assert.equal(t.phase,'thinking')
 t=reduceTask(t,ev('approval/asked',{id:'one'}));t=reduceTask(t,ev('approval/asked',{id:'two'}))
 assert.equal(t.phase,'waiting');assert.equal(speech(t,'responding'),t)
 t=reduceTask(t,ev('approval/decided',{id:'one'}));assert.equal(t.phase,'waiting')
 t=reduceTask(t,ev('approval/decided',{id:'two'}));assert.equal(t.phase,'thinking')
})
test('user-question tool wins and non-user notice does not dismiss it',()=>{
 let t=call(start(),'q','request_user_input');assert.equal(t.phase,'waiting')
 assert.equal(speech(t,'responding'),t)
 assert.equal(reduceTask(t,ev('user/message',{source:{kind:'workspace'}})),t)
 t=reduceTask(t,ev('user/message',{source:{kind:'user'}}));assert.equal(t.phase,'thinking')
})
test('terminal and step events reset stream semantics truthfully',()=>{
 for(const reason of ['completed','aborted','blocked','failed']){
  const ended=reduceTask(speech(start(),'responding'),ev('turn/end',{reason:{kind:reason}}))
  assert.equal(speech(ended,'responding'),ended)
 }
 const t=speech(start(),'responding'),next=reduceTask(t,ev('step/start'))
 assert.equal(next.phase,'thinking')
 assert.equal(reduceTask(next,ev('assistant/chunk')),next) // Old hosts retain compatible thinking.
})
test('tool-name token classifier does not infer command contents',()=>{
 const rows={write_stdin:'commanding',exec_command:'commanding',shell:'commanding',read_file:'searching',search_query:'searching',list_files:'searching',apply_patch:'editing',create_issue:'editing',build:'testing',lint:'testing',openai_completion:'using-tool',checkpoint:'using-tool',customMagic:'using-tool'}
 for(const [name,want] of Object.entries(rows))assert.equal(toolActivity(name),want,name)
})
test('responding and unknown tools have explicit neutral fallback, not command art',()=>{
 const clip={frames:[{sheet:'core',rect:[0,0,10,10]}],durations:[100],loop:true}
 const manifest=buildStandardManifest({canvas:[320,380],sheets:{core:'a.png'},clips:{idle:clip,commanding:clip},stateMap:{idle:'idle',working:'commanding'},workingActivityMap:{commanding:'commanding'}})
 assert.equal(manifest.stateMap.responding,'idle')
 assert.equal(manifest.workingActivityMap['using-tool'],'idle')
 assert.equal(manifest.fallbackSources.responding,'idle')
 assert.equal(manifest.fallbackSources['using-tool'],'idle')
 const player=new AnimationPlayer(manifest)
 assert.equal(player.clipFor('working','commanding'),'commanding')
 assert.equal(player.clipFor('working','using-tool'),'idle')
 assert.equal(player.clipFor('responding','responding'),'idle')
})
test('authored response and neutral tool clips replace fallback without animation engine changes',()=>{
 const clip={frames:[{sheet:'core',rect:[0,0,10,10]}],durations:[100],loop:true}
 const m=buildStandardManifest({canvas:[320,380],sheets:{core:'a.png'},clips:{idle:clip,working:clip,responding:clip,'using-tool':clip},stateMap:{idle:'idle',working:'working'}})
 assert.equal(m.stateMap.responding,'responding');assert.equal(m.workingActivityMap['using-tool'],'using-tool')
 assert.equal(m.fallbackSources.responding,undefined)
 const p=new AnimationPlayer(m);p.update({phase:'responding',activity:'responding',signal:1},{},0)
 assert.equal(p.active,'responding')
})

const session=(id='main',extra={})=>({id,header:{id,origin:'user',delegationDepth:0,...extra}})
async function controller(){const c=new PetController({config:{enabled:true,showUsage:false,showStats:false}});await c.select({provider:'openai',model:'gpt',sessionId:'main'});return c}
const open=(c,a,attempt='a',revision=1,turn=1,step=1)=>c.assistantFrame({agent:a,frame:{type:'start',attemptId:attempt,revision,turn,step}})
const chunk=(c,a,kind,revision=2,index=0,attempt='a',extra={})=>c.assistantFrame({agent:a,frame:{type:'chunk',attemptId:attempt,revision,index,chunk:{type:kind,...extra}}})
const begin=(c,s,turn=1,step=1)=>{c.event(s,ev('turn/start',{turn}));c.event(s,ev('step/start',{turn,step}))}
test('live frame sequence changes presentation once per semantic change, not token',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a)
 const rev=c.revision;chunk(c,a,'text-delta');assert.equal(c.task.phase,'responding');assert.equal(c.revision,rev+1)
 const once=c.revision;chunk(c,a,'text-delta',3,1);assert.equal(c.revision,once)
 chunk(c,a,'reasoning-delta',4,2);assert.equal(c.task.phase,'thinking')
 chunk(c,a,'text-delta',3,1);assert.equal(c.task.phase,'thinking')
 c.dispose()
})
test('live frame observer never reads text, reasoning or arguments',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a)
 const content={type:'text-delta'}
 for(const key of ['text','delta','reasoning','arguments','content'])Object.defineProperty(content,key,{get(){throw new Error('private content read')}})
 c.assistantFrame({agent:a,frame:{type:'chunk',attemptId:'a',revision:2,index:0,chunk:content}})
 assert.equal(c.task.phase,'responding');assert.ok(!JSON.stringify(c.snapshot()).includes('private'))
 c.dispose()
})
test('other sessions and delegated agents never affect selected pet',async()=>{
 const c=await controller(),s=session();begin(c,s)
 for(const other of [session('other'),session('main',{origin:'subagent'}),session('main',{delegationDepth:1})]){
  const a={session:other},before=c.revision;open(c,a);chunk(c,a,'text-delta');assert.equal(c.revision,before)
 }
 assert.equal(c.task.phase,'thinking');c.dispose()
})
test('late chunks, wrong attempts and stale turn or step starts do not revive state',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a);chunk(c,a,'text-delta')
 c.event(s,ev('turn/end',{reason:{kind:'completed'}}));chunk(c,a,'reasoning-delta',3,1);assert.equal(c.task.phase,'completed')
 begin(c,s,2,2);chunk(c,a,'text-delta',4,2);assert.equal(c.task.phase,'thinking')
 open(c,a,'old',5,1,1);chunk(c,a,'text-delta',6,0,'old');assert.equal(c.task.phase,'thinking')
 open(c,a,'new',7,2,2);chunk(c,a,'text-delta',8,0,'wrong');assert.equal(c.task.phase,'thinking')
 chunk(c,a,'text-delta',9,0,'new');assert.equal(c.task.phase,'responding');c.dispose()
})
test('settlement and retries respect actual attempt lifecycle',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a);chunk(c,a,'text-delta')
 c.assistantFrame({agent:a,frame:{type:'end',attemptId:'a',revision:3,index:1,outcome:{kind:'committed'}}})
 assert.equal(c.task.phase,'responding')
 chunk(c,a,'reasoning-delta',4,2);assert.equal(c.task.phase,'responding')
 open(c,a,'retry',5);chunk(c,a,'reasoning-delta',6,0,'retry');assert.equal(c.task.phase,'thinking')
 chunk(c,a,'text-delta',7,1,'retry')
 c.assistantFrame({agent:a,frame:{type:'end',attemptId:'retry',revision:8,index:2,outcome:{kind:'abandoned'}}})
 assert.equal(c.task.phase,'thinking');c.dispose()
})
test('new attached Agent permits reset revision; old Agent chunks remain ignored',async()=>{
 const c=await controller(),s=session(),a={session:s},replacement={session:s};begin(c,s);open(c,a);chunk(c,a,'text-delta',20,0)
 open(c,replacement,'replacement',1);chunk(c,replacement,'reasoning-delta',2,0,'replacement');assert.equal(c.task.phase,'thinking')
 chunk(c,a,'text-delta',21,1);assert.equal(c.task.phase,'thinking');c.dispose()
})
test('open tools and approval waiting dominate real stream frames',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a)
 c.event(s,ev('tool/call',{name:'exec_command',callId:'tool'}));chunk(c,a,'text-delta');assert.equal(c.task.activity,'commanding')
 c.event(s,ev('approval/asked',{id:'approval'}));chunk(c,a,'reasoning-delta',3,1);assert.equal(c.task.phase,'waiting')
 c.event(s,ev('approval/decided',{id:'approval'}));assert.equal(c.task.activity,'commanding')
 c.event(s,ev('tool/result',{callId:'tool'}));chunk(c,a,'text-delta',4,2);assert.equal(c.task.phase,'responding');c.dispose()
})
test('model changes in same session keep live task; session switches discard attempt',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a);chunk(c,a,'text-delta')
 await c.select({provider:'anthropic',model:'claude',sessionId:'main'});assert.equal(c.task.phase,'responding');assert.equal(c.route.art,'claude')
 await c.select({provider:'openai',model:'gpt',sessionId:'other'});chunk(c,a,'text-delta',3,1);assert.equal(c.task.phase,'idle')
 assert.equal(c.assistantStream,null);c.dispose()
})
test('block-complete providers and old hosts remain supported',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a)
 chunk(c,a,'block-end',2,0,'a',{block:{type:'text'}});assert.equal(c.task.phase,'responding')
 c.event(s,ev('step/start',{turn:1,step:2}));assert.equal(c.task.phase,'thinking')
 // No live stream required for ordinary session event tools/end on old hosts.
 c.event(s,ev('tool/call',{name:'write_file',callId:'x'}));assert.equal(c.task.activity,'editing')
 c.event(s,ev('tool/result',{callId:'x'}));assert.equal(c.task.phase,'thinking')
 c.event(s,ev('turn/end',{reason:{kind:'aborted'}}));assert.equal(c.task.phase,'idle');c.dispose()
})
test('disable/re-enable does not resurrect a stream whose terminal event was missed',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a);chunk(c,a,'text-delta')
 await c.configure({enabled:false});c.event(s,ev('turn/end',{reason:{kind:'completed'}}))
 await c.configure({enabled:true});chunk(c,a,'text-delta',3,1);assert.equal(c.task.phase,'idle')
 c.dispose();begin(c,s);assert.equal(c.task.phase,'idle')
})

test('plugin binds official live event and disposes it without host polling',async()=>{
 const {applyPet}=await import('../../pet/index.js')
 const {mkdtemp}=await import('node:fs/promises')
 const {tmpdir}=await import('node:os'),{join}=await import('node:path')
 const home=await mkdtemp(join(tmpdir(),'kujira-state-qa-'))
 const handlers=new Map(),routes=new Map(),disposed=[];let onDispose
 const scope={sessions:{get:()=>undefined},connection:{fetch:{register:r=>routes.set(r.path,r)}},logger:{warn:message=>{throw new Error(message)}},on:(name,fn)=>{if(name==='dispose')onDispose=fn},get:()=>undefined}
 const ctx={inject:(_deps,fn)=>fn(scope),on:(name,fn)=>{handlers.set(name,fn);return()=>{disposed.push(name);handlers.delete(name)}}}
 const catalog={subscribe:()=>()=>{},resolve:()=>null}
 applyPet(ctx,{catalog,home})
 async function request(endpoint,payload={}){
  const r=await routes.get('/api/kujira-pet/'+endpoint).fetch(new Request('http://unit.test/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'test',method:'kujira-pet/'+endpoint,payload})}))
  const envelope=await r.json();assert.equal(envelope.result.ok,true);return envelope.result.value
 }
 await request('config',{enabled:true,showUsage:false,showStats:false,display:'page'})
 await request('select',{provider:'openai',model:'gpt',sessionId:'main'})
 assert.ok(handlers.has('session/event'));assert.ok(handlers.has('agent/assistant-stream'))
 const s=session(),a={session:s};handlers.get('session/event')(s,ev('turn/start',{turn:1}));handlers.get('session/event')(s,ev('step/start',{turn:1,step:1}))
 handlers.get('agent/assistant-stream')({agent:a,frame:{type:'start',attemptId:'a',revision:1,turn:1,step:1}})
 handlers.get('agent/assistant-stream')({agent:a,frame:{type:'chunk',attemptId:'a',revision:2,index:0,chunk:{type:'text-delta'}}})
 assert.equal((await request('state')).task.phase,'responding')
 onDispose();assert.deepEqual(disposed.sort(),['agent/assistant-stream','session/disposed','session/event'])
})

test('all current role manifests resolve every exposed state and activity to real frames',()=>{
 for(const role of ['gpt','deepseek','stella','qwen','kimi','glm','minimax','llama','doubao','mistral','claude','gemini','grok','hunyuan','mimo']){
  const m=artFor(role)
  for(const name of [...Object.values(m.stateMap),...Object.values(m.workingActivityMap)])assert.ok(m.clips[name]?.frames.length,role+':'+name)
 }
})

test('committed failed assistant attempt returns to thinking during retry decision gap',async()=>{
 const c=await controller(),s=session(),a={session:s};begin(c,s);open(c,a);chunk(c,a,'text-delta')
 c.assistantFrame({agent:a,frame:{type:'end',attemptId:'a',revision:3,index:1,outcome:{kind:'committed',eventType:'assistant/attempt'}}})
 assert.equal(c.task.phase,'thinking')
 open(c,a,'retry',4);assert.equal(c.task.phase,'thinking')
 chunk(c,a,'text-delta',5,0,'retry');assert.equal(c.task.phase,'responding');c.dispose()
})
