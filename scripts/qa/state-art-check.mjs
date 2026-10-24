import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {ART} from '../../pet/art.js'
import {AnimationPlayer} from '../../pet/animation.js'
const packageJson=JSON.parse(await readFile(new URL('../../package.json',import.meta.url)))
const expected={deepseek:['responding','searching','testing','commanding'],minimax:['responding','thinking','editing','searching','testing','commanding'],claude:['responding','thinking','searching','testing','commanding']}
let entries=0
for(const [role,states] of Object.entries(expected)){
 const a=ART[role], p=new AnimationPlayer(a,{now:0,random:()=>0})
 assert.equal(a.workingActivityMap['using-tool'],a.stateMap.idle)
 assert.equal(a.fallbackSources['using-tool'],a.stateMap.idle)
 for(const state of states){
  const phase=['responding','thinking'].includes(state)?state:'working'
  const key=p.clipFor(phase,state)
  assert.equal(key,'authored_'+state)
  assert.equal(a.fallbackSources[state],undefined)
  const cl=a.clips[key];assert.equal(cl.frames.length,cl.durations.length)
  for(const f of cl.frames){
   const path='pet/assets/'+a.sheets[f.sheet]
   assert(packageJson.files.includes(path),path+' not whitelisted')
   await access(new URL('../../'+path,import.meta.url)); entries++
  }
 }
 p.update({phase:'working',activity:'commanding',signal:1},{},0)
 const command=a.clips.authored_commanding
 assert.equal(command.loop,false)
 assert.equal(p.tick(60000).index,command.frames.length-1)
 assert.equal(p.tick(60000).nextDelay,null)
 if(role!=='minimax')assert.equal(a.workingActivityMap.editing,'working')
}
console.log(`PASS: 15 authored state bindings; ${entries} expanded playback entries; 3 command-once holds; 3 neutral unknown-tool fallbacks; explicit asset whitelist`)
