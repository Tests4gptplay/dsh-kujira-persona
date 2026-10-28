import test from 'node:test';import assert from 'node:assert/strict';
import {ART} from '../../../pet/art.js';import {AnimationPlayer} from '../../../pet/animation.js';
const roles=['deepseek','claude','gemini','qwen','kimi','glm','minimax','llama','doubao','mistral','grok','hunyuan','mimo'];
for(const role of roles)test(role+' generic tool must not regress to a frozen command-result pose',()=>{
 const m=ART[role],p=new AnimationPlayer(m,{now:0,random:()=>0});const key=m.workingActivityMap['using-tool'],c=m.clips[key];
 assert.equal(key,'neutral_tool');assert.equal(c.loop,true);assert(c.frames.length>=2);assert(new Set(c.frames.map(x=>JSON.stringify(x))).size>=2);
 p.update({phase:'working',activity:'using-tool',signal:1},{},0);const period=c.durations.reduce((a,b)=>a+b,0);const seen=new Set();
 for(let t=0;t<period*4;t+=20){const f=p.tick(t);assert.equal(f.clip,key);assert(f.nextDelay>0);assert.equal(f.layers.length,1);assert.equal(f.layers[0].opacity,1);seen.add(f.index)}
 assert.equal(seen.size,c.frames.length);
 for(const slot of ['searching','editing','testing','commanding']){p.update({phase:'working',activity:slot,signal:2},{},period*4);assert.equal(p.tick(period*4+1).clip,m.workingActivityMap[slot]);p.update({phase:'working',activity:'using-tool',signal:3},{},period*4+10);assert.equal(p.tick(period*4+11).clip,key)}
 p.update({phase:'completed',activity:'completed',signal:4,pulse:{kind:'success',id:role+'-finish'}},{},period*5);assert.equal(p.tick(period*5).clip,m.stateMap.success);assert.equal(p.tick(period*5+p.duration(m.stateMap.success)+1).clip,m.stateMap.idle)
});
