/**
 * Shared Web/native sprite timing. Behaviour follows dsh-dafeiyu's
 * animation-behavior.md / animation_model.py (MIT; see bundled license).
 * Rendering is separate: no timers, DOM, IPC, or host calls in this model.
 */
const DRAG=new Set(['dragging','landing'])
const INTERACTION=new Set(['head_pat','poke','tail'])
const INTERVALS={quiet:[45000,90000],normal:[25000,45000],lively:[12000,22000]}
export class AnimationPlayer {
  constructor(manifest,{now=0,random=Math.random}={}) {
    this.manifest=manifest;this.clips=manifest.clips;this.random=random
    this.phase='idle';this.activity='idle';this.base=manifest.stateMap.idle
    this.overlay=null;this.pulse=null;this.pulseId=null;this.signal=null
    this.active=null;this.started=now;this.lastMicro=null
    this.reduced=false;this.level='normal';this.nextMicroAt=null;this.transition=null;this.transitionId=0
    this.activate(this.base,now)
  }
  clipFor(phase,activity) {
    return [phase==='working'&&this.manifest.workingActivityMap?.[activity],this.manifest.stateMap[phase],this.manifest.stateMap.idle].find(name=>this.clips[name])
  }
  duration(name) {
    const clip=this.clips[name]
    return clip.frames.reduce((sum,frame,index)=>sum+(clip.durations?.[index]??frame.duration??clip.frameMs??100),0)
  }
  frameAt(now) {
    const clip=this.clips[this.active],duration=this.duration(this.active)
    let elapsed=Math.max(0,now-this.started)
    if(clip.loop)elapsed%=duration
    else if(elapsed>=duration)return {index:clip.frames.length-1,remaining:null}
    let index=0
    for(;index<clip.frames.length-1;index++){
      const length=clip.durations?.[index]??clip.frames[index].duration??clip.frameMs??100
      if(elapsed<length)break
      elapsed-=length
    }
    return {index,remaining:(clip.durations?.[index]??clip.frames[index].duration??clip.frameMs??100)-elapsed}
  }
  layersAt(index,now) {
    const current={frame:this.clips[this.active].frames[index],opacity:1}
    if(!this.transition)return [current]
    const mix=Math.min(1,Math.max(0,(now-this.transition.at)/this.transition.fadeMs))
    if(mix===1)return [current]
    return [...this.transition.layers.map(layer=>({...layer,opacity:layer.opacity*(1-mix)})),{...current,opacity:mix}].filter(layer=>layer.opacity>0)
  }
  activate(name,now,restart=false) {
    if(!this.clips[name]||(!restart&&name===this.active))return
    const fade=this.manifest.transitionMode!=='cut'&&this.active&&!this.reduced&&!DRAG.has(name)&&!DRAG.has(this.active)
    const visible=fade?this.layersAt(this.frameAt(now).index,now):null
    // An interrupted fade starts from the dominant visible pose, keeping two layers.
    const layers=visible?[{frame:visible.reduce((best,layer)=>layer.opacity>=best.opacity?layer:best).frame,opacity:1}]:null
    this.transition=fade?{id:++this.transitionId,from:this.active,to:name,at:now,fadeMs:100,layers}:null
    this.active=name;this.started=now
  }
  underlay(){return this.pulse?.name??this.base}
  scheduleMicro(now) {
    const range=INTERVALS[this.level]??INTERVALS.normal
    this.nextMicroAt=now+range[0]+this.random()*(range[1]-range[0])
  }
  update(task={},config={},now=0) {
    const phase=task.phase==='completed'?'idle':task.phase??'idle'
    const changed=task.signal!==this.signal||phase!==this.phase||task.activity!==this.activity
    const wasReduced=this.reduced,oldLevel=this.level
    this.phase=phase;this.activity=task.activity;this.base=this.clipFor(phase,task.activity)
    this.signal=task.signal;this.level=config.activity??'normal';this.reduced=!!config.reducedMotion
    if(this.reduced) {
      this.overlay=null;this.pulse=null;this.nextMicroAt=null;this.pulseId=task.pulse?.id??this.pulseId
      this.activate(this.manifest.stateMap.idle,now);this.transition=null;return
    }
    if(wasReduced)this.activate(this.base,now)
    if(changed&&phase!=='idle'){
      this.pulse=null
      if(!DRAG.has(this.overlay))this.overlay=null
    }
    if(task.pulse&&task.pulse.id!==this.pulseId){
      this.pulseId=task.pulse.id
      const name=this.manifest.stateMap[task.pulse.kind]
      if(this.clips[name]){
        this.pulse={name,until:now+this.duration(name)}
        if(!DRAG.has(this.overlay)){this.overlay=null;this.activate(name,now,true)}
      }
    }
    if(!this.overlay)this.activate(this.underlay(),now)
    if(phase!=='idle')this.nextMicroAt=null
    else if(this.nextMicroAt===null||wasReduced||oldLevel!==this.level)this.scheduleMicro(now)
  }
  startDrag(now) {
    if(this.reduced||!this.clips.dragging)return false
    this.overlay='dragging';this.activate('dragging',now);return true
  }
  endDrag(now) {
    if(this.overlay!=='dragging')return false
    this.overlay=this.clips.landing?'landing':null
    this.activate(this.overlay??this.underlay(),now);return true
  }
  interact(name,now) {
    if(this.reduced||!INTERACTION.has(name)||!this.clips[name]||this.pulse||this.overlay)return false
    this.overlay=name;this.activate(name,now);return true
  }
  tick(now) {
    if(this.reduced)return this.result(0,null,now)
    if(this.pulse&&now>=this.pulse.until){
      this.pulse=null
      if(!this.overlay)this.activate(this.base,now)
    }
    if(this.phase==='idle'&&!this.overlay&&!this.pulse&&this.nextMicroAt!==null&&now>=this.nextMicroAt){
      let candidates=(this.manifest.idleMicroClips??[]).filter(name=>this.clips[name])
      if(candidates.length>1)candidates=candidates.filter(name=>name!==this.lastMicro)
      if(candidates.length){this.overlay=candidates[Math.floor(this.random()*candidates.length)];this.lastMicro=this.overlay;this.activate(this.overlay,now)}
      this.nextMicroAt=null
    }
    let clip=this.clips[this.active],elapsed=Math.max(0,now-this.started),duration=this.duration(this.active)
    if(elapsed>=duration&&!clip.loop&&this.overlay){
      this.overlay=null;this.activate(this.underlay(),now)
      if(this.phase==='idle')this.scheduleMicro(now)
      clip=this.clips[this.active];elapsed=0;duration=this.duration(this.active)
    }
    const {index,remaining}=this.frameAt(now),deadline=this.deadlineDelay(now)
    const delays=[remaining,deadline].filter(value=>value!==null)
    return this.result(index,delays.length?Math.max(1,Math.min(...delays)):null,now)
  }
  deadlineDelay(now) {
    const times=[this.pulse?.until,this.phase==='idle'&&!this.overlay?this.nextMicroAt:null].filter(value=>value!=null)
    return times.length?Math.max(1,Math.min(...times)-now):null
  }
  result(index,nextDelay,now) {
    if(this.transition&&now>=this.transition.at+this.transition.fadeMs)this.transition=null
    let key=this.active+':'+index
    if(this.transition){
      const remaining=this.transition.at+this.transition.fadeMs-now
      nextDelay=Math.max(1,Math.min(nextDelay??Infinity,16,remaining))
      key+=':fade:'+this.transition.id+':'+Math.round((now-this.transition.at)*10)
    }
    return {clip:this.active,index,frame:this.clips[this.active].frames[index],layers:this.layersAt(index,now),key,nextDelay,transition:this.transition}
  }
}

