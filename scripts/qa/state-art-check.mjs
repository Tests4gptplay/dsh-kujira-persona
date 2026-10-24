import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {ART} from '../../pet/art.js'
import {AnimationPlayer} from '../../pet/animation.js'
const packageJson=JSON.parse(await readFile(new URL('../../package.json',import.meta.url)))
const expected={deepseek:['responding','searching','testing','commanding'],minimax:['responding','thinking','editing','searching','testing','commanding'],claude:['responding','thinking','searching','testing','commanding'],kimi:['thinking','responding','editing','testing','commanding'],gemini:['thinking','responding','searching','testing','commanding'],qwen:['thinking','responding','searching','testing','commanding'],glm:['thinking','responding','searching','editing','testing','commanding'],llama:['thinking','responding','searching','editing','testing','commanding'],hunyuan:['thinking','responding','searching','editing','testing','commanding'],mimo:['thinking','responding','searching','editing','testing','commanding','waiting'],gpt:['responding'],mistral:['thinking','responding','searching','editing','commanding','testing'],stella:['thinking','responding','searching','editing','commanding','testing','working'],grok:['thinking','responding','editing','commanding','testing'],doubao:['thinking','responding','searching','editing','commanding','testing']}
let entries=0
for(const [role,states] of Object.entries(expected)){
 const a=ART[role], p=new AnimationPlayer(a,{now:0,random:()=>0})
 if(role==='gpt'){
  assert.equal(a.workingActivityMap['using-tool'],a.stateMap.idle)
  assert.equal(a.fallbackSources['using-tool'],a.stateMap.idle)
 }else if(role==='stella'){
  assert.equal(a.stateMap.working,'authored_working')
  assert.equal(a.workingActivityMap['using-tool'],'authored_working')
  assert.equal(a.fallbackSources['using-tool'],undefined)
  assert.equal(a.clips.authored_working.frames.length,3)
 }else{
  assert.equal(a.workingActivityMap['using-tool'],'neutral_tool')
  assert.equal(a.fallbackSources['using-tool'],undefined)
  assert.equal(a.clips.neutral_tool.loop,false)
  assert.deepEqual(a.clips.neutral_tool.frames,[a.clips.authored_commanding.frames.at(-1)])
  p.update({phase:'working',activity:'using-tool',signal:0},{},0)
  assert.equal(p.tick(60000).clip,'neutral_tool')
  assert.equal(p.tick(60000).nextDelay,null)
 }
 for(const state of states){
  const phase=['responding','thinking','waiting'].includes(state)?state:'working'
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
 if (a.clips.authored_commanding) {
 p.update({phase:'working',activity:'commanding',signal:1},{},0)
 const command=a.clips.authored_commanding
 assert.equal(command.loop,false)
 assert.equal(p.tick(60000).index,command.frames.length-1)
 assert.equal(p.tick(60000).nextDelay,null)
 }
 if(['deepseek','claude','gemini','qwen'].includes(role))assert.equal(a.workingActivityMap.editing,'working')
 if(['kimi','grok'].includes(role))assert.equal(a.workingActivityMap.searching,'working')
 if(['glm','llama'].includes(role)){
  p.update({phase:'working',activity:'editing',signal:2},{},70000)
  assert.equal(a.clips.authored_editing.loop,false)
  assert.equal(p.tick(130000).index,a.clips.authored_editing.frames.length-1)
  assert.equal(p.tick(130000).nextDelay,null)
 }
}
console.log(`PASS: 80 authored clip bindings (79 core + Stella neutral); ${entries} expanded playback entries; 14 command-once holds; 13 neutral observed-pose reuses, Stella authored neutral and GPT idle fallback; explicit asset whitelist`)

for(const [role,a] of Object.entries(ART)){
 for(const state of ['thinking','responding','searching','editing','commanding','testing','waiting','success','error']){
  assert.equal(a.fallbackSources[state],undefined,role+':'+state)
  assert(a.clips[a.stateMap[state]??a.workingActivityMap[state]]?.frames.length,role+':'+state)
 }
}
console.log('PASS: all 135 core state bindings use authored, retained or specific-reuse clips')
