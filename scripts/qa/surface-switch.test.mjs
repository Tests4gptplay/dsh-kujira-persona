/** Production applyPet + NativePet lifecycle, with a real Node child standing in
 * for Windows WPF. This exercises child-process exit timing, not WPF rendering. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawn} from 'node:child_process'
import {once} from 'node:events'

const entry=process.env.PET_INDEX?pathToFileURL(process.env.PET_INDEX):new URL('../../pet/index.js',import.meta.url)
const {applyPet}=await import(entry)
const {NativePet}=await import(new URL('./native.js',entry))
const childSource=`
process.on('SIGTERM',()=>{setTimeout(()=>process.exit(0),Number(process.argv[2]??80))})
process.stdin.resume()
process.stdin.on('end',()=>{})
setInterval(()=>{},1000)
process.stdout.write('{"type":"fixture-started"}\\n')
setTimeout(()=>process.stdout.write('{"type":"ready"}\\n'),Number(process.argv[1]??0))
`
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve))
async function waitFor(check,label){
 const until=Date.now()+5000
 while(Date.now()<until){if(await check())return;await new Promise(resolve=>setTimeout(resolve,5))}
 throw Error('Timed out: '+label)
}
async function setup(t,{platform='win32',display='page',readyDelay=0,stopDelay=80,checkExecutable}={}){
 const home=await mkdtemp(join(tmpdir(),'kujira-surface-')),routes=new Map(),handlers=new Map(),children=[],statuses=[]
 let dispose,native,sequence=0
 const originalPlatform=Object.getOwnPropertyDescriptor(process,'platform'),originalShow=NativePet.prototype.show
 Object.defineProperty(process,'platform',{value:platform,configurable:true,enumerable:true})
 NativePet.prototype.show=function(state){
  native=this
  if(checkExecutable)this.runtime.checkExecutable=checkExecutable
  this.runtime.launch=()=>{
   const child=spawn(process.execPath,['--input-type=module','-e',childSource,String(readyDelay),String(stopDelay)],{stdio:['pipe','pipe','pipe']})
   child.fixtureOutput='';child.stdout.on('data',chunk=>{child.fixtureOutput+=chunk.toString();child.fixtureStarted=child.fixtureOutput.includes('fixture-started');child.fixtureReady=child.fixtureOutput.includes('\"type\":\"ready\"')})
   children.push(child);return child
  }
  return originalShow.call(this,state)
 }
 const session={header:{id:'same-session'}}
 const scope={effect(setup){dispose=setup();return dispose},sessions:{get:()=>session},connection:{fetch:{register:r=>routes.set(r.path,r)}},logger:{warn:message=>{throw Error(message)}},get:name=>name==='sessionQuery'?{observeSession:async()=>({header:session.header,events:[],cursor:-1,inheritedEventCount:0,projections:{values:{}},[Symbol.dispose](){}})}:undefined}
 const ctx={inject:(_deps,fn)=>fn(scope),on:(name,fn)=>{handlers.set(name,fn);return()=>handlers.delete(name)}}
 applyPet(ctx,{catalog:{subscribe:()=>()=>{},resolve:()=>null},home})
 const call=async(endpoint,payload={})=>{
  const response=await routes.get('/api/kujira-pet/'+endpoint).fetch(new Request('http://fixture.test/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:String(++sequence),method:'kujira-pet/'+endpoint,payload})}))
  const envelope=await response.json();assert.equal(envelope.result.ok,true,JSON.stringify(envelope.result));return envelope.result.value
 }
 let streamReader
 t.after(async()=>{
  await streamReader?.cancel()
  await dispose?.()
  NativePet.prototype.show=originalShow;Object.defineProperty(process,'platform',originalPlatform)
  assert(children.every(child=>child.exitCode!==null||child.signalCode!==null),'no child left running')
 })
 await call('config',{enabled:true,showUsage:false,reducedMotion:true,display})
 await call('select',{sessionId:'same-session',provider:'fixture',model:'gpt'})
 const response=await routes.get('/api/kujira-pet/events').fetch(new Request('http://fixture.test/api/kujira-pet/events'))
 streamReader=response.body.getReader()
 const pump=(async()=>{while(true){const {done,value}=await streamReader.read();if(done)return;for(const line of new TextDecoder().decode(value).split('\n'))if(line.startsWith('data: '))statuses.push(JSON.parse(line.slice(6)))}})()
 const stable=async renderer=>waitFor(async()=>(await call('state')).renderer===renderer,renderer)
 return{call,children,statuses,home,stable,native:()=>native,events:handlers,async finishStream(){await streamReader.cancel();await pump}}
}

for(const display of ['desktop','auto'])test(display+' → page survives the old real child exit with enabled left true',async t=>{
 const h=await setup(t,{display});await h.stable('desktop')
 const old=h.children[0],exit=once(old,'exit')
 const switched=await h.call('config',{display:'page'});assert.equal(switched.renderer,'page')
 const cut=h.statuses.length
 await exit;await nextTurn()
 const state=await h.call('state')
 assert.equal(state.config.enabled,true);assert.equal(state.config.display,'page');assert.equal(state.route.sessionId,'same-session')
 assert.equal(state.renderer,'page','late native exit must not hide the already selected page pet')
 assert.equal(h.statuses.slice(cut).some(s=>s.renderer!=='page'),false,'SSE must not send a stale non-page renderer')
 assert.equal(JSON.parse(await readFile(join(h.home,'kujira-pet.json'),'utf8')).enabled,true)
 await h.call('config',{bubbleScale:1.05});h.events.get('session/event')({header:{id:'same-session'}},{seq:10,type:'turn/start',data:{turn:2}})
 assert.equal((await h.call('state')).renderer,'page','later ordinary publishes keep the selected page')
})

test('page → desktop → page repeats without toggling enabled or replacing session state',async t=>{
 const h=await setup(t)
 const session={header:{id:'same-session'}}
 h.events.get('session/event')(session,{seq:0,type:'turn/start',data:{turn:1}})
 h.events.get('session/event')(session,{seq:1,type:'tool/call',data:{name:'read_file',callId:'active-search'}})
 const task=(await h.call('state')).task
 for(let round=0;round<3;round++){
  await h.call('config',{display:'desktop'});await h.stable('desktop')
  const child=h.children.at(-1),exit=once(child,'exit')
  await h.call('config',{display:'page'});await exit;await nextTurn()
  const state=await h.call('state');assert.equal(state.renderer,'page');assert.equal(state.config.enabled,true);assert.deepEqual(state.task,task)
 }
 assert.equal(h.children.length,3)
})

test('rapid desktop → page → desktop waits for old exit and starts one replacement',async t=>{
 const h=await setup(t,{display:'desktop'});await h.stable('desktop')
 const old=h.children[0],exit=once(old,'exit')
 await h.call('config',{display:'page'});await h.call('config',{display:'desktop'})
 assert.equal(h.children.length,1,'no duplicate native process before old process exit')
 await exit;await h.stable('desktop')
 assert.equal(h.children.length,2);assert.equal((await h.call('state')).config.enabled,true)
 const current=h.children[1];old.emit('error',Error('late retired child error'));old.emit('exit',99);old.stderr.emit('data',Buffer.from('late diagnostic'))
 await h.call('config',{bubbleScale:1.05});h.events.get('session/event')({header:{id:'same-session'}},{seq:10,type:'turn/start',data:{turn:2}})
 const state=await h.call('state');assert.equal(state.renderer,'desktop');assert.equal(state.nativeError,'');assert.equal(h.native().child,current);assert.equal(h.children.length,2)
})

test('rapid desktop → page → desktop → page keeps the final page after old exit',async t=>{
 const h=await setup(t,{display:'desktop'});await h.stable('desktop')
 const exit=once(h.children[0],'exit')
 await h.call('config',{display:'page'});await h.call('config',{display:'desktop'});await h.call('config',{display:'page'})
 await exit;await nextTurn()
 const state=await h.call('state');assert.equal(state.renderer,'page');assert.equal(state.config.enabled,true);assert.equal(h.children.length,1)
})

test('native errors after choosing page cannot overwrite page, but active native errors are reported',async t=>{
 const h=await setup(t,{display:'desktop'});await h.stable('desktop')
 h.native().onStatus('none','active native error');assert.equal((await h.call('state')).nativeError,'active native error')
 const exit=once(h.children[0],'exit');await h.call('config',{display:'page'})
 h.native().onStatus('none','stale native error');await exit;await nextTurn()
 const state=await h.call('state');assert.equal(state.renderer,'page');assert.equal(state.nativeError,'')
})

test('disabled switch and non-Windows auto/page keep normal behavior without native launch',async t=>{
 const h=await setup(t,{platform:'linux',display:'auto'});assert.equal((await h.call('state')).renderer,'page')
 await h.call('config',{enabled:false});await h.call('config',{display:'page'});assert.equal((await h.call('state')).renderer,'none')
 await h.call('config',{enabled:true});assert.equal((await h.call('state')).renderer,'page')
 await h.call('config',{display:'desktop'});const unavailable=await h.call('state');assert.equal(unavailable.renderer,'none');assert.match(unavailable.nativeError,/当前系统没有原生桌宠/)
 await h.call('config',{display:'auto'});const state=await h.call('state');assert.equal(state.renderer,'page');assert.equal(state.nativeError,'');assert.equal(h.children.length,0)
})


test('switching to page before native ready survives both late ready and exit',async t=>{
 const h=await setup(t,{readyDelay:150,stopDelay:300})
 await h.call('config',{display:'desktop'});await waitFor(()=>h.children[0]?.fixtureStarted,'native child started before ready')
 const child=h.children[0],exit=once(child,'exit')
 assert.equal(child.fixtureReady,false,'surface is changed before native ready')
 await h.call('config',{display:'page'});await exit;await nextTurn()
 assert.equal(child.fixtureReady,true,'child really announced ready while stopping, before its delayed exit')
 const state=await h.call('state');assert.equal(state.renderer,'page');assert.equal(state.config.enabled,true);assert.equal(state.nativeError,'')
})

test('late executable-check failure cannot hide the already selected page surface',async t=>{
 let rejectCheck,checkStarted=false
 const check=new Promise((_,reject)=>{rejectCheck=reject})
 const h=await setup(t,{checkExecutable:()=>{checkStarted=true;return check}})
 await h.call('config',{display:'desktop'});await waitFor(()=>checkStarted,'executable check')
 await h.call('config',{display:'page'});const starting=h.native().starting
 rejectCheck(Error('test-only missing executable'));await starting.catch(()=>{});await nextTurn()
 const state=await h.call('state');assert.equal(state.renderer,'page');assert.equal(state.config.enabled,true);assert.equal(state.nativeError,'');assert.equal(h.children.length,0)
})
