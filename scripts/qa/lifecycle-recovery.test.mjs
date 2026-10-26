import test from 'node:test'
import assert from 'node:assert/strict'
import {PetController} from '../../pet/controller.js'
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const promptly=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('blocked by unrelated pending dependency')),100)})])}finally{clearTimeout(timer)}}
const observed={events:[],cursor:-1,inheritedEventCount:0,running:false,projections:{values:{}}}
test('a pending history read cannot hold the settings write queue or prevent disabling',async()=>{
 const history=deferred(),started=deferred(),saved=[];const c=new PetController({config:{enabled:false,showUsage:false},resolvePersona:()=>null,readSession:()=>{started.resolve();return history.promise},persist:async value=>saved.push(value)})
 try{await c.select({provider:'fixture',model:'minimax',sessionId:'s'});const enable=c.configure({enabled:true});await started.promise;const disable=c.configure({enabled:false});await promptly(Promise.all([enable,disable]));assert.equal(saved.length,2);assert.equal(c.config.enabled,false)}finally{history.resolve(observed);c.dispose()}
})
test('disabling usage releases callers even when provider ignores the cancellation signal',async()=>{
 const usage=deferred(),started=deferred();const c=new PetController({config:{enabled:true,showUsage:true,refreshSeconds:0},resolvePersona:()=>null,queryUsage:()=>{started.resolve();return usage.promise}});c.route={...c.route,provider:'fixture',model:'minimax'}
 try{const request=c.refresh();await started.promise;await c.configure({showUsage:false});await promptly(request);assert.equal(c.pending,null);assert.equal(c.config.showUsage,false)}finally{usage.resolve({status:'ready',lines:[]});c.dispose()}
})
test('a failed settings save does not poison the next write',async()=>{
 let fail=true;const c=new PetController({config:{showUsage:false},persist:async()=>{if(fail){const e=Error('test');e.code='ENOSPC';throw e}}})
 try{await assert.rejects(c.configure({enabled:true}),/磁盘空间不足/);assert.equal(c.config.enabled,false);fail=false;await c.configure({enabled:true});assert.equal(c.config.enabled,true)}finally{c.dispose()}
})
test('a rejected history read can recover on the next ordinary selection',async()=>{
 let reads=0;const c=new PetController({config:{enabled:true,showUsage:false},resolvePersona:()=>null,readSession:async()=>{if(++reads===1)throw Error('transient fixture');return{...observed,cursor:1,events:[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'turn/end',data:{reason:{kind:'completed'}}}]}}})
 try{await c.select({provider:'fixture',model:'minimax',sessionId:'s'});assert.equal(c.sessionStates.get('s').hydration,null);await c.select({provider:'fixture',model:'minimax',sessionId:'s'});assert.equal(reads,2);assert.equal(c.task.phase,'completed')}finally{c.dispose()}
})
test('late cancelled usage cannot replace a subsequent successful refresh',async()=>{
 const old=deferred(),fresh=deferred(),started=[deferred(),deferred()];let calls=0
 const c=new PetController({config:{enabled:true,showUsage:true,refreshSeconds:0},queryUsage:()=>{const n=calls++;started[n].resolve();return n===0?old.promise:fresh.promise}});c.route={...c.route,provider:'fixture',model:'minimax'}
 try{const first=c.refresh();await started[0].promise;await c.configure({showUsage:false});await promptly(first)
  await c.configure({showUsage:true});await started[1].promise;const second=c.refresh();fresh.resolve({status:'ready',title:'fresh',lines:['current']});await promptly(second);assert.equal(c.usage.title,'fresh')
  old.resolve({status:'ready',title:'stale cancelled',lines:['old']});await Promise.resolve();await Promise.resolve();assert.equal(c.usage.title,'fresh');assert.equal(calls,2);assert.equal(c.pending,null)
 }finally{old.resolve({status:'unavailable',lines:[]});fresh.resolve({status:'unavailable',lines:[]});c.dispose()}
})
test('30-minute refresh preference round-trips unchanged, and zero keeps automatic refresh off',async()=>{
 let saved;const c=new PetController({config:{enabled:true,showUsage:true,refreshSeconds:1800},now:()=>0,persist:async value=>{saved=value},queryUsage:async()=>({status:'ready',lines:[]})});c.route={...c.route,provider:'fixture',model:'minimax'}
 try{assert.equal(c.config.refreshSeconds,1800);await c.configure({refreshSeconds:1800});assert.equal(saved.refreshSeconds,1800);assert.equal(c.config.refreshSeconds,1800);assert.equal(c.timer._idleTimeout,1800000)
  await c.configure({refreshSeconds:0});assert.equal(c.timer,null);assert.equal(saved.refreshSeconds,0)
 }finally{c.dispose()}
})
test('intervals beyond the timer range wait in chunks without an early provider query',async()=>{
 const max=2**31-1;let now=0,calls=0;const c=new PetController({config:{enabled:true,showUsage:true,refreshSeconds:(max+5000)/1000},now:()=>now,queryUsage:async()=>{calls++;return{status:'ready',lines:[]}}});c.route={...c.route,provider:'fixture',model:'minimax'}
 const fire=()=>{const timer=c.timer,fn=timer._onTimeout;clearTimeout(timer);fn()}
 try{c.schedule();assert.equal(c.timer._idleTimeout,max);assert.equal(calls,0);now=max;fire();assert.ok(Math.abs(c.timer._idleTimeout-5000)<1);assert.equal(calls,0)
  now=max+5000;fire();await promptly(c.pending);assert.equal(calls,1);assert.equal(c.config.refreshSeconds,(max+5000)/1000)
 }finally{c.dispose()}
})
