import assert from 'node:assert/strict'
import {ART} from '../../pet/art.js'
import {AnimationPlayer} from '../../pet/animation.js'
const m=ART.minimax,clip=m.clips.authored_responding
const sequence=[0,1,2,3,4,5,6,7,8],durations=[900,400,550,350,1400,350,550,400,1400]
assert.deepEqual(clip.frames.map(f=>f.rect[0]/320),sequence)
assert.deepEqual(clip.durations,durations)
assert.equal(clip.loop,true)
assert.equal(m.sheets.authored_responding,'minimax-responding-v003.png')
assert.equal(m.revision,'state-art-20261025-4')
for(const f of clip.frames){assert.deepEqual(f.at,[0,0]);assert.deepEqual(f.size,[320,380])}
const player=new AnimationPlayer(m,{now:0});player.update({phase:'responding',activity:'responding',signal:1},{},0)
assert.equal(player.duration('authored_responding'),6300)
for(const [time,source] of [[0,0],[900,1],[1300,2],[1850,3],[2200,4],[3600,5],[3950,6],[4500,7],[4900,8],[6300,0]])assert.equal(player.tick(time).frame.rect[0]/320,source,'old key onset '+time)
for(const [time,source] of [[900,1],[1299,1],[4500,7],[4899,7]])assert.equal(player.tick(time).frame.rect[0]/320,source,'new middle pose '+time)
console.log('PASS: accepted 1828 key onsets and 6300ms loop preserved; oblique-hand pose occupies two400ms windows; production AnimationPlayer verified')
