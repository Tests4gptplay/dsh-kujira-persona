/**
 * Complete the functional state map using only supplied raster frames.
 * fallbackSources records neutral reuse; it does not imply bespoke artwork.
 */
const WORK = ['searching','editing','commanding','testing']
const positive = value => Number.isFinite(value) && value > 0
export function buildStandardManifest(manifest) {
  const clips = {...manifest.clips}, sheets = manifest.sheets ?? {}
  if (!Array.isArray(manifest.canvas) || manifest.canvas.length !== 2 || !manifest.canvas.every(positive)) throw new TypeError('Sprite canvas must have two positive dimensions')
  for (const [name,clip] of Object.entries(clips)) {
    if (!Array.isArray(clip.frames) || !clip.frames.length) throw new TypeError(`Clip ${name} has no authored frames`)
    clip.frames.forEach((frame,index) => {
      const rect = frame.rect
      if (!Object.hasOwn(sheets,frame.sheet) || typeof sheets[frame.sheet] !== 'string' || !sheets[frame.sheet]) throw new TypeError(`Clip ${name} references an unknown sheet`)
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) || rect[0] < 0 || rect[1] < 0 || !rect.slice(2).every(positive)) throw new TypeError(`Clip ${name} has an invalid frame rectangle`)
      for (const key of ['at','size']) if (frame[key] !== undefined && (!Array.isArray(frame[key]) || frame[key].length !== 2 || !frame[key].every(key === 'size' ? positive : Number.isFinite))) throw new TypeError(`Clip ${name} has invalid ${key}`)
      if (!positive(clip.durations?.[index] ?? frame.duration ?? clip.frameMs ?? 100)) throw new TypeError(`Clip ${name} has invalid frame timing`)
    })
  }
  const first = (...names) => names.find(name => typeof name === 'string' && Object.hasOwn(clips,name))
  const inputStates = manifest.stateMap ?? {}, inputWork = manifest.workingActivityMap ?? {}
  const idle = first(inputStates.idle,'idle')
  const working = first(inputStates.working,'working',inputWork.commanding,'commanding',...WORK.flatMap(name => [inputWork[name],name]))
  if (!idle || !working) throw new TypeError('Standard sprites require actual idle and working clips')
  const fallbackSources = {...manifest.fallbackSources}
  const choose = (kind,map,fallback) => {
    const supplied = first(map[kind],kind)
    if (supplied) return supplied
    fallbackSources[kind] = fallback
    return fallback
  }
  // A neutral result uses the existing idle frames once. A terminal error can
  // then hold its final frame, while a completion returns to the idle loop.
  const resultClip = kind => {
    const supplied = first(inputStates[kind],kind)
    if (supplied) return supplied
    let name = `neutral_${kind}`
    while (Object.hasOwn(clips,name)) name += '_'
    clips[name] = {...clips[idle],loop:false}
    fallbackSources[kind] = idle
    return name
  }
  const stateMap = {...inputStates,idle,working,
    thinking:choose('thinking',inputStates,working),
    waiting:choose('waiting',inputStates,idle),
    success:resultClip('success'),error:resultClip('error')}
  const workingActivityMap = Object.fromEntries(WORK.map(kind => [kind,choose(kind,inputWork,working)]))
  return {...manifest,clips,stateMap,workingActivityMap,fallbackSources,
    idleMicroClips:(manifest.idleMicroClips ?? []).filter(name => Object.hasOwn(clips,name) && !clips[name].loop)}
}
