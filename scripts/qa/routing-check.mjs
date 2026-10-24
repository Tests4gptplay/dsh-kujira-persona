import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {openCatalog} from '../../catalog.js'
import {PetController} from '../../pet/controller.js'
import {buildStandardManifest} from '../../pet/standard-manifest.js'
import {AnimationPlayer} from '../../pet/animation.js'

test('automatic routing preserves default, configured and explicit user selections',async()=>{
  const personasDir=await mkdtemp(join(tmpdir(),'kujira-catalog-qa-'))
  const config={personasDir,mode:'auto',modelRules:[{model:'configured-*',persona:'gemini'}]}
  const catalog=openCatalog(config)
  const controller=new PetController({config:{enabled:true,showUsage:false},resolvePersona:route=>catalog.resolve(route)})
  const unknown={provider:'neutral-local',model:'unmapped-123',sessionId:'one'}
  try {
    assert.equal((await catalog.resolve(unknown)).id,'stella')
    assert(!(await catalog.list()).personas.some(p=>p.id==='stella'))
    assert.equal((await catalog.get('stella')).id,'stella')
    const selected=await controller.select(unknown)
    assert.equal(selected.route.persona,'stella');assert.equal(selected.route.art,'stella')
    assert.equal((await catalog.resolve({provider:'neutral-local',model:'gpt-5.2'})).id,'gpt')
    const configured={provider:'neutral-local',model:'configured-123'}
    assert.equal((await catalog.resolve(configured)).id,'gemini')
    await catalog.change({action:'bind',persona:'claude',use_current_model:true},configured)
    assert.equal((await catalog.resolve(configured)).id,'claude')
    await catalog.change({action:'create',persona:'user-character',name:'用户角色',text:'隔离测试的用户自定义设定',use_current_model:true},unknown)
    await controller.refreshPersona()
    assert.equal(controller.snapshot().route.persona,'user-character')
    assert.equal(controller.snapshot().route.name,'用户角色')
    assert.equal(controller.snapshot().route.art,'unknown')
    assert.equal((await openCatalog(config).resolve(unknown)).id,'user-character')
    await catalog.change({action:'bind',persona:'none',use_current_model:true},unknown)
    assert.equal(await catalog.resolve(unknown),null)
    await controller.refreshPersona();assert.equal(controller.snapshot().route.persona,'none')
    const fixed=openCatalog({...config,mode:'fixed',persona:'kimi'})
    assert.equal((await fixed.resolve(unknown)).id,'kimi')
  } finally { controller.dispose();await rm(personasDir,{recursive:true,force:true}) }
})

const frames=y=>[0,40].map(x=>({sheet:'baseline',rect:[x,y,40,50],at:[100,200]}))
const source={canvas:[320,380],sheets:{baseline:'authored-neutral.png'},clips:{
  idle:{frames:frames(0),frameMs:100,loop:true},
  working:{frames:frames(50),frameMs:100,loop:true}
}}
test('minimal authored neutral frames cover all nine states without synthetic source frames',()=>{
  const art=buildStandardManifest(source)
  assert.deepEqual(Object.keys(source.clips),['idle','working'])
  const actualFrames=new Set(Object.values(source.clips).flatMap(clip=>clip.frames))
  assert(Object.values(art.clips).every(clip=>clip.frames.every(frame=>actualFrames.has(frame))))
  assert.equal(art.stateMap.thinking,'working');assert.equal(art.stateMap.waiting,'idle')
  for(const activity of ['searching','editing','commanding','testing']) {
    assert.equal(art.workingActivityMap[activity],'working')
    assert.equal(art.fallbackSources[activity],'working')
    const p=new AnimationPlayer(art)
    p.update({phase:'working',activity,signal:1},{},0)
    assert.equal(p.tick(120).index,1)
    assert.equal(p.tick(220).index,0)
  }
  const p=new AnimationPlayer(art)
  p.update({phase:'completed',activity:'idle',signal:1,pulse:{kind:'success',id:1}},{},0)
  assert.equal(p.tick(120).clip,art.stateMap.success)
  assert.equal(p.tick(220).clip,'idle')
  p.update({phase:'error',activity:'error',signal:2},{},230)
  assert.equal(p.tick(700).clip,art.stateMap.error)
  assert.equal(p.tick(700).index,1);assert.equal(p.tick(700).nextDelay,null)
  assert.equal(art.fallbackSources.success,'idle');assert.equal(art.fallbackSources.error,'idle')
  assert(!p.interact('poke',800));assert(!p.startDrag(800))
})

test('authored specialized clips win, and unavailable or empty source frames fail explicitly',()=>{
  const success={frames:frames(100),frameMs:80,loop:false}
  const art=buildStandardManifest({...source,clips:{...source.clips,searching:source.clips.working,success}})
  assert.equal(art.workingActivityMap.searching,'searching')
  assert.equal(art.stateMap.success,'success');assert.equal(art.clips.success,success)
  assert(!Object.hasOwn(art.fallbackSources,'success'))
  assert(!Object.hasOwn(art.fallbackSources,'searching'))
  assert.throws(()=>buildStandardManifest({...source,clips:{idle:source.clips.idle}}),/actual idle and working/)
  assert.throws(()=>buildStandardManifest({...source,sheets:{}}),/unknown sheet/)
  assert.throws(()=>buildStandardManifest({...source,clips:{...source.clips,working:{frames:[]}}}),/no authored frames/)
})
