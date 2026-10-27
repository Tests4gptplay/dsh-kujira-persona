import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import {NativePet} from '../../pet/native.js'
const state={route:{art:'gpt',sessionId:'one'},config:{reducedMotion:true},task:{phase:'idle'}}
function setup(){
 const statuses=[],children=[],timers=[]
 const runtime={checkExecutable:async()=>{},setTimeout(fn,ms){const t={fn,ms,cleared:false,unref(){}};timers.push(t);return t},clearTimeout(t){if(t)t.cleared=true},launch(){
  const p=new EventEmitter();Object.assign(p,{pid:101+children.length,exitCode:null,signalCode:null,stdout:new PassThrough(),stderr:new PassThrough(),stdin:new PassThrough(),killCount:0,kill(){this.killCount++;this.signalCode='SIGTERM';this.emit('exit',null,'SIGTERM');return true}});children.push(p);return p
 }}
 const pet=new NativePet('/synthetic-qa-only',(...s)=>statuses.push(s),()=>{},runtime)
 return{pet,statuses,children,timers}
}
test('slow startup reports waiting at 15s without killing; late ready clears it',async()=>{
 const h=setup();await h.pet.show(state);assert.equal(h.timers[0].ms,15000)
 h.timers[0].fn();assert.match(h.statuses.at(-1)[1],/尚未就绪/);assert.equal(h.children[0].killCount,0)
 h.children[0].stdout.write('{"type":"ready"}\n');assert.deepEqual(h.statuses.at(-1),['desktop','']);assert.equal(h.timers[0].cleared,true)
 await h.pet.dispose()
})
test('closing cancels pending ready hint and another enable starts cleanly',async()=>{
 const h=setup();await h.pet.show(state);const old=h.children[0],timer=h.timers[0]
 await h.pet.hide();assert.equal(timer.cleared,true);const length=h.statuses.length;timer.fn();assert.equal(h.statuses.length,length)
 await h.pet.show(state);assert.equal(h.children.length,2);const next=h.children[1]
 const before=h.statuses.length;old.emit('error',Error('old process error'));old.stdout.write('{"type":"ready"}\n');timer.fn();assert.equal(h.statuses.length,before)
 next.stdout.write('{"type":"ready"}\n');assert.deepEqual(h.statuses.at(-1),['desktop','']);await h.pet.dispose()
})
test('closing child cannot re-announce readiness before its exit',async()=>{
 const h=setup();await h.pet.show(state);const p=h.children[0];p.kill=()=>true
 const stopping=h.pet.hide(),before=h.statuses.length;p.stdout.write('{"type":"ready"}\n');assert.equal(h.statuses.length,before)
 p.exitCode=0;p.emit('exit',0);await stopping;await h.pet.dispose()
})
test('stderr and exit code are visible without exposing the raw diagnostic',async()=>{
 const h=setup();await h.pet.show(state);const p=h.children[0]
 p.stderr.write('synthetic PRIVATE_FAKE_KEY and C:\\FakeUser\\file');h.timers[0].fn()
 assert.match(h.statuses.at(-1)[1],/程序有错误输出/);p.exitCode=23;p.emit('exit',23)
 assert.match(h.statuses.at(-1)[1],/退出码 23/);assert.match(h.statuses.at(-1)[1],/程序有错误输出/)
 assert(!JSON.stringify(h.statuses).includes('PRIVATE_FAKE_KEY'));assert(!JSON.stringify(h.statuses).includes('FakeUser'))
 await h.pet.show(state);assert.equal(h.children.length,2);h.children[1].stdout.write('{"type":"ready"}\n');assert.deepEqual(h.statuses.at(-1),['desktop','']);await h.pet.dispose()
})
