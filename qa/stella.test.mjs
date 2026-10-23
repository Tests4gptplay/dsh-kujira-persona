import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {openCatalog} from '../candidate/catalog.js'
import {openDossier} from '../candidate/dossier.js'
import {PetController} from '../candidate/pet/controller.js'
const config=home=>({mode:'auto',persona:'deepseek',personasDir:join(home,'personas'),modelRules:[]})
test('unknown families default to one Stella; known families and explicit none remain distinct',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-stella-'))
 try{
  const c=openCatalog(config(home))
  assert.equal((await c.resolve({provider:'x',model:'private-v1'})).id,'stella')
  assert.equal((await c.resolve({provider:'y',model:'private-v2'})).id,'stella')
  for(const [model,id] of [['deepseek-chat','deepseek'],['gpt-4o','gpt'],['glm-4','glm']])assert.equal((await c.resolve({provider:'x',model})).id,id)
  await c.change({action:'bind',persona:'gpt',provider:'x',model:'private-*'},{});assert.equal((await c.resolve({provider:'x',model:'private-v1'})).id,'gpt')
  await c.change({action:'bind',persona:'none',provider:'x',model:'private-*'},{});assert.equal(await c.resolve({provider:'x',model:'private-v1'}),null)
  assert.equal(await openCatalog({...config(home),unknownPersona:'none'}).resolve({provider:'z',model:'opaque'}),null)
 }finally{await rm(home,{recursive:true,force:true})}
})
test('Stella content persists, is loaded by a new instance and stays out of shared world',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-stella-'))
 try{
  const cfg={id:'stella',label:'星璃',personaDir:join(home,'personas/stella'),memoryFile:join(home,'personas/stella/90-记忆.md'),packagedDir:resolve('candidate/personas/stella'),seed:true,sync:true}
  const first=openDossier(cfg);assert.match((await first.compose()).text,/我是星璃/)
  const e=await first.edit({action:'append',category:'memory',text:'我更喜欢桂花麦茶。'})
  assert.equal(e.cache_updated,true);assert.match(await readFile(cfg.memoryFile,'utf8'),/桂花麦茶/)
  assert.match((await openDossier(cfg).compose()).text,/桂花麦茶/)
  const world=openDossier({id:'world',kind:'world',label:'全局',personaDir:join(home,'world'),packagedDir:resolve('candidate/world'),seed:true,sync:true})
  const shared=(await world.compose()).text;assert.match(shared,/星璃/);assert.doesNotMatch(shared,/桂花麦茶/)
 }finally{await rm(home,{recursive:true,force:true})}
})
test('one controller follows unknown to Stella; usage continues to use original route',async()=>{
 const home=await mkdtemp(join(tmpdir(),'kujira-stella-'));const catalog=openCatalog(config(home))
 const pet=new PetController({resolvePersona:r=>catalog.resolve(r),queryUsage:async()=>{throw new Error('No queries while off')}})
 try{
  await pet.select({provider:'private-provider',model:'opaque-v1'});assert.equal(pet.route.persona,'stella');assert.equal(pet.route.art,'stella');assert.equal(pet.route.provider,'private-provider');assert.equal(pet.route.family,'none');assert.equal(pet.timer,null)
  await pet.select({provider:'x',model:'gpt-4o'});assert.equal(pet.route.persona,'gpt')
  await pet.select({provider:'y',model:'opaque-v2'});assert.equal(pet.route.persona,'stella')
 }finally{pet.dispose();await rm(home,{recursive:true,force:true})}
})
