import test from 'node:test'
import assert from 'node:assert/strict'
import {AnimationPlayer} from '../../pet/animation.js'
import {artFor} from '../../pet/art.js'
test('a finished error state does not permanently disable user interaction',()=>{
 const p=new AnimationPlayer(artFor('gpt'),{now:0});p.update({phase:'error',activity:'error',signal:1},{},0)
 assert.equal(p.interact('head_pat',2000),true);assert.equal(p.tick(2000).clip,'head_pat')
 assert.equal(p.tick(2000+p.duration('head_pat')).clip,p.manifest.stateMap.error)
})
test('a completed short interaction needs no unrelated 1200ms cooldown',()=>{
 const manifest=structuredClone(artFor('gpt'));manifest.clips.head_pat={frames:[manifest.clips.head_pat.frames[0]],durations:[100],loop:false}
 const p=new AnimationPlayer(manifest,{now:0});p.update({phase:'idle',activity:'idle',signal:1},{},0)
 assert.equal(p.interact('head_pat',0),true);assert.equal(p.interact('head_pat',50),false,'active interaction still owns its authored interval');p.tick(100);assert.equal(p.interact('head_pat',101),true)
})
test('user reduced motion and active pulse/drag still keep their presentation semantics',()=>{
 const p=new AnimationPlayer(artFor('gpt'),{now:0});p.update({phase:'idle',signal:1},{reducedMotion:true},0);assert.equal(p.interact('head_pat',2000),false)
 p.update({phase:'completed',signal:2,pulse:{id:1,kind:'success'}},{reducedMotion:false},2100);assert.equal(p.interact('head_pat',2101),false)
})
