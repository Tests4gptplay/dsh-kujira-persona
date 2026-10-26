/** Actual Fetch registration tests; no native desktop or model is launched. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {applyPet} from '../../pet/index.js'

async function harness({diary,brokenPet=false}={}){
  const home=await mkdtemp(join(tmpdir(),'kujira-diary-api-')),routes=new Map(),dispose=[]
  const ctx={effect(setup){const cleanup=setup();dispose.push(cleanup);return cleanup},inject:(_deps,fn)=>fn(ctx),on:(name,fn)=>{if(name==='dispose')dispose.push(fn);return()=>{}},connection:{fetch:{register:spec=>routes.set(spec.path,spec.fetch)}},logger:{warn(){}},sessions:{get:()=>null},get:()=>undefined}
  const catalog={resolve:async()=>({}),subscribe:()=>{if(brokenPet)throw Error('companion-only failure');return()=>{}}}
  applyPet(ctx,{home,catalog,diary,ensureSeeded:async()=>{},ensureFolder:async()=>{}})
  const request=(endpoint,payload={},envelope={})=>routes.get('/api/kujira-pet/'+endpoint)(new Request('http://localhost/api/kujira-pet/'+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'diary-test',method:'kujira-pet/'+endpoint,payload,...envelope})}))
  return {request,call:async(endpoint,payload)=> (await (await request(endpoint,payload)).json()).result,close:async()=>{await Promise.all(dispose.map(fn=>fn()));await rm(home,{recursive:true,force:true})}}
}

test('registered diary settings routes work with desktop pet disabled and have independent persisted values',async()=>{
  let saved={enabled:false,directory:'/qa/diary'},opens=0
  const diary={getSettings:async()=>({...saved}),configure:async patch=>({...saved,...(saved={...saved,...patch})}),openFolder:async()=>{opens++;return{directory:saved.directory}}}
  const h=await harness({diary})
  try{
    const pet=await h.call('state');assert.equal(pet.value.config.enabled,false)
    assert.deepEqual((await h.call('diary-settings')).value,saved)
    assert.equal((await h.call('diary-config',{enabled:true})).value.enabled,true)
    assert.equal((await h.call('state')).value.config.enabled,false)
    assert.equal((await h.call('diary-config',{directory:'/qa/new-diary'})).value.directory,'/qa/new-diary')
    await h.call('diary-config',{enabled:false})
    const opened=await h.call('diary-open-folder');assert.equal(opened.ok,true);assert.equal(opened.value.directory,'/qa/new-diary');assert.equal(opens,1)
    const invalid=await h.request('diary-config',{enabled:true},{method:'kujira-pet/config'});assert.equal(invalid.status,400);assert.equal(saved.enabled,false)
  }finally{await h.close()}
})

test('diary routes do not await or depend on failed companion initialization',async()=>{
  const diary={getSettings:async()=>({enabled:false,directory:'/qa/diary'}),configure:async patch=>({enabled:false,directory:'/qa/diary',...patch}),openFolder:async()=>({directory:'/qa/diary'})}
  const h=await harness({diary,brokenPet:true})
  try{
    assert.equal((await h.call('state')).ok,false)
    for(const endpoint of ['diary-settings','diary-config','diary-open-folder'])assert.equal((await h.call(endpoint)).ok,true,endpoint)
  }finally{await h.close()}
})

test('diary persistence/open errors return failed RPC responses and settings remain unchanged',async()=>{
  const saved={enabled:false,directory:'/qa/diary'}
  const diary={getSettings:async()=>saved,configure:async()=>{throw Error('日记设置保存失败：目录没有写入权限')},openFolder:async()=>{throw Error('当前宿主没有图形桌面')}}
  const h=await harness({diary})
  try{
    const failed=await h.call('diary-config',{enabled:true});assert.equal(failed.ok,false);assert.match(failed.error.message,/保存失败/)
    assert.deepEqual((await h.call('diary-settings')).value,saved)
    const open=await h.call('diary-open-folder');assert.equal(open.ok,false);assert.match(open.error.message,/没有图形桌面/)
  }finally{await h.close()}
})

test('missing diary store gives a recoverable error instead of a fake successful save',async()=>{
  const h=await harness()
  try{for(const endpoint of ['diary-settings','diary-config','diary-open-folder']){const result=await h.call(endpoint);assert.equal(result.ok,false);assert.match(result.error.message,/日记设置暂不可用/)}}finally{await h.close()}
})

test('real diary store persists through Fetch, rejects protected location, opens while off and retains old files',async()=>{
  const {openDiary}=await import('../../diary.js'),{EventEmitter}=await import('node:events'),{readFile}=await import('node:fs/promises')
  const home=await mkdtemp(join(tmpdir(),'kujira-diary-store-api-')),opened=[]
  const launch=(command,args)=>{opened.push([command,...args]);const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child}
  const diary=openDiary({home,platform:'win32',launch}),h=await harness({diary})
  try{
    const initial=await h.call('diary-settings');assert.equal(initial.value.enabled,false)
    await h.call('diary-config',{enabled:true});await diary.appendOwn({id:'role-c',label:'角色C'},'保留在原位置的角色C日记','已整理的角色C摘要')
    const oldFile=join(initial.value.directory,'role-c','Diary.md'),oldSummary=join(initial.value.directory,'role-c','Persona_diary.md'),oldText=await readFile(oldFile,'utf8'),summaryText=await readFile(oldSummary,'utf8')
    const invalid=await h.call('diary-config',{directory:join(home,'world')});assert.equal(invalid.ok,false);assert.equal((await h.call('diary-settings')).value.directory,initial.value.directory)
    const directory=join(home,'new-private-diaries');const moved=await h.call('diary-config',{directory,enabled:false});assert.equal(moved.ok,true);assert.equal(moved.value.directory,directory)
    assert.equal(await readFile(oldFile,'utf8'),oldText);assert.equal(await readFile(oldSummary,'utf8'),summaryText)
    const reopened=openDiary({home,platform:'win32',launch});assert.deepEqual(await reopened.getSettings(),{enabled:false,directory})
    await h.call('diary-open-folder');assert.deepEqual(opened,[['explorer.exe',directory]])
  }finally{await h.close();await rm(home,{recursive:true,force:true})}
})
