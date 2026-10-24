import {readFile,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

// Input is the curated, reviewed rectangles; no image processing happens here.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const input=process.argv[2]
if(!input)throw new Error('Pass the reviewed role-layout JSON path')
const roles=JSON.parse(await readFile(input,'utf8'))
const output=`/** Selected original frames. Generated with scripts/qa/build-secondary-art.mjs. */
import {buildStandardManifest} from './standard-manifest.js'
const DATA=${JSON.stringify(roles,null,2)}
const times=(name,n)=>Array.from({length:n},(_,i)=>name==='idle'?(i===0?2600:i===n-1?550:130):name==='waiting'?(i===0?1100:i===n-1?600:280):name==='success'?(i===n-1?650:200):name==='error'?(i===n-1?850:280):name==='dragging'?150:name==='landing'?(i===n-1?220:95):i===0||i===n-1?500:240)
function manifest(data){
  const clips=Object.fromEntries(Object.entries(data.clips).map(([name,clip])=>[name,{
    frames:clip.rows.map(([x,y,w,h,ax,ay])=>({sheet:clip.sheet,rect:[x,y,w,h],
      at:[Math.round((160-ax*clip.scale)*100)/100,Math.round((350-ay*clip.scale)*100)/100],
      size:[Math.round(w*clip.scale*100)/100,Math.round(h*clip.scale*100)/100]})),
    durations:times(name,clip.rows.length),loop:!['success','error','landing','head_pat','poke','tail'].includes(name)
  }]))
  return buildStandardManifest({revision:'reviewed-20261024-2',canvas:[320,380],sheets:data.sheets,
    stateMap:{idle:'idle',working:'working'},clips})
}
export const SECONDARY_ART=Object.fromEntries(Object.entries(DATA).map(([id,data])=>[id,manifest(data)]))
`
await writeFile(resolve(root,'pet/art-secondary.js'),output)
console.log(`Saved ${Object.keys(roles).length} reviewed companion manifests`)
