import assert from 'node:assert/strict'
import {AnimationPlayer} from '../../pet/animation.js'
import {ART} from '../../pet/art.js'

const normal=new AnimationPlayer(ART.gpt,{now:0})
normal.update({phase:'working',activity:'editing',signal:'edit'}, {}, 10)
const halfway=normal.tick(60)
assert.equal(halfway.layers.length,2)
assert(halfway.layers.every(layer=>Math.abs(layer.opacity-.5)<1e-9))
assert.equal(normal.tick(110).layers.length,1)

const rapid=new AnimationPlayer(ART.gpt,{now:0})
let maxLayers=0
for(let i=1;i<=5000;i++){
  rapid.update({phase:'working',activity:i%2?'editing':'searching',signal:String(i)}, {}, i)
  const frame=rapid.tick(i+.5)
  maxLayers=Math.max(maxLayers,frame.layers.length)
  assert(frame.layers.length<=2,'Interrupted actions must not grow the renderer layer list')
  assert(frame.layers.every(layer=>Number.isFinite(layer.opacity)&&layer.opacity>0&&layer.opacity<=1))
}
const settled=rapid.tick(5101)
assert.equal(settled.clip,'searching')
assert.equal(settled.layers.length,1)
rapid.startDrag(5200)
assert.equal(rapid.tick(5200).clip,'dragging')
assert.equal(rapid.tick(5200).layers.length,1)
rapid.update({phase:'working',activity:'testing',signal:'new-work'}, {}, 5210)
rapid.endDrag(5220)
assert.equal(rapid.tick(5220).clip,'landing')
assert.equal(rapid.tick(5220+rapid.duration('landing')+1).clip,'testing')
console.log(JSON.stringify({passed:true,normalFadeMs:100,rapidUpdates:5000,maxLayers,settledClip:settled.clip,dragLandingRestoresLatestWork:true}))
