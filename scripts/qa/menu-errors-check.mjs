import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PetController} from '../../pet/controller.js'
import {applyPet,applyNativeAction} from '../../pet/index.js'

function controller(code){return new PetController({config:{enabled:true,bubble:'tasks',showUsage:false},resolvePersona:()=>({}),queryUsage:async()=>null,persist:async()=>{if(code){const e=new Error('private path and payload must not be exposed');e.code=code;throw e}}})}
test('actual controller classifies disk failures and leaves saved configuration unchanged',async()=>{
 for(const [code,text] of [['EACCES','写入权限'],['EPERM','写入权限'],['EROFS','写入权限'],['ENOSPC','磁盘空间不足'],['EBUSY','被占用'],['EIO','EIO']]){
  const c=controller(code);await assert.rejects(c.configure({enabled:false}),e=>e.code==='kujira-config-save'&&e.message.includes(text)&&!e.message.includes('private'));assert.equal(c.config.enabled,true);c.dispose()
 }
})
test('all three native menu rejections are handled and published in the existing settings status',async()=>{
 const c=controller('ENOSPC');let count=0;c.subscribe(()=>count++)
 for(const action of ['toggle-pet','toggle-bubble','close']){await applyNativeAction(c,{action});assert.match(c.snapshot().nativeError,/磁盘空间不足/)}
 assert.equal(count,3);assert.equal(c.config.enabled,true);assert.equal(c.config.showPet,true);assert.equal(c.config.bubble,'tasks')
 c.persist=async()=>{};await applyNativeAction(c,{action:'toggle-pet'});assert.equal(c.config.showPet,false);assert.equal(c.nativeError,'');c.dispose()
})

test('real registered config Fetch route returns actual filesystem save error and then recovers',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-menu-errors-')),routes=new Map(),dispose=[]
 await writeFile(join(home,'kujira-pet.json'),JSON.stringify({enabled:true,showUsage:false,refreshSeconds:0,display:'page'}))
 const ctx={effect(setup){const cleanup=setup();dispose.push(cleanup);return cleanup},inject:(_deps,fn)=>fn(ctx),on:(name,fn)=>{if(name==='dispose')dispose.push(fn);return()=>{}},connection:{fetch:{register:spec=>routes.set(spec.path,spec.fetch)}},logger:{warn(){}},sessions:{get:()=>null},get:()=>undefined}
 applyPet(ctx,{home,catalog:{resolve:async()=>({}),subscribe:()=>()=>{}},ensureSeeded:async()=>{},ensureFolder:async()=>{}})
 const call=async(endpoint,payload)=>{const request=new Request('http://localhost/api/kujira-pet/'+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'actual-product-test',method:'kujira-pet/'+endpoint,payload})});return(await routes.get('/api/kujira-pet/'+endpoint)(request)).json()}
 try{
  const start=await call('state',{});assert.equal(start.result.value.config.enabled,true)
  const blocked=join(home,'kujira-pet.json.'+process.pid+'.tmp');await mkdir(blocked)
  for(const patch of [{showPet:false},{bubble:'hidden'},{enabled:false}]){
   const failed=await call('config',patch);assert.equal(failed.result.ok,false);assert.equal(failed.result.error.code,'kujira-config-save');assert.match(failed.result.error.message,/设置文件无法保存/);assert.equal(failed.result.error.message.includes(home),false)
  }
  await rm(blocked,{recursive:true});const success=await call('config',{showPet:false});assert.equal(success.result.ok,true);assert.equal(success.result.value.config.showPet,false)
 }finally{await Promise.all(dispose.map(fn=>fn()));await rm(home,{recursive:true,force:true})}
})
test('malformed or unfamiliar-version pet settings do not lock ordinary settings writes',async()=>{
 for(const raw of ['{broken',JSON.stringify({v:999,enabled:true,showUsage:false,display:'page'})]){
  const home=await mkdtemp(join(tmpdir(),'kujira-settings-recovery-')),routes=new Map(),dispose=[]
  await writeFile(join(home,'kujira-pet.json'),raw)
  const ctx={effect(setup){const cleanup=setup();dispose.push(cleanup);return cleanup},inject:(_deps,fn)=>fn(ctx),on:(name,fn)=>{if(name==='dispose')dispose.push(fn);return()=>{}},connection:{fetch:{register:spec=>routes.set(spec.path,spec.fetch)}},logger:{warn(){}},sessions:{get:()=>null},get:()=>undefined}
  applyPet(ctx,{home,catalog:{resolve:async()=>({}),subscribe:()=>()=>{}},ensureSeeded:async()=>{},ensureFolder:async()=>{}})
  const call=async(endpoint,payload={})=>(await routes.get('/api/kujira-pet/'+endpoint)(new Request('http://qa/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'private-settings-check',method:'kujira-pet/'+endpoint,payload})}))).json()
  try{assert.equal((await call('state')).result.ok,true);const saved=await call('config',{enabled:true,showUsage:false,display:'page',bubble:'tasks'});assert.equal(saved.result.ok,true);assert.equal(saved.result.value.config.bubble,'tasks');assert.equal((await call('config',{enabled:false})).result.value.config.enabled,false)}finally{await Promise.all(dispose.map(fn=>fn()));await rm(home,{recursive:true,force:true})}
 }
})
test('custom positive scales survive registered config write and a fresh plugin initialization unchanged',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-scale-restart-'));const make=()=>{const routes=new Map(),dispose=[];const ctx={effect(setup){const cleanup=setup();dispose.push(cleanup);return cleanup},inject:(_deps,fn)=>fn(ctx),on:(name,fn)=>{if(name==='dispose')dispose.push(fn);return()=>{}},connection:{fetch:{register:spec=>routes.set(spec.path,spec.fetch)}},logger:{warn(){}},sessions:{get:()=>null},get:()=>undefined};applyPet(ctx,{home,catalog:{resolve:async()=>({}),subscribe:()=>()=>{}},ensureSeeded:async()=>{},ensureFolder:async()=>{}});return{close:()=>dispose.forEach(fn=>fn()),call:async(endpoint,payload={})=>(await routes.get('/api/kujira-pet/'+endpoint)(new Request('http://qa/api/kujira-pet/'+endpoint,{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'scale-persist',method:'kujira-pet/'+endpoint,payload})}))).json()}}
 let first,second
 try{await writeFile(join(home,'kujira-pet.json'),JSON.stringify({enabled:false,showUsage:false,scale:2,bubbleScale:0.2,refreshSeconds:1800}));first=make();const before=await first.call('state');assert.equal(before.result.value.config.scale,2);assert.equal(before.result.value.config.bubbleScale,0.2)
  const saved=await first.call('config',{enabled:false});assert.equal(saved.result.value.config.scale,2);assert.equal(saved.result.value.config.bubbleScale,0.2);assert.equal(saved.result.value.config.refreshSeconds,1800);const bytes=await readFile(join(home,'kujira-pet.json'),'utf8');first.close();first=null
  second=make();const loaded=(await second.call('state')).result.value.config;assert.equal(loaded.scale,2);assert.equal(loaded.bubbleScale,0.2);assert.equal(loaded.refreshSeconds,1800);assert.equal(await readFile(join(home,'kujira-pet.json'),'utf8'),bytes)
 }finally{first?.close();second?.close();await rm(home,{recursive:true,force:true})}
})
