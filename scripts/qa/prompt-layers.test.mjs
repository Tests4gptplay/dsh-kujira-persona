/** Offline real-entry regression: controlled host, actual apply/RPC/prompt hooks; no model calls or native launch. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {openDiary} from '../../daily-diary.js'

const section=(a,name)=>a.sections.find(s=>s.name===name)?.text??''
const tick=()=>new Promise(resolve=>setImmediate(resolve))
async function fixture(t){
  const home=await mkdtemp(join(tmpdir(),'kujira-prompt-layers-')),world=join(home,'world'),personas=join(home,'personas'),persona=join(personas,'gpt')
  await mkdir(world,{recursive:true});await mkdir(persona,{recursive:true})
  await writeFile(join(world,'00-shared.md'),'WORLD_SHARED_MARKER: all roles keep common collaboration requirements.')
  await writeFile(join(persona,'00-personal.md'),'PERSONA_ORIGINAL_MARKER: GPT keeps its individual communication style.')
  await writeFile(join(persona,'90-记忆.md'),'PERSONA_CORRECTION_MARKER: user-specific correction for this role.')
  const sections=new Map(),events=new Map(),tools=new Map(),routes=new Map(),effects=new Set(),warnings=[]
  const available=new Set(['tools','sessions','agents','sessionQuery','connection','webServer'])
  const ctx={
    logger:{warn:message=>warnings.push(message)},get:()=>undefined,sessions:{get:()=>null},
    systemPrompt:{section(value){sections.set(value.name,value);return()=>sections.delete(value.name)}},
    connection:{fetch:{register(value){routes.set(value.path,value.fetch)}}},
    tools:{register(value){assert.equal(tools.has(value.name),false);tools.set(value.name,value);return()=>{if(tools.get(value.name)===value)tools.delete(value.name)}}},
    effect(setup){const clean=setup(),stop=()=>{if(effects.delete(stop))return clean?.()};effects.add(stop);return stop},
    on(name,listener,options={}){const list=events.get(name)??[];events.set(name,list);options.prepend?list.unshift(listener):list.push(listener);return()=>{const i=list.indexOf(listener);if(i>=0)list.splice(i,1)}},
    inject(names,callback){if(names.every(name=>available.has(name)))return callback(ctx)},
  }
  const priorHome=process.env.DSH_HOME;process.env.DSH_HOME=home
  let plugin
  try{plugin=await import(new URL('../../index.js?prompt-layers='+encodeURIComponent(home),import.meta.url))}
  finally{if(priorHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=priorHome}
  plugin.apply(ctx,{mode:'fixed',persona:'gpt',worldDir:world,personasDir:personas,personaDir:join(home,'legacy-persona'),seed:false,sync:false})
  const agent={id:'prompt-layer-agent',session:{requestHeader:()=>({config:{provider:'fixture',model:'gpt-fixture'}})}}
  async function call(endpoint,payload={}){
    const handler=routes.get('/api/kujira-pet/'+endpoint);assert.ok(handler,'actual apply registered '+endpoint)
    const response=await handler(new Request('http://localhost/api/kujira-pet/'+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'prompt-layers',method:'kujira-pet/'+endpoint,payload})}))
    const result=(await response.json()).result;assert.equal(result.ok,true,JSON.stringify(result));return result.value
  }
  async function assemble(){
    const assembly={variables:{provider:'fixture',model:'gpt-fixture'},sections:[{name:'host',text:'HOST_SYSTEM_MARKER'},...sections.values()],contexts:[{name:'host-context',text:'KEEP_CONTEXT'}],history:[{role:'user',content:'KEEP_HISTORY'}]}
    const listeners=events.get('system-prompt/assemble')??[]
    const next=i=>i===listeners.length?Promise.resolve(assembly):listeners[i](assembly,{agent},()=>next(i+1))
    return next(0)
  }
  t.after(async()=>{for(const stop of [...effects])await stop();for(const stop of [...events.get('dispose')??[]])await stop();await tick();await rm(home,{recursive:true,force:true,maxRetries:3,retryDelay:30})})
  await call('diary-settings');await call('state');await assemble();await tick()
  return{home,persona,tools,agent,call,assemble,warnings}
}
function assertPermanent(a){
  assert.match(section(a,'whale:world'),/WORLD_SHARED_MARKER/)
  assert.match(section(a,'whale:world'),/world[\s\S]*persona/)
  for(const text of ['不只用于角色扮演','项目共识','经用户确认','共同规则共享，个人差异保留'])assert.ok(section(a,'whale:world').includes(text),text)
  assert.match(section(a,'whale:persona'),/PERSONA_ORIGINAL_MARKER/)
  assert.match(section(a,'whale:persona'),/PERSONA_CORRECTION_MARKER/)
  assert.equal(section(a,'host'),'HOST_SYSTEM_MARKER')
  assert.deepEqual(a.contexts,[{name:'host-context',text:'KEEP_CONTEXT'}])
  assert.deepEqual(a.history,[{role:'user',content:'KEEP_HISTORY'}])
  assert.doesNotMatch(section(a,'whale:world')+section(a,'whale:persona'),/ai_diary|实验性 AI 日记|sleep_read|sleep_write/)
}

test('actual apply: diary enabled/sleepEnabled four combinations leave world/persona independent',async t=>{
  const f=await fixture(t)
  await f.call('diary-config',{enabled:true,sleepEnabled:false})
  await f.assemble()
  await f.tools.get('ai_diary').execute({action:'append',text:'PRIVATE_DIARY_BODY_NOT_AUTO_INJECTED',summary:'DIARY_SUMMARY_MARKER'},{agent:f.agent,callId:'seed-summary'})
  for(const enabled of [false,true])for(const sleepEnabled of [false,true])await t.test(`enabled=${enabled}, sleepEnabled=${sleepEnabled}`,async()=>{
    const state=await f.call('diary-config',{enabled,sleepEnabled});assert.equal(state.enabled,enabled);assert.equal(state.sleepEnabled,sleepEnabled)
    const a=await f.assemble();assertPermanent(a)
    assert.equal(f.tools.has('ai_diary'),enabled)
    assert.equal(f.tools.has('sleep_read'),false);assert.equal(f.tools.has('sleep_write'),false)
    const text=section(a,'whale:diary')
    if(enabled){assert.match(text,/DIARY_SUMMARY_MARKER/);assert.match(text,/与原有 persona 档案并存/);assert.match(text,/ai_diary/)}else assert.equal(text,'')
    assert.doesNotMatch(JSON.stringify(a.sections),/PRIVATE_DIARY_BODY_NOT_AUTO_INJECTED/)
    assert.equal((await f.call('state')).config.enabled,false,'diary settings must not enable the desktop companion')
  })
})

test('actual apply: off/on revokes old diary tool, restores summary without overwriting persona',async t=>{
  const f=await fixture(t),original=await readFile(join(f.persona,'90-记忆.md'),'utf8')
  await f.call('diary-config',{enabled:true,sleepEnabled:true});await f.assemble()
  const old=f.tools.get('ai_diary');await old.execute({action:'append',text:'LONG_BODY_ONCE',summary:'KEEP_PRIVATE_SUMMARY'},{agent:f.agent,callId:'one-write'})
  for(const sleepEnabled of [true,false]){
    await f.call('diary-config',{enabled:false,sleepEnabled})
    const off=await f.assemble();assertPermanent(off);assert.equal(section(off,'whale:diary'),'');assert.equal(f.tools.has('ai_diary'),false)
    await assert.rejects(old.execute({action:'append',text:'BLOCKED_OLD_TOOL',summary:'blocked'},{agent:f.agent}),/已关闭|失效/)
    await f.call('diary-config',{enabled:true,sleepEnabled});const on=await f.assemble();assertPermanent(on)
    assert.match(section(on,'whale:diary'),/KEEP_PRIVATE_SUMMARY/);assert.notEqual(f.tools.get('ai_diary'),old)
  }
  assert.equal(await readFile(join(f.persona,'90-记忆.md'),'utf8'),original)
  const own=await f.tools.get('ai_diary').execute({action:'read',full:true},{agent:f.agent})
  assert.equal((own.text.match(/LONG_BODY_ONCE/g)??[]).length,1);assert.doesNotMatch(own.text,/BLOCKED_OLD_TOOL/)
})

test('actual daily diary: sleep-only keeps private history readable to the worker but not foreground context',async t=>{
  const home=await mkdtemp(join(tmpdir(),'kujira-prompt-sleep-only-'));t.after(()=>rm(home,{recursive:true,force:true}))
  let now=new Date('2026-10-25T12:00:00Z')
  const diary=openDiary({home,timeZone:'UTC',now:()=>now}),role={id:'gpt',label:'GPT'}
  await diary.ready;await diary.configure({enabled:true,sleepEnabled:false})
  const basis=(await diary.contextSnapshot(role)).basis
  await diary.appendOwn(role,'OLD_PRIVATE_HISTORY','OLD_PRIVATE_SUMMARY',{basis})
  now=new Date('2026-10-26T12:00:00Z');await diary.configure({enabled:false,sleepEnabled:true})
  assert.equal((await diary.contextSnapshot(role)).text,'')
  await assert.rejects(diary.readOwn(role),/关闭/)
  assert.equal(await diary.sleepContext(role),'OLD_PRIVATE_SUMMARY')
  const pending=await diary.pendingSleep(role);assert.ok(pending.length>0);assert.ok(pending.some(value=>value.text.includes('OLD_PRIVATE_HISTORY')))
  assert.ok(pending.every(value=>value.date==='2026-10-25'))
  await diary.configure({sleepEnabled:false});await assert.rejects(diary.sleepContext(role),/关闭/);await assert.rejects(diary.pendingSleep(role),/关闭/)
  await diary.configure({enabled:true,sleepEnabled:true});assert.match((await diary.contextSnapshot(role)).text,/OLD_PRIVATE_SUMMARY/)
  assert.ok((await diary.pendingSleep(role)).length>0,'off/on must preserve pending history')
})
