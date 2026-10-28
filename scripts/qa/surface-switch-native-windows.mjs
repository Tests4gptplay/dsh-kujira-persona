/** Windows CI smoke: real packaged KujiraPet.exe, real process ready/exit, and
 * production applyPet/NativePet. No simulated native child or platform override. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {once} from 'node:events'
import {applyPet} from '../../pet/index.js'
import {NativePet} from '../../pet/native.js'

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(check,label){
 const end=Date.now()+30000
 while(Date.now()<end){if(await check())return;await sleep(10)}
 throw Error('Timed out: '+label)
}
async function exited(child){
 if(child.exitCode!==null||child.signalCode!==null)return
 let timer
 try{await Promise.race([once(child,'exit'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native child did not exit')),30000)})])}
 finally{clearTimeout(timer)}
}

test('real Windows EXE surface switches do not require toggling enabled', {skip:process.platform!=='win32',timeout:120000},async t=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-surface-native-')),routes=new Map(),live=new Set(),children=[],events=[]
 const report={kind:'real-windows-wpf-exe-surface-switch',platform:process.platform,checks:[],events,passed:false}
 const output=process.env.KUJIRA_NATIVE_TEST_OUTPUT?resolve(process.env.KUJIRA_NATIVE_TEST_OUTPUT):home
 let dispose,native,streamReader,pump,sequence=0
 const originalShow=NativePet.prototype.show
 NativePet.prototype.show=function(state){
  native=this
  if(!this.surfaceTestObserved){
   this.surfaceTestObserved=true
   const launch=this.runtime.launch
   this.runtime.launch=(...args)=>{
    assert.equal(live.size,0,'a replacement must not launch until the previous native child exits')
    const child=launch(...args);children.push(child);live.add(child);events.push({kind:'spawn',pid:child.pid})
    child.once('exit',(code,signal)=>{live.delete(child);events.push({kind:'exit',pid:child.pid,code,signal})})
    return child
   }
  }
  return originalShow.call(this,state)
 }
 const scope={effect(setup){dispose=setup();return dispose},sessions:{get:()=>undefined},connection:{fetch:{register:r=>routes.set(r.path,r)}},logger:{warn:message=>{throw Error(message)}},get:name=>name==='sessionQuery'?{observeSession:async()=>({header:{id:'surface-smoke'},events:[],cursor:-1,inheritedEventCount:0,projections:{values:{}},[Symbol.dispose](){}})}:undefined}
 const ctx={inject:(_deps,fn)=>fn(scope),on:()=>()=>{}}
 applyPet(ctx,{catalog:{subscribe:()=>()=>{},resolve:()=>null},home})
 const call=async(endpoint,payload={})=>{
  const response=await routes.get('/api/kujira-pet/'+endpoint).fetch(new Request('http://surface-smoke.test/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:String(++sequence),method:'kujira-pet/'+endpoint,payload})}))
  const envelope=await response.json();assert.equal(envelope.result.ok,true,JSON.stringify(envelope.result));return envelope.result.value
 }
 const stateEvents=[]
 t.after(async()=>{
  await streamReader?.cancel();await pump
  try{await dispose?.()}finally{
   NativePet.prototype.show=originalShow
   report.liveChildren=live.size;report.spawnCount=children.length
   await mkdir(output,{recursive:true});await writeFile(join(output,'surface-switch-native-result.json'),JSON.stringify(report,null,2)+'\n')
  }
  assert.equal(live.size,0,'all smoke children exited')
 })
 await call('config',{enabled:true,display:'desktop',showUsage:false,reducedMotion:true})
 await call('select',{sessionId:'surface-smoke',provider:'fixture',model:'gpt'})
 const response=await routes.get('/api/kujira-pet/events').fetch(new Request('http://surface-smoke.test/api/kujira-pet/events'))
 streamReader=response.body.getReader()
 pump=(async()=>{while(true){const {done,value}=await streamReader.read();if(done)return;for(const line of new TextDecoder().decode(value).split('\n'))if(line.startsWith('data: '))stateEvents.push(JSON.parse(line.slice(6)))}})()
 const ready=async()=>{
  await until(async()=>{const state=await call('state');if(state.nativeError.includes('另一个 DSH'))throw Error(state.nativeError);return state.renderer==='desktop'},'real EXE ready')
  assert.ok(native.child?.pid);assert.equal(live.size,1)
 }
 await ready()
 const sessionId=(await call('state')).route.sessionId
 for(let round=0;round<3;round++){
  const old=native.child
  await call('config',{display:'page'});const cut=stateEvents.length
  await exited(old);await sleep(20)
  let state=await call('state');assert.equal(state.renderer,'page');assert.equal(state.config.enabled,true);assert.equal(state.nativeError,'');assert.equal(state.route.sessionId,sessionId)
  assert(!stateEvents.slice(cut).some(state=>state.renderer!=='page'),'late native exit must not emit a page-hiding SSE state')
  state=await call('config',{bubbleScale:1+(round+1)*.05});assert.equal(state.renderer,'page')
  await call('config',{display:round%2?'auto':'desktop'});await ready();assert.notEqual(native.child,old)
 }
 report.checks.push('three real EXE desktop/auto → page → desktop rounds; enabled and selected session preserved; post-exit state and SSE stay page')
 const old=native.child
 await call('config',{display:'page'});await call('config',{display:'desktop'});await exited(old);await ready()
 assert.notEqual(native.child,old);assert.equal((await call('state')).config.enabled,true)
 report.checks.push('rapid desktop → page → desktop uses one owned child and waits for previous exit')
 const last=native.child
 await call('config',{display:'page'});await call('config',{display:'desktop'});await call('config',{display:'page'})
 await exited(last);await until(()=>live.size===0,'last requested page stops every owned child')
 await sleep(30)
 const final=await call('state');assert.equal(final.renderer,'page');assert.equal(final.config.enabled,true);assert.equal(final.route.sessionId,sessionId)
 report.checks.push('rapid four-way switch settles on page without disabling companion')
 report.passed=true
})
