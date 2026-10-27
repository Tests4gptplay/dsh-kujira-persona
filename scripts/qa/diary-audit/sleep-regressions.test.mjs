import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDiarySleep,collectResponse} from '../../../diary-sleep.js';
import {fixture,tick,waitFor} from './sleep-fixture.mjs';

test('unchanged no-progress stop is not resubmitted by status/turn/end/select; source change or explicit setting retry recovers',async()=>{
 const f=fixture(applyDiarySleep);try{await f.select();await waitFor(()=>f.streams===1&&f.sleep.snapshot().phase==='idle');assert.equal(f.diary.settings().enabled,false);
 for(let i=0;i<4;i++){f.emit('session/event',{id:'front'},{type:'turn/end'});f.emit('agent/status',{status:'idle'});await f.select();await tick();await tick()}
 assert.equal(f.streams,1);assert.equal(f.pending.length,1);
 f.setPending([{...f.pending[0],hash:'edited',text:'changed source'}]);f.emit('session/event',{id:'front'},{type:'turn/end'});await waitFor(()=>f.streams===2&&f.sleep.snapshot().phase==='idle');
 f.disable();await waitFor(()=>f.sleep.snapshot().phase==='off');f.enable();await waitFor(()=>f.streams===3&&f.sleep.snapshot().phase==='idle');
 }finally{f.close()}
});
test('pending idle barrier yields immediately to disabling sleep and recovers after re-enable',async()=>{
 const agents=[{id:'stuck',status:'idle',whenIdle:()=>new Promise(()=>{})}],f=fixture(applyDiarySleep,{agents});try{await f.select();await tick();await tick();assert.equal(f.sleep.snapshot().phase,'checking');f.disable();await waitFor(()=>f.sleep.snapshot().phase==='off');assert.equal(f.streams,0);agents.length=0;f.enable();await waitFor(()=>f.streams===1&&f.sleep.snapshot().phase==='idle')}finally{f.close()}
});
test('pending idle barrier yields to foreground start; later idle event can continue',async()=>{
 const agent={id:'front',status:'idle',whenIdle:()=>new Promise(()=>{})},f=fixture(applyDiarySleep,{agents:[agent]});try{await f.select();await tick();await tick();agent.status='running';f.emit('agent/status',{status:'running'});await waitFor(()=>f.sleep.snapshot().phase==='waiting');assert.equal(f.streams,0);agent.status='idle';agent.whenIdle=async()=>{};f.emit('agent/status',{status:'idle'});await waitFor(()=>f.streams===1&&f.sleep.snapshot().phase==='idle')}finally{f.close()}
});
test('ordinary agent event can invalidate an obsolete unresolved idle promise without starting duplicate model work',async()=>{
 const agent={id:'front',status:'idle',whenIdle:()=>new Promise(()=>{})},f=fixture(applyDiarySleep,{agents:[agent]});try{await f.select();await tick();await tick();agent.whenIdle=async()=>{};f.emit('agent/status',{status:'idle'});await waitFor(()=>f.streams===1&&f.sleep.snapshot().phase==='idle')}finally{f.close()}
});
test('missing whenIdle stays safely waiting, with no request, and next host event recovers',async()=>{
 const agent={id:'front',status:'idle'},f=fixture(applyDiarySleep,{agents:[agent]});try{await f.select();await waitFor(()=>f.sleep.snapshot().phase==='waiting');assert.equal(f.streams,0);agent.whenIdle=async()=>{};f.emit('agent/status',{status:'idle'});await waitFor(()=>f.streams===1)}finally{f.close()}
});
test('reprepared route is checked before every stream; no request dispatched to fallback',async()=>{
 const f=fixture(applyDiarySleep,{respond:({streams,pending})=>[{type:'tool-call-delta',id:'read',index:0,name:'sleep_read',argumentsDelta:JSON.stringify({id:pending[0].id})},{type:'finish',reason:{kind:'tool-calls'}}],preparedConfig:(n,c)=>n===2?{...c,model:'unexpected-fallback'}:c});try{await f.select();await waitFor(()=>f.sleep.snapshot().phase==='error');assert.equal(f.prepares,2);assert.deepEqual(f.selections,['chosen']);assert.equal(f.pending.length,1)}finally{f.close()}
});
test('collector retains authoritative latest per-call usage, not sum of cumulative chunks',async()=>{
 async function* stream(){yield{type:'usage',usage:{inputTokens:8,outputTokens:2,totalTokens:10}};yield{type:'usage',usage:{inputTokens:10,outputTokens:4,totalTokens:14}};yield{type:'finish',reason:{kind:'stop'}}}
 const r=await collectResponse(stream(),new AbortController().signal);assert.deepEqual(r.usage,{inputTokens:10,outputTokens:4,totalTokens:14});assert.deepEqual(r.blocks,[]);
});
test('snapshot reports call count and token usage including last report before error',async()=>{
 const f=fixture(applyDiarySleep,{respond:async function*(){yield{type:'usage',usage:{inputTokens:10,outputTokens:4,totalTokens:14}};yield{type:'usage',usage:{outputTokens:5,totalTokens:15}};throw Error('synthetic after-usage failure')}});try{await f.select();await waitFor(()=>f.sleep.snapshot().phase==='error');assert.deepEqual(f.sleep.snapshot().usage,{requests:1,reportedRequests:1,tokens:{inputTokens:10,outputTokens:5,totalTokens:15}});const copy=f.sleep.snapshot();copy.usage.tokens.inputTokens=0;assert.equal(f.sleep.snapshot().usage.tokens.inputTokens,10)}finally{f.close()}
});
test('transient transport error is not recorded as permanent no-progress; normal event retries',async()=>{
 const f=fixture(applyDiarySleep,{respond:async function*({streams}){if(streams===1)throw Error('transient');yield{type:'finish',reason:{kind:'stop'}}}});try{await f.select();await waitFor(()=>f.sleep.snapshot().phase==='error');f.emit('session/event',{id:'front'},{type:'turn/end'});await waitFor(()=>f.streams===2&&f.sleep.snapshot().phase==='idle')}finally{f.close()}
});
