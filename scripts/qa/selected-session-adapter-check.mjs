import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const {applyPet}=await import(process.env.PET_INDEX??'../../pet/index.js')
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
const promptly=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('foreground RPC blocked on an optional presentation read')),100)})])}finally{clearTimeout(timer)}}

test('HTTP select, official observation lease and global events agree for 50 independent sessions',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-selected-adapter-')),sessions=new Map(),handlers=new Map(),routes=new Map();let dispose,reads=0,released=0,eventMaterializations=0
 for(let i=0;i<50;i++){
  const id='s-'+i,events=[{seq:0,type:'turn/start',data:{turn:i+1}},{seq:1,type:'step/start',data:{turn:i+1,step:1}},{seq:2,type:'tool/call',data:{name:i%2?'write_file':'read_file',callId:id}}]
  sessions.set(id,{header:{id},events,status:'running',views:{sessionStats:{turns:i+1,steps:i+10},tokenUsage:{uncachedInputTokens:100+i,cacheReadTokens:20,cacheWriteTokens:0,outputTokens:3}}})
 }
 const services={agents:{get:id=>sessions.get(id)},sessionProjections:{snapshot:s=>({values:s.views})},sessionQuery:{observeSession:async id=>{reads++;const s=sessions.get(id);return{header:s.header,cursor:s.events.length-1,inheritedEventCount:0,projections:{values:s.views},get events(){eventMaterializations++;return s.events.slice()},[Symbol.dispose](){released++}}}}}
 const scope={effect(setup){dispose=setup();return dispose},sessions:{get:id=>sessions.get(id)},connection:{fetch:{register:r=>routes.set(r.path,r)}},logger:{warn:message=>{throw Error(message)}},get:name=>services[name],on:(name,fn)=>{if(name==='dispose')dispose=fn}}
 const ctx={inject:(_deps,fn)=>fn(scope),on:(name,fn)=>{handlers.set(name,fn);return()=>handlers.delete(name)}}
 applyPet(ctx,{catalog:{subscribe:()=>()=>{},resolve:()=>null},home})
 const call=async(endpoint,payload={})=>{const response=await routes.get('/api/kujira-pet/'+endpoint).fetch(new Request('http://fixture.test/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'fixture',method:'kujira-pet/'+endpoint,payload})}));const envelope=await response.json();assert.equal(envelope.result.ok,true);return envelope.result.value}
 await call('config',{enabled:true,showUsage:false,bubble:'tasks',display:'page'})
 for(let round=0;round<3;round++)for(let i=49;i>=0;i--){const selected=await call('select',{sessionId:'s-'+i,provider:'fixture',model:i%2?'claude':'gpt'});assert.equal(selected.route.sessionId,'s-'+i);assert.equal(selected.route.model,i%2?'claude':'gpt');const v=await call('state');assert.equal(v.task.activity,i%2?'editing':'searching');assert.equal(v.stats.steps,i+10)}
 assert.equal(eventMaterializations,50,'unchanged revisits must not materialize full event histories');assert.equal(reads,released,'every observation lease is disposed')
 const before=await call('state'),b=sessions.get('s-49');b.status='idle';const event={seq:b.events.length,type:'turn/end',data:{reason:{kind:'completed'}}};b.events.push(event);handlers.get('session/event')(b,event);handlers.get('agent/status')({agent:{session:b},status:'idle'});assert.deepEqual((await call('state')).task,before.task)
 const completed=await call('select',{sessionId:'s-49',provider:'fixture',model:'claude'});assert.equal(completed.task.phase,'completed');assert.equal(completed.stats.steps,59)
 await dispose();assert.equal(handlers.size,0);assert.equal(reads,released)
})

test('foreground HTTP select returns before pending history and persona; hydrated state arrives over events',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-selection-pending-')),routes=new Map(),history=deferred(),persona=deferred(),started=deferred();let dispose,released=0,reader
 const session={header:{id:'front'},status:'idle'}
 const services={agents:{get:()=>session},sessionQuery:{observeSession:()=>{started.resolve();return history.promise}}}
 const scope={effect:setup=>{dispose=setup()},sessions:{get:()=>session},connection:{fetch:{register:route=>routes.set(route.path,route)}},logger:{warn:message=>{throw Error(message)}},get:name=>services[name]}
 const ctx={inject:(_deps,fn)=>fn(scope),on:()=>()=>{}}
 applyPet(ctx,{catalog:{subscribe:()=>()=>{},resolve:()=>persona.promise},home})
 const call=async(endpoint,payload={})=>{const response=await routes.get('/api/kujira-pet/'+endpoint).fetch(new Request('http://fixture.test/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'fixture',method:'kujira-pet/'+endpoint,payload})}));const envelope=await response.json();assert.equal(envelope.result.ok,true);return envelope.result.value}
 try{
  await call('config',{enabled:true,showUsage:false,display:'page'})
  const events=await routes.get('/api/kujira-pet/events').fetch(new Request('http://fixture.test/api/kujira-pet/events'));reader=events.body.getReader();await reader.read()
  const selected=await promptly(call('select',{sessionId:'front',provider:'fixture',model:'gpt'}));await promptly(started.promise)
  assert.equal(selected.route.sessionId,'front');assert.equal(selected.task.phase,'idle');assert.equal((await promptly(call('state'))).route.model,'gpt')
  history.resolve({header:session.header,cursor:1,inheritedEventCount:0,events:[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'turn/end',data:{reason:{kind:'completed'}}}],projections:{values:{sessionStats:{turns:1,steps:2}}},[Symbol.dispose](){released++}})
  const hydrated=await promptly((async()=>{for(;;){const chunk=await reader.read();assert.equal(chunk.done,false);const state=JSON.parse(new TextDecoder().decode(chunk.value).trim().slice(6));if(state.stats?.steps===2)return state}})())
  assert.equal(hydrated.route.sessionId,'front');assert.equal(hydrated.task.phase,'completed');assert.equal(released,1)
 }finally{persona.resolve(null);await reader?.cancel();await dispose()}
})
