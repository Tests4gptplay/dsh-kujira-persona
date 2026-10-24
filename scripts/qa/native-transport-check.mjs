import assert from 'node:assert/strict'
import test from 'node:test'
import {EventEmitter} from 'node:events'
import {NativePet} from '../../pet/native.js'

test('a blocked native pipe retains the newest state and frame, in that order',()=>{
  const pet=new NativePet('/unused',()=>{},()=>{}),written=[]
  const child={stdin:{writable:true,writableNeedDrain:true,write(line){written.push(JSON.parse(line));return true}}}
  pet.child=child
  for(let i=0;i<10000;i++){
    pet.write({revision:i,route:{art:'gpt'}})
    pet.write({type:'frame',index:i})
  }
  assert.equal(written.length,0)
  assert.equal(pet.pendingState.revision,9999)
  assert.equal(pet.pendingFrame.index,9999)
  child.stdin.writableNeedDrain=false
  pet.flush(child)
  assert.deepEqual(written,[{revision:9999,route:{art:'gpt'}},{type:'frame',index:9999}])
  assert.equal(pet.pendingState,null)
  assert.equal(pet.pendingFrame,null)
  pet.child=null;pet.dispose()
})

test('a drain that fills the pipe preserves the final frame for the next drain',()=>{
  const pet=new NativePet('/unused',()=>{},()=>{}),written=[]
  const child={stdin:{writable:true,writableNeedDrain:true,write(line){written.push(JSON.parse(line));this.writableNeedDrain=true;return false}}}
  pet.child=child
  pet.write({revision:10});pet.write({type:'frame',index:7})
  pet.flush({stdin:{}})
  assert.equal(pet.pendingState.revision,10)
  child.stdin.writableNeedDrain=false;pet.flush(child)
  assert.deepEqual(written,[{revision:10}])
  assert.equal(pet.pendingFrame.index,7)
  child.stdin.writableNeedDrain=false;pet.flush(child)
  assert.deepEqual(written,[{revision:10},{type:'frame',index:7}])
  pet.write({type:'frame',index:8});pet.stopFrames()
  assert.equal(pet.pendingFrame,null)
  pet.child=null;pet.dispose()
})

test('all native routes use atlas frames; unmapped and custom routes use Stella assets',()=>{
  const pet=new NativePet('/pet',()=>{},()=>{}),written=[]
  pet.child={stdin:{writable:true,writableNeedDrain:false,write(line){written.push(JSON.parse(line));return true}}}
  const state={config:{reducedMotion:true},route:{art:'gpt',sessionId:'one'},task:{phase:'idle'}}
  pet.send(state)
  assert.equal(written[0].animated,true)
  assert.equal(written[0].image,'')
  assert.equal(written[1].type,'frame')
  assert.match(written[1].image,/gpt-core-v3\.png$/)
  const before=written.length
  pet.send({...state,route:{art:'unknown',sessionId:'one'}})
  assert.equal(written[before].animated,true)
  assert.equal(written[before].image,'')
  assert.equal(written[before+1].type,'frame')
  assert.match(written[before+1].image,/stella-(?:core|status)-v1\.png$/)
  pet.child=null;pet.dispose()
})

test('hide clears blocked packets and waits only for its owned child exit',async()=>{
  const pet=new NativePet('/unused',()=>{},()=>{}),child=new EventEmitter()
  let ended=0,killed=0
  child.exitCode=null
  child.stdin={writable:true,writableNeedDrain:true,end(){ended++;this.writable=false}}
  child.kill=()=>{killed++;child.exitCode=0;child.emit('exit',0);return true}
  pet.child=child;pet.wanted=true
  pet.write({revision:1});pet.write({type:'frame',index:1})
  pet.hide();await pet.stopping
  assert.equal(pet.child,null)
  assert.equal(pet.pendingState,null)
  assert.equal(pet.pendingFrame,null)
  assert.equal(pet.wanted,false)
  assert.equal(ended,1)
  assert.equal(killed,1)
})
