import { NAMES,settings,emptyTask,reduceTask,unknownUsage } from './model.js'
import { workStats,STATS_EVENTS } from './stats.js'
import { modelFamily } from '../catalog.js'

/** One presentation state, shared by the settings page and the one pet renderer. */
export class PetController {
  constructor({config={},resolvePersona,queryUsage,readStats=()=>undefined,persist=async()=>{},now=Date.now}){
    this.config=settings(config);this.resolvePersona=resolvePersona;this.queryUsage=queryUsage;this.persist=persist;this.now=now;this.readStats=readStats;this.stats=null
    this.route={provider:'',model:'',family:'none',persona:'stella',name:NAMES.stella,art:'stella',sessionId:''}
    this.assistantStream=null;this.streamTurn=null;this.streamStep=null
    this.task=emptyTask();this.usage=unknownUsage('usage','选择模型后显示对应的用量')
    this.renderer='none';this.nativeError='';this.listeners=new Set();this.revision=0;this.routeVersion=0;this.personaVersion=0;this.queryVersion=0;this.pending=null;this.timer=null;this.abort=null;this.closed=false;this.writeTail=Promise.resolve()
  }
  snapshot(){return {config:{...this.config},route:{...this.route},task:{...this.task},stats:this.config.showStats?this.stats:null,usage:this.config.showUsage?this.usage:null,renderer:this.renderer,nativeError:this.nativeError,revision:this.revision}}
  publish(){this.revision++;const state=this.snapshot();for(const fn of this.listeners){try{fn(state)}catch{}}return this.snapshot()}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  async configure(patch){
    const work=this.writeTail.then(async()=>{
      const next=settings({...this.config,...patch});await this.persist(next);const was=this.config.enabled&&this.config.showUsage;this.config=next
      if(!next.enabled||!next.showUsage)this.cancelQuery()
      if(!next.enabled){this.task=emptyTask();this.assistantStream=null;this.streamTurn=null;this.streamStep=null}
      this.updateStats()
      const snapshot=this.publish()
      if(next.enabled&&next.showUsage){if(!was)void this.refresh();else this.schedule()}
      return snapshot
    });this.writeTail=work.catch(()=>{});return work
  }
  cancelQuery(){clearTimeout(this.timer);this.timer=null;this.queryVersion++;this.abort?.abort();this.abort=null;this.pending=null}
  schedule(){clearTimeout(this.timer);this.timer=null;if(!this.closed&&this.config.enabled&&this.config.showUsage&&this.route.model&&this.config.refreshSeconds>0){this.timer=setTimeout(()=>{this.timer=null;void this.refresh()},this.config.refreshSeconds*1000);this.timer.unref?.()}}
  updateStats(session){
    let next=null
    if(this.config.enabled&&this.config.showStats){
      try{next=workStats(this.readStats(this.route.sessionId,session)??{})}catch{}
    }
    const changed=JSON.stringify(next)!==JSON.stringify(this.stats)
    this.stats=next;return changed
  }
  async select(input){
    const provider=typeof input.provider==='string'?input.provider:'';const model=typeof input.model==='string'?input.model:'';const sessionId=typeof input.sessionId==='string'?input.sessionId:''
    if(provider===this.route.provider&&model===this.route.model&&sessionId===this.route.sessionId)return this.updateStats()?this.publish():this.snapshot()
    const sameSession=!!sessionId&&sessionId===this.route.sessionId
    const id=++this.routeVersion
    this.cancelQuery()
    const family=modelFamily({provider,model})
    const art=Object.hasOwn(NAMES,family)?family:'stella'
    this.route={provider,model,sessionId,family,persona:art,art,name:NAMES[art]}
    if(!sameSession){this.task=emptyTask();this.assistantStream=null;this.streamTurn=null;this.streamStep=null}
    this.updateStats();this.usage=unknownUsage(provider==='codex-local'?'codex':family==='deepseek'?'balance':'usage','正在读取当前接入');this.publish()
    await this.refreshPersona()
    if(id!==this.routeVersion||this.closed)return this.snapshot()
    if(this.config.enabled&&this.config.showUsage)void this.refresh()
    return this.snapshot()
  }
  async refreshPersona(){
    const version=++this.personaVersion,routeVersion=this.routeVersion,route={...this.route}
    const persona=await Promise.resolve().then(()=>this.resolvePersona?.(route)).catch(()=>null)
    if(this.closed||version!==this.personaVersion||routeVersion!==this.routeVersion)return this.snapshot()
    const id=persona?.id??(Object.hasOwn(NAMES,route.family)?route.family:'stella')
    const art=Object.hasOwn(NAMES,id)?id:'stella'
    this.route={...route,persona:id,art,
      name:persona?(persona.builtin===false?persona.label:NAMES[id]??persona.label):NAMES[art]}
    return this.publish()
  }
  refresh(){
    if(this.closed||!this.config.enabled||!this.config.showUsage||!this.route.model)return Promise.resolve(this.snapshot())
    if(this.pending)return this.pending
    clearTimeout(this.timer);this.timer=null
    const version=++this.queryVersion,route={...this.route};this.abort=new AbortController()
    const timeout=AbortSignal.timeout(10000),signal=AbortSignal.any([this.abort.signal,timeout])
    const pending=Promise.resolve().then(()=>this.queryUsage(route,signal)).then(usage=>{
      if(version===this.queryVersion&&!this.closed){this.usage={...usage,checkedAt:this.now()};this.publish()}
    }).catch(()=>{
      if(version===this.queryVersion&&!this.closed){this.usage=['ready','stale'].includes(this.usage.status)?{...this.usage,status:'stale',lines:[...this.usage.lines.filter(line=>line!=='上次查询；暂时无法刷新'),'上次查询；暂时无法刷新']}:unknownUsage(route.provider==='codex-local'?'codex':route.family==='deepseek'?'balance':'usage','暂时无法查询，请稍后刷新');this.publish()}
    }).finally(()=>{if(version===this.queryVersion){this.pending=null;this.abort=null;this.schedule()}}).then(()=>this.snapshot())
    this.pending=pending;return pending
  }
  acceptsSession(session){
    const sid=String(session?.header?.id??session?.id??'')
    return !this.closed&&this.config.enabled&&!!sid&&sid===this.route.sessionId&&session?.header?.origin!=='subagent'&&!(Number(session?.header?.delegationDepth??0)>0)
  }
  assistantFrame({agent,frame}={}){
    if(!this.acceptsSession(agent?.session)||!this.task.turnActive||!frame)return
    const revision=frame.revision,attemptId=frame.attemptId
    if(!Number.isFinite(revision)||typeof attemptId!=='string')return
    const previous=this.assistantStream
    if(frame.type==='start'){
      if((this.streamTurn!==null&&frame.turn!==this.streamTurn)||(this.streamStep!==null&&frame.step!==this.streamStep))return
      if(previous?.agent===agent&&revision<=previous.revision)return
      this.assistantStream={agent,attemptId,revision,index:-1}
      return
    }
    if(!previous||previous.agent!==agent||previous.attemptId!==attemptId||revision<=previous.revision||!Number.isFinite(frame.index)||frame.index<=previous.index)return
    if(frame.type!=='chunk'&&frame.type!=='end')return
    this.assistantStream={...previous,revision,index:frame.index,attemptId:frame.type==='end'?null:attemptId}
    // Only discriminants are read. Message text, reasoning, arguments and results stay out of pet state.
    const kind=frame.type==='chunk'?frame.chunk?.type:null
    const block=kind==='block-end'?frame.chunk?.block?.type:null
    const retrying=frame.type==='end'&&(frame.outcome?.kind==='abandoned'||frame.outcome?.eventType==='assistant/attempt')
    const activity=kind==='text-delta'||block==='text'?'responding':kind==='reasoning-delta'||block==='reasoning'||retrying?'thinking':null
    if(!activity)return
    const task=reduceTask(this.task,{type:'assistant/activity',data:{activity}})
    if(task===this.task)return
    this.task=task;this.publish()
  }
  event(session,event){
    if(!this.acceptsSession(session))return
    if(event.type==='turn/start'||event.type==='step/start'||event.type==='turn/end'){
      if(this.assistantStream)this.assistantStream={...this.assistantStream,attemptId:null}
      if(event.type==='turn/start'){this.streamTurn=Number.isFinite(event.data?.turn)?event.data.turn:null;this.streamStep=null}
      if(event.type==='step/start')this.streamStep=Number.isFinite(event.data?.step)?event.data.step:null
    }
    const task=reduceTask(this.task,event)
    const changed=STATS_EVENTS.has(event.type)||event.surfaceOp?this.updateStats(session):false
    if(task===this.task&&!changed)return
    this.task=task;this.publish()
    if(event.type==='turn/end'&&this.config.showUsage&&(!this.usage.checkedAt||this.now()-this.usage.checkedAt>=5000))void this.refresh()
  }
  dispose(){this.closed=true;this.assistantStream=null;this.routeVersion++;this.cancelQuery();this.listeners.clear()}
}
