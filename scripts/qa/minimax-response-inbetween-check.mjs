import assert from 'node:assert/strict'
import {ART} from '../../pet/art.js'
import {AnimationPlayer} from '../../pet/animation.js'
const m=ART.minimax,clip=m.clips.authored_responding
const sequence=[0,4,3,1,3,4,0,2,0],durations=[820,80,180,700,100,80,700,120,500]
assert.deepEqual(clip.frames.map(f=>f.rect[0]/400),sequence)
assert.deepEqual(clip.durations,durations)
assert.equal(clip.loop,true)
assert.equal(m.sheets.authored_responding,'minimax-responding-v002.png')
assert.equal(m.revision,'state-art-20261025-4')
for(const f of clip.frames){assert.deepEqual(f.at,[-40,0]);assert.deepEqual(f.size,[400,400])}
const player=new AnimationPlayer(m,{now:0});player.update({phase:'responding',activity:'responding',signal:1},{},0)
assert.equal(player.duration('authored_responding'),3280)
for(const [time,source] of [[0,0],[900,3],[1080,1],[1780,3],[1960,0],[2660,2],[2780,0],[3280,0]])assert.equal(player.tick(time).frame.rect[0]/400,source,'old key onset '+time)
for(const time of [820,899,1880,1959])assert.equal(player.tick(time).frame.rect[0]/400,4,'new middle pose '+time)
console.log('PASS: original key onsets and 3280ms loop preserved; one authored middle pose occupies two80ms windows; production AnimationPlayer verified')
