import {open,readdir,writeFile,mkdir} from 'node:fs/promises'
import {resolve,dirname,sep} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {BUILTINS} from '../../catalog.js'
import {artFor} from '../../pet/art.js'
import {AnimationPlayer} from '../../pet/animation.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const positive=value=>Number.isFinite(value)&&value>0
const pair=(value,predicate=Number.isFinite)=>Array.isArray(value)&&value.length===2&&value.every(predicate)
const STATES=['idle','thinking','working','waiting','success','error']
const ACTIVITIES=['searching','editing','commanding','testing']
const signature=Buffer.from([137,80,78,71,13,10,26,10])

/** Read the real PNG IHDR; a filename or declared manifest size is not evidence. */
export async function pngDimensions(file) {
  const handle=await open(file,'r')
  try {
    const header=Buffer.alloc(33)
    const {bytesRead}=await handle.read(header,0,header.length,0)
    if(bytesRead!==33||!header.subarray(0,8).equals(signature)||header.readUInt32BE(8)!==13||header.toString('ascii',12,16)!=='IHDR')throw new Error('Missing PNG signature or IHDR')
    const width=header.readUInt32BE(16),height=header.readUInt32BE(20)
    if(!width||!height)throw new Error('PNG dimensions must be positive')
    return {width,height,bitDepth:header[24],colorType:header[25]}
  } finally {await handle.close()}
}

/** Product asset gate. It does not replace alpha-boundary or visual review. */
export async function checkManifestAssets(art,{assets=resolve(root,'pet/assets'),expected=BUILTINS.map(role=>role.id)}={}) {
  const report={
    kind:'kujira-manifest-asset-integrity',checkedAt:new Date().toISOString(),
    scope:'Read-only PNG headers, source and destination rectangles, referenced assets and actual AnimationPlayer state resolution. Image anatomy, alpha cleanliness and pose quality require separate visual review.',
    expectedCharacterCount:expected.length,actualCharacterCount:Object.keys(art).length,
    canvas:[320,380],characters:{},sheets:{},errors:[],summary:{clips:0,frameEntries:0,uniqueSourceRects:0,stateResolutions:0},
  }
  const issue=(code,where,message,details={})=>report.errors.push({code,where,message,...details})
  const dimensions=new Map(),sources=new Set()
  const inAssets=file=>typeof file==='string'&&file.length>0&&resolve(assets,file).startsWith(resolve(assets)+sep)
  for(const id of expected)if(!Object.hasOwn(art,id))issue('missing-character',id,'Built-in character has no raster manifest')
  // The old flat character placeholders are removed from the shipped asset set.
  const oldFlat=new Set([...expected,'unknown'].flatMap(id=>[`${id}.png`,`${id}.svg`]))
  for(const file of await readdir(assets))if(oldFlat.has(file))issue('legacy-static-asset',file,'Legacy flat character art remains in the product asset folder')
  for(const id of [null,'','unknown','unmapped-model'])if(artFor(id)!==art.stella)issue('stella-route',String(id),'Unmapped routes must resolve to Stella art')
  for(const [id,manifest]of Object.entries(art)) {
    const start=report.errors.length,clips=manifest?.clips??{},sheets=manifest?.sheets??{}
    const character=report.characters[id]={revision:manifest?.revision??null,clipCount:Object.keys(clips).length,frameEntries:0,uniqueSourceRects:0,resolvedStates:{},fallbackSources:manifest?.fallbackSources??{}}
    if(!pair(manifest?.canvas,positive)||manifest.canvas[0]!==320||manifest.canvas[1]!==380)issue('canvas',id,'All character canvases must be exactly 320×380',{actual:manifest?.canvas})
    if(typeof manifest?.revision!=='string'||!manifest.revision)issue('revision',id,'Manifest revision must be a nonempty string')
    if(!Object.keys(sheets).length)issue('empty-sheets',id,'Manifest has no referenced PNG sheets')
    for(const [name,file]of Object.entries(sheets)) {
      const where=`${id}.sheets.${name}`
      if(!inAssets(file)||!file.endsWith('.png')) {issue('sheet-path',where,'Sheet must reference a PNG under pet/assets');continue}
      if(!dimensions.has(file)) {
        try {dimensions.set(file,await pngDimensions(resolve(assets,file)))}
        catch(error) {dimensions.set(file,{error:error.code??error.message})}
      }
      const size=dimensions.get(file)
      if(size.error)issue('sheet-unavailable',where,'Referenced PNG is missing or has an invalid header',{file,reason:size.error})
      else report.sheets[file]=size
    }
    const ownSources=new Set()
    for(const [name,clip]of Object.entries(clips)) {
      const where=`${id}.clips.${name}`
      report.summary.clips++
      if(!Array.isArray(clip?.frames)||!clip.frames.length) {issue('empty-clip',where,'Clip must contain at least one actual frame');continue}
      if(typeof clip.loop!=='boolean')issue('loop-type',where,'Clip loop must be boolean')
      if(clip.durations!==undefined&&(!Array.isArray(clip.durations)||clip.durations.length!==clip.frames.length))issue('timing-count',where,'Explicit duration count must match frame count')
      for(const [index,frame]of clip.frames.entries()) {
        const atFrame=`${where}.frames[${index}]`
        character.frameEntries++;report.summary.frameEntries++
        if(!frame||typeof frame!=='object') {issue('frame-type',atFrame,'Frame must be an object');continue}
        const rect=frame.rect,at=frame.at??[0,0],size=frame.size??rect?.slice(2)
        const validRect=Array.isArray(rect)&&rect.length===4&&rect.every(Number.isInteger)&&rect[0]>=0&&rect[1]>=0&&rect[2]>0&&rect[3]>0
        if(!validRect)issue('source-rect',atFrame,'Source rectangle must be four integer pixels with nonnegative origin and positive dimensions',{rect})
        if(!pair(at))issue('destination-origin',atFrame,'Destination origin must be two finite numbers',{at})
        if(!pair(size,positive))issue('destination-size',atFrame,'Display size must be two finite positive numbers',{size})
        const file=sheets[frame.sheet],png=dimensions.get(file)
        if(!Object.hasOwn(sheets,frame.sheet))issue('unknown-sheet',atFrame,'Frame references an undefined sheet',{sheet:frame.sheet})
        if(validRect) {
          const key=JSON.stringify([file,rect]);sources.add(key);ownSources.add(key)
          if(png&&!png.error&&(rect[0]+rect[2]>png.width||rect[1]+rect[3]>png.height))issue('source-overflow',atFrame,'Frame extends beyond real PNG dimensions',{file,rect,png:[png.width,png.height]})
        }
        if(pair(at)&&pair(size,positive)&&pair(manifest.canvas,positive)) {
          const epsilon=.011 // Source calculations round each coordinate to hundredths.
          if(at[0]<-epsilon||at[1]<-epsilon||at[0]+size[0]>manifest.canvas[0]+epsilon||at[1]+size[1]>manifest.canvas[1]+epsilon)issue('canvas-overflow',atFrame,'Displayed frame rectangle extends beyond the shared canvas',{at,size,canvas:manifest.canvas})
        }
        const duration=clip.durations?.[index]??frame.duration??clip.frameMs??100
        if(!positive(duration))issue('duration',atFrame,'Frame duration must be finite and positive',{duration})
      }
    }
    character.uniqueSourceRects=ownSources.size
    for(const kind of STATES) {
      const target=manifest.stateMap?.[kind]
      if(typeof target!=='string'||!Object.hasOwn(clips,target))issue('state-map',`${id}.stateMap.${kind}`,'Standard state does not resolve to an actual clip',{target})
    }
    for(const activity of ACTIVITIES) {
      const target=manifest.workingActivityMap?.[activity]
      if(typeof target!=='string'||!Object.hasOwn(clips,target))issue('activity-map',`${id}.workingActivityMap.${activity}`,'Work activity does not resolve to an actual clip',{target})
    }
    for(const name of manifest.idleMicroClips??[])if(!clips[name]||clips[name].loop)issue('micro-clip',`${id}.idleMicroClips`,'Idle micro clip must exist and finish',{clip:name})
    // Resolve real built manifests with the player rather than merely checking keys.
    const cases=[
      ...STATES.map(kind=>[kind,kind==='success'?{phase:'completed',activity:'idle',pulse:{kind:'success',id:1}}:{phase:kind,activity:kind},manifest.stateMap?.[kind]]),
      ...ACTIVITIES.map(kind=>[kind,{phase:'working',activity:kind},manifest.workingActivityMap?.[kind]]),
    ]
    for(const [kind,task,target]of cases) {
      try {
        const player=new AnimationPlayer(manifest,{now:0,random:()=>.5})
        player.update({...task,signal:1},{activity:'quiet'},0)
        const result=player.tick(0)
        if(!target||result.clip!==target||result.frame!==clips[target]?.frames[result.index])throw new Error('Resolved clip/frame differs from the standard mapping')
        character.resolvedStates[kind]={clip:result.clip,frameCount:clips[result.clip].frames.length}
        report.summary.stateResolutions++
      } catch(error) {issue('player-resolution',`${id}.${kind}`,error.message)}
    }
    // A terminal error must hold its final pose, not wrap back to frame zero.
    try {
      const player=new AnimationPlayer(manifest,{now:0,random:()=>.5})
      player.update({phase:'error',activity:'error',signal:1},{activity:'quiet'},0)
      const target=manifest.stateMap.error,duration=player.duration(target)
      if(!positive(duration))throw new Error('Terminal error duration is invalid')
      const settled=player.tick(duration+101)
      if(settled.clip!==target||settled.index!==clips[target].frames.length-1||settled.nextDelay!==null)throw new Error('Terminal error must stop on the final frame after its authored duration')
      character.terminalErrorHoldsFinalFrame=true
    } catch(error) {issue('terminal-error-hold',`${id}.error`,error.message)}
    character.passed=report.errors.length===start
  }
  report.summary.uniqueSourceRects=sources.size
  report.summary.pngSheets=Object.keys(report.sheets).length
  report.summary.passedCharacters=Object.values(report.characters).filter(value=>value.passed).length
  report.passed=report.errors.length===0
  return report
}

async function main() {
  const args=process.argv.slice(2)
  if(args.includes('--help')) {
    console.log('Usage: node scripts/qa/manifest-check.mjs [--report /path/to/manifest-result.json]\nRead-only product asset gate. Exits 1 when a referenced resource, rectangle or standard state is invalid.')
    return
  }
  const at=args.indexOf('--report'),destination=at<0?null:args[at+1]
  if(at>=0?(at!==0||args.length!==2||!destination):args.length!==0)throw new Error('Use --help for valid arguments')
  const {ART}=await import(pathToFileURL(resolve(root,'pet/art.js')).href)
  const report=await checkManifestAssets(ART)
  if(destination) {await mkdir(dirname(resolve(destination)),{recursive:true});await writeFile(destination,JSON.stringify(report,null,2)+'\n')}
  console.log(JSON.stringify({passed:report.passed,characters:`${report.actualCharacterCount}/${report.expectedCharacterCount}`,...report.summary,errors:report.errors},null,2))
  if(!report.passed)process.exitCode=1
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main()
