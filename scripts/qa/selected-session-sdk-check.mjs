// Optional integration lane: install the pinned DSH SDK modules in an isolated directory.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const require=createRequire(process.env.DSH_TEST_ROOT?resolve(process.env.DSH_TEST_ROOT,'package.json'):import.meta.url)
const {Context}=await import(require.resolve('@deepseek-ai/cordis'))
const {default:SessionStore}=await import(require.resolve('@deepseek-ai/dsh-session'))
const {default:SessionProjections}=await import(require.resolve('@deepseek-ai/dsh-session-projection'))
const {default:SessionQuery}=await import(require.resolve('@deepseek-ai/dsh-session-query'))
const SessionStats=await import(require.resolve('@deepseek-ai/dsh-session-stats'))
const {scopeTarget}=await import(require.resolve('@deepseek-ai/dsh-scope'))
const {applyPet}=await import(process.env.PET_INDEX??'../../pet/index.js')

test('published DSH 0.2.1-rc.2 Session/Query/Projection/Cordis modules hydrate and route 50 live sessions',async()=>{
 for(const name of ['dsh-session','dsh-session-projection','dsh-session-query','dsh-session-stats'])assert.equal(require('@deepseek-ai/'+name+'/package.json').version,'0.2.1-rc.2')
 const sdk=new Context(),fibers=[];for(const plugin of [SessionStore,SessionProjections,SessionQuery,SessionStats]){const fiber=sdk.plugin(plugin);await fiber;fibers.push(fiber)}
 const sessions=[],agents=new Map(),routes=new Map();let dispose
 const home=await mkdtemp(join(tmpdir(),'kujira-real-sdk-'))
 try{
  for(let i=0;i<50;i++){
   const session=sdk.sessions.create('sdk-'+i);session.append('turn/start',{turn:i+1});session.append('step/start',{turn:i+1,step:1});session.append('step/end',{turn:i+1,step:1});session.append('step/start',{turn:i+1,step:2})
   sessions.push(session);agents.set(session.id,{id:session.id,session,status:'running'})
  }
  const scope={sessions:sdk.sessions,connection:{fetch:{register:r=>routes.set(r.path,r)}},logger:{warn:message=>{throw Error(message)}},get:name=>name==='agents'?{get:id=>agents.get(id)}:sdk.get(name),on:(name,fn)=>{if(name==='dispose')dispose=fn}}
  applyPet({inject:(_deps,fn)=>fn(scope),on:(...args)=>sdk.on(...args)},{catalog:{subscribe:()=>()=>{},resolve:()=>null},home})
  const call=async(endpoint,payload={})=>{const response=await routes.get('/api/kujira-pet/'+endpoint).fetch(new Request('http://fixture.test/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'sdk',method:'kujira-pet/'+endpoint,payload})}));const envelope=await response.json();assert.equal(envelope.result.ok,true);return envelope.result.value}
  await call('config',{enabled:true,showUsage:false,display:'page'})
  for(let pass=0;pass<2;pass++)for(let i=49;i>=0;i--){const state=await call('select',{sessionId:sessions[i].id,provider:'fixture',model:i%2?'claude':'gpt'});assert.equal(state.task.turnActive,true);assert.equal(state.task.phase,'thinking');assert.equal(state.stats.turns,1);assert.equal(state.stats.steps,1);assert.equal(state.route.sessionId,sessions[i].id)}
  const a=agents.get('sdk-0'),b=agents.get('sdk-49')
  sdk.emit(scopeTarget(a,a),'agent/assistant-stream',{agent:a,frame:{type:'chunk',attemptId:'in-progress',revision:5,index:4,chunk:{type:'text-delta'}}});assert.equal((await call('state')).task.phase,'responding')
  b.session.append('step/end',{turn:50,step:2});b.session.append('turn/end',{turn:50,reason:{kind:'completed'}});b.status='idle';sdk.emit(scopeTarget(b,b),'agent/status',{agent:b,status:'idle'})
  assert.equal((await call('state')).task.phase,'responding');const completed=await call('select',{sessionId:b.id,provider:'fixture',model:'claude'});assert.equal(completed.task.phase,'completed');assert.equal(completed.stats.steps,2)
  a.session.append('step/end',{turn:1,step:2});a.session.append('turn/end',{turn:1,reason:{kind:'aborted',reason:{kind:'user'}}});a.status='idle';sdk.emit(scopeTarget(a,a),'agent/status',{agent:a,status:'idle'})
  const stopped=await call('select',{sessionId:a.id,provider:'fixture',model:'gpt'});assert.equal(stopped.task.phase,'idle');assert.equal(stopped.task.turnActive,false)
  console.log('Real DSH Session.append → global Cordis events → plugin HTTP state: 50 sessions, 100 switches, real query/projection hydration, stream, background completion and abort passed. Agent status values were controlled fixtures; no model provider or GUI was launched.')
 }finally{dispose?.();for(const fiber of fibers.reverse())await fiber.dispose()}
})
