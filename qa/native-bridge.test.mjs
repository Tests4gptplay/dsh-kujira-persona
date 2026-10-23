import test from 'node:test'
import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {writeFile} from 'node:fs/promises'
import {NativePet} from '../candidate/pet/native.js'
const wait=async fn=>{for(let i=0;i<60;i++){if(fn())return;await new Promise(r=>setTimeout(r,100))}throw new Error('Native bridge condition not observed')}
const state=art=>({config:{enabled:true,scale:1,bubbleScale:1,reducedMotion:true,bubble:'always',showUsage:false},route:{art,name:art},task:{phase:'idle',text:'Bridge test'},usage:null})
test('real native bridge changes one process and reopens after exact shutdown',async()=>{
 const statuses=[];const native=new NativePet(resolve('candidate/pet'),(renderer,error)=>statuses.push({renderer,error}),()=>{})
 try{
  await native.show(state('deepseek'));await wait(()=>statuses.some(s=>s.renderer==='desktop'));const first=native.child
  assert.ok(first?.pid);await native.show(state('gpt'));assert.equal(native.child,first);assert.equal(native.last.route.art,'gpt')
  native.hide();await native.show(state('glm'));await wait(()=>statuses.filter(s=>s.renderer==='desktop').length===2)
  assert.ok(native.child?.pid);assert.notEqual(native.child,first);assert.notEqual(first.exitCode,null)
  native.dispose();await native.stopping;assert.equal(native.child,null);assert.ok(!statuses.some(s=>s.error))
  await writeFile('evidence/native-bridge.json',JSON.stringify({ok:true,sameProcessAcrossModels:true,rapidOffOn:true,closed:true,statuses},null,2))
 }finally{native.dispose();await native.stopping}
})
