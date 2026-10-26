import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {fileURLToPath} from 'node:url'
import {readFile} from 'node:fs/promises'
import {NativePet} from '../../pet/native.js'
const root=fileURLToPath(new URL('../../pet/',import.meta.url))
function fixture(kill){
 const statuses=[],pet=new NativePet(root,(...args)=>statuses.push(args),()=>{}),child=new EventEmitter()
 Object.assign(child,{exitCode:null,signalCode:null,stdin:{end(){}},kill:()=>kill(child)})
 pet.child=child;return{pet,child,statuses}
}
test('dispose returns pending child-exit barrier; repeated disposal shares it',async()=>{
 const {pet,child}=fixture(()=>true);let done=false
 const stop=pet.dispose();stop.then(()=>done=true)
 assert.equal(pet.dispose(),stop);await Promise.resolve();assert.equal(done,false)
 child.signalCode='SIGTERM';child.emit('exit',null,'SIGTERM');await stop
 assert.equal(done,true);assert.equal(child.listenerCount('exit'),0);assert.equal(child.listenerCount('error'),0)
})
test('already signaled child needs no kill and settles',async()=>{
 const {pet,child}=fixture(()=>{throw Error('must not kill')});child.signalCode='SIGTERM';await pet.dispose()
})
test('kill false rejects promptly and reports the actual stop failure',async()=>{
 const {pet,statuses}=fixture(()=>false);await assert.rejects(pet.dispose(),/无法结束/);assert.match(statuses.at(-1)[1],/无法结束/)
})
test('kill throw and process error reject, rather than claiming successful exit',async()=>{
 for(const kill of [()=>{throw Error('kill denied')},p=>{p.emit('error',Error('kill denied'));return false}]){
  const {pet,child,statuses}=fixture(kill);await assert.rejects(pet.dispose(),/kill denied/)
  assert.match(statuses.at(-1)[1],/kill denied/);assert.equal(child.listenerCount('exit'),0)
 }
})
test('dispose during startup prevents delayed spawn and later show',async()=>{
 const pet=new NativePet(root,()=>{},()=>{});let release
 pet.stopping=new Promise(resolve=>{release=resolve})
 const start=pet.show({});const stop=pet.dispose();release();await Promise.all([start,stop])
 assert.equal(pet.child,null);assert.equal(pet.wanted,false);await pet.show({});assert.equal(pet.child,null)
})
test('scope disposer returns native shutdown promise after closing other resources',async()=>{
 const source=await readFile(new URL('../../pet/index.js',import.meta.url),'utf8')
 const match=source.match(/scope.effect\(\(\)=>(\(\)=>\{closed=true;[^\n]+\})\)/);assert.ok(match)
 let release;const stop=new Promise(resolve=>{release=resolve}),events=[]
 const run=new Function('native','controller','streams','assets','offEvent','offAssistant','offStatus','offSession','offState','offCatalog',`let closed=false;return (${match[1]})()`)
 const noop=()=>{},returned=run({dispose:()=>stop},{dispose:()=>events.push('controller')},new Set([{close:()=>events.push('stream')}]),new Map(),noop,noop,noop,noop,noop,noop)
 assert.equal(returned,stop);assert.deepEqual(events,['controller','stream']);release();await returned
})

test('stdin error still kills and waits for actual exit instead of claiming failed termination',async()=>{
 let killed=false;const {pet,child,statuses}=fixture(()=>{killed=true;return true})
 child.stdin.end=()=>{throw Error('stdin already closed')}
 const stop=pet.hide();assert.equal(killed,true);assert.equal(pet.child,child)
 assert.match(statuses.at(-1)[1],/stdin already closed/)
 child.exitCode=0;child.emit('exit',0);await stop;assert.equal(pet.child,null)
})
test('kill failure retains child and a later hide retries successfully',async()=>{
 let calls=0;const {pet,child}=fixture(()=>++calls>1)
 await assert.rejects(pet.hide(),/无法结束/);await pet.stopping
 assert.equal(pet.child,child);assert.equal(pet.stopRequest,null)
 const retry=pet.hide();assert.equal(calls,2);child.exitCode=0;child.emit('exit',0);await retry
 assert.equal(pet.child,null)
})
test('show after failed stop resumes owned child instead of rejecting forever or spawning another',async()=>{
 const {pet,child}=fixture(()=>false);await assert.rejects(pet.hide());await pet.stopping
 let sent;pet.send=state=>{sent=state};await pet.show({revision:42})
 assert.deepEqual(sent,{revision:42});assert.equal(pet.child,child)
 child.exitCode=0;await pet.dispose()
})
test('show while stop is pending waits; disposal prevents delayed restart',async()=>{
 const {pet,child}=fixture(()=>true);const stop=pet.hide();const show=pet.show({})
 assert.equal(pet.child,child);const dispose=pet.dispose();assert.equal(dispose,stop)
 child.exitCode=0;child.emit('exit',0);await Promise.all([stop,show,dispose]);assert.equal(pet.child,null)
})
test('real Cordis fiber unload remains pending until native exit',async t=>{
 if(!process.env.DSH_TEST_ROOT){t.skip('DSH_TEST_ROOT not supplied');return}
 const {createRequire}=await import('node:module'),{resolve}=await import('node:path')
 const require=createRequire(resolve(process.env.DSH_TEST_ROOT,'package.json'))
 const {Context}=await import(require.resolve('@deepseek-ai/cordis'))
 const {pet,child}=fixture(()=>true),ctx=new Context()
 const fiber=ctx.plugin({name:'native-disposal-fixture',apply(scope){scope.effect(()=>()=>pet.dispose())}})
 await fiber
 let completed=false;const disposing=Promise.resolve(fiber.dispose()).then(()=>{completed=true})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false)
 child.exitCode=0;child.emit('exit',0);await disposing;assert.equal(completed,true);await ctx.fiber.dispose()
})

test('exit state racing a false kill result settles without waiting for a missed event',async()=>{
 const {pet}=fixture(child=>{child.signalCode='SIGTERM';return false});await pet.hide();assert.equal(pet.child,null)
})
