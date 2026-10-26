import { NAMES,settings,emptyTask,reduceTask,unknownUsage } from './model.js'
import { workStats,STATS_EVENTS } from './stats.js'
import { modelFamily } from '../catalog.js'
import { toolCallIdOf } from './activity.js'

const sessionIdOf=session=>String(session?.header?.id??session?.id??'')
const presentation=()=>({task:emptyTask(),assistantStream:null,streamTurn:null,streamStep:null,cursor:-1,hydration:null,hydrated:false,stats:null,joinStream:false})
// Retain only presentation discriminants while a selected-session read is pending.
function taskEvent(event){
  const d=event.data??{},data={}
  for(const key of ['turn','step','name','id'])if(d[key]!==undefined)data[key]=d[key]
  if(d.reason)data.reason={kind:d.reason.kind}
  if(d.usage)data.usage={inputTokens:d.usage.inputTokens,outputTokens:d.usage.outputTokens}
  if(event.type==='tool/call'||event.type==='tool/result'){
    data.name=d.name??d.message?.name;data.callId=toolCallIdOf(event);data.error=!!(d.error||d.message?.isError)
  }
  if(event.type==='user/message')data.source={kind:d.source?.kind??d.message?.source?.kind}
  if(Array.isArray(d.todos))data.todos=d.todos.map(todo=>({status:todo.status}))
  return {type:event.type,seq:event.seq,data}
}
function applyEvent(state,event){
  if(Number.isFinite(event.seq)&&event.seq<=state.cursor)return
  if(event.type==='turn/start'){state.streamTurn=event.data?.turn??null;state.streamStep=null}
  if(event.type==='step/start')state.streamStep=event.data?.step??null
  state.task=reduceTask(state.task,event)
  if(Number.isFinite(event.seq))state.cursor=event.seq
}

/** One presentation state, shared by the settings page and the one pet renderer. */
export class PetController {
  constructor({config={},resolvePersona,queryUsage,readStats=()=>undefined,readSession,persist=async()=>{},now=Date.now}){
    this.config=settings(config);this.resolvePersona=resolvePersona;this.queryUsage=queryUsage;this.persist=persist;this.now=now;this.readStats=readStats;this.readSession=readSession;this.stats=null
    this.route={provider:'',model:'',family:'none',persona:'stella',name:NAMES.stella,art:'stella',sessionId:''}
    this.sessionStates=new Map();this.presentation=presentation()
    this.usage=unknownUsage('usage','选择模型后显示对应的用量')
    this.renderer='none';this.nativeError='';this.listeners=new Set();this.revision=0;this.routeVersion=0;this.personaVersion=0;this.queryVersion=0;this.pending=null;this.timer=null;this.abort=null;this.closed=false;this.writeTail=Promise.resolve()
  }
  get task(){return this.presentation.task}
  get assistantStream(){return this.presentation.assistantStream}
  snapshot(){return {config:{...this.config},route:{...this.route},task:{...this.task},stats:this.config.showStats?this.stats:null,usage:this.config.showUsage?this.usage:null,renderer:this.renderer,nativeError:this.nativeError,revision:this.revision}}
  publish(){this.revision++;const state=this.snapshot();for(const fn of this.listeners){try{fn(state)}catch{}}return this.snapshot()}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  async configure(patch){
    const work=this.writeTail.then(async()=>{
      const next=settings({...this.config,...patch});
      try{await this.persist(next)}catch(error){
        const reason=typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:''
        const message=['EACCES','EPERM','EROFS'].includes(reason)?'设置文件无法保存：请检查 DSH 配置目录的写入权限。':reason==='ENOSPC'?'设置文件无法保存：磁盘空间不足，请释放空间。':reason==='EBUSY'?'设置文件正在被占用，请关闭占用它的程序后再操作。':'设置文件无法保存'+(reason?'（'+reason+'）':'')+'，请检查配置目录与磁盘状态。'
        const failure=new Error(message);failure.code='kujira-config-save';throw failure
      }
      const wasEnabled=this.config.enabled;const was=this.config.enabled&&this.config.showUsage;this.config=next
      if(!next.enabled||!next.showUsage)this.cancelQuery()
      if(!next.enabled){this.sessionStates.clear();this.presentation=presentation()}
      if(next.enabled&&!wasEnabled&&this.route.sessionId){this.sessionStates.set(this.route.sessionId,this.presentation);void this.hydrate(this.route.sessionId)}
      this.updateStats()
      const snapshot=this.publish()
      if(next.enabled&&next.showUsage){if(!was)void this.refresh();else this.schedule()}
      return snapshot
    });this.writeTail=work.catch(()=>{});return work
  }
  cancelQuery(){clearTimeout(this.timer);this.timer=null;this.queryVersion++;this.abort?.abort();this.abort=null;this.pending=null}
  schedule(){
    clearTimeout(this.timer);this.timer=null
    if(this.closed||!this.config.enabled||!this.config.showUsage||!this.route.model||this.config.refreshSeconds<=0)return
    const started=this.now(),seconds=this.config.refreshSeconds
    const wait=()=>{
      const remaining=seconds-Math.max(0,this.now()-started)/1000
      if(remaining<=0){void this.refresh();return}
      // Node timers use a signed 32-bit millisecond delay. Split longer waits;
      // never shorten the user's interval or dispatch a query for an intermediate chunk.
      const timer=setTimeout(()=>{if(this.timer!==timer)return;this.timer=null;if(!this.closed&&this.config.enabled&&this.config.showUsage&&this.route.model)wait()},Math.min(remaining*1000,2**31-1))
      this.timer=timer;timer.unref?.()
    }
    wait()
  }
  updateStats(session){
    let next=null
    if(this.config.enabled&&this.config.showStats){
      try{const views=this.readStats(this.route.sessionId,session);next=views===undefined?this.presentation.stats:workStats(views);this.presentation.stats=next}catch{}
    }
    const changed=JSON.stringify(next)!==JSON.stringify(this.stats)
    this.stats=next;return changed
  }
  async select(input){
    const provider=typeof input.provider==='string'?input.provider:'';const model=typeof input.model==='string'?input.model:'';const sessionId=typeof input.sessionId==='string'?input.sessionId:''
    if(provider===this.route.provider&&model===this.route.model&&sessionId===this.route.sessionId){await this.hydrate(sessionId);return this.updateStats()?this.publish():this.snapshot()}
    const sameSession=!!sessionId&&sessionId===this.route.sessionId
    const id=++this.routeVersion
    this.cancelQuery()
    const family=modelFamily({provider,model})
    const art=Object.hasOwn(NAMES,family)?family:'stella'
    this.route={provider,model,sessionId,family,persona:art,art,name:NAMES[art]}
    if(!sameSession){this.presentation=this.sessionStates.get(sessionId)??presentation();if(sessionId)this.sessionStates.set(sessionId,this.presentation)}
    this.updateStats();this.usage=unknownUsage(provider==='codex-local'?'codex':family==='deepseek'?'balance':'usage','正在读取当前接入');this.publish()
    await Promise.all([this.refreshPersona(),this.hydrate(sessionId)])
    if(id!==this.routeVersion||this.closed)return this.snapshot()
    if(this.config.enabled&&this.config.showUsage)void this.refresh()
    return this.snapshot()
  }
  hydrate(sessionId){
    const state=this.sessionStates.get(sessionId)
    if(!state||!this.readSession||!this.config.enabled||this.closed)return Promise.resolve()
    if(state.hydration)return state.hydration.pending
    const base=state.hydrated?{...state}:presentation()
    const request={events:[],base,pending:null};state.hydration=request
    request.pending=Promise.resolve().then(()=>this.readSession(sessionId,state.hydrated?base.cursor:undefined)).then(observed=>{
      if(!observed||this.closed||!this.config.enabled||this.sessionStates.get(sessionId)!==state||state.hydration!==request)return
      const next=observed.cursor>=base.cursor?{...base}:presentation()
      for(const event of observed.events??[])if(event.seq>=(observed.inheritedEventCount??0))applyEvent(next,event)
      next.cursor=observed.cursor??next.cursor
      const newer=request.events.filter(event=>!Number.isFinite(event.seq)||event.seq>next.cursor)
      for(const event of newer)applyEvent(next,event)
      // Stored open boundaries are not proof of a live driver after restart.
      const running=request.running??observed.running
      if(running===true&&next.task.phase==='idle'&&next.streamTurn===null)next.task=reduceTask(next.task,{type:'turn/start',data:{}})
      if(running===false&&next.task.turnActive)next.task=reduceTask(next.task,{type:'turn/end',data:{reason:{kind:'aborted'}}})
      // Buffered live events have already published their animation/pulse identity.
      if(state.cursor===next.cursor&&request.events.length)next.task={...next.task,signal:state.task.signal,pulse:state.task.pulse}
      const sameBoundary=state.streamTurn===next.streamTurn&&state.streamStep===next.streamStep
      if(sameBoundary&&state.cursor===next.cursor&&state.task.turnActive===next.task.turnActive&&state.assistantStream)next.task=state.task
      state.hydrated=true;state.task=next.task;state.cursor=next.cursor;state.streamTurn=next.streamTurn;state.streamStep=next.streamStep
      if(!sameBoundary||!state.task.turnActive)state.assistantStream=null
      state.joinStream=state.task.turnActive&&!state.assistantStream&&running===true
      state.stats=workStats(observed.projections?.values??{})
      if(state===this.presentation){this.updateStats();this.publish()}
    }).catch(()=>{}).finally(()=>{if(state.hydration===request)state.hydration=null})
    return request.pending
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
    // Cancelling optional usage must release UI callers even if a provider ignores its signal.
    let onAbort
    const aborted=new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);if(signal.aborted)onAbort();else signal.addEventListener('abort',onAbort,{once:true})})
    const query=Promise.resolve().then(()=>{signal.throwIfAborted();return this.queryUsage(route,signal)})
    const pending=Promise.race([query,aborted]).then(usage=>{
      if(version===this.queryVersion&&!this.closed){this.usage={...usage,checkedAt:this.now()};this.publish()}
    }).catch(()=>{
      if(version===this.queryVersion&&!this.closed){this.usage=['ready','stale'].includes(this.usage.status)?{...this.usage,status:'stale',lines:[...this.usage.lines.filter(line=>line!=='上次查询；暂时无法刷新'),'上次查询；暂时无法刷新']}:unknownUsage(route.provider==='codex-local'?'codex':route.family==='deepseek'?'balance':'usage','暂时无法查询，请稍后刷新');this.publish()}
    }).finally(()=>{signal.removeEventListener('abort',onAbort);if(version===this.queryVersion){this.pending=null;this.abort=null;this.schedule()}}).then(()=>this.snapshot())
    this.pending=pending;return pending
  }
  acceptsSession(session){
    const sid=sessionIdOf(session)
    return !this.closed&&this.config.enabled&&!!sid&&(sid===this.route.sessionId||this.sessionStates.has(sid)||(session?.header?.origin!=='subagent'&&!(Number(session?.header?.delegationDepth??0)>0)))
  }
  stateFor(session){
    if(!this.acceptsSession(session))return null
    const id=sessionIdOf(session)
    if(!this.sessionStates.has(id))this.sessionStates.set(id,id===this.route.sessionId?this.presentation:presentation())
    return this.sessionStates.get(id)
  }
  status({agent,status}={}){
    const state=this.stateFor(agent?.session)
    if(!state)return
    if(state.hydration)state.hydration.running=status==='running'
    if(status==='idle'&&state.task.turnActive){state.task=reduceTask(state.task,{type:'turn/end',data:{reason:{kind:'aborted'}}});state.assistantStream=null;state.joinStream=false;if(state===this.presentation)this.publish()}
    if(state===this.presentation)void this.hydrate(this.route.sessionId)
  }
  forgetSession(session){
    const id=sessionIdOf(session)
    this.sessionStates.delete(id)
    if(id===this.route.sessionId){this.presentation=presentation();this.publish()}
  }
  assistantFrame({agent,frame}={}){
    const state=this.stateFor(agent?.session)
    if(!state?.task.turnActive||!frame)return
    const revision=frame.revision,attemptId=frame.attemptId
    if(!Number.isFinite(revision)||typeof attemptId!=='string')return
    let previous=state.assistantStream
    if(frame.type==='start'){
      if((state.streamTurn!==null&&frame.turn!==state.streamTurn)||(state.streamStep!==null&&frame.step!==state.streamStep))return
      if(previous?.agent===agent&&revision<=previous.revision)return
      state.joinStream=false;state.assistantStream={agent,attemptId,revision,index:-1}
      return
    }
    if(!previous&&state.joinStream&&frame.type==='chunk'&&Number.isFinite(frame.index)){previous={agent,attemptId,revision:revision-1,index:frame.index-1};state.joinStream=false}
    if(!previous||previous.agent!==agent||previous.attemptId!==attemptId||revision<=previous.revision||!Number.isFinite(frame.index)||frame.index<=previous.index)return
    if(frame.type!=='chunk'&&frame.type!=='end')return
    state.assistantStream={...previous,revision,index:frame.index,attemptId:frame.type==='end'?null:attemptId}
    // Only discriminants are read. Message text, reasoning, arguments and results stay out of pet state.
    const kind=frame.type==='chunk'?frame.chunk?.type:null
    const block=kind==='block-end'?frame.chunk?.block?.type:null
    const retrying=frame.type==='end'&&(frame.outcome?.kind==='abandoned'||frame.outcome?.eventType==='assistant/attempt')
    const activity=kind==='text-delta'||block==='text'?'responding':kind==='reasoning-delta'||block==='reasoning'||retrying?'thinking':null
    if(!activity)return
    const task=reduceTask(state.task,{type:'assistant/activity',data:{activity}})
    if(task===state.task)return
    state.task=task;if(state===this.presentation)this.publish()
  }
  event(session,event){
    const state=this.stateFor(session)
    if(!state)return
    if(Number.isFinite(event.seq)&&event.seq<=state.cursor)return
    if(state.hydration){state.hydration.events.push(taskEvent(event));if(event.type==='turn/start'||event.type==='turn/end')state.hydration.running=event.type==='turn/start'}
    if(Number.isFinite(event.seq))state.cursor=event.seq
    if(event.type==='turn/start'||event.type==='step/start'||event.type==='turn/end'){
      state.joinStream=false
      if(state.assistantStream)state.assistantStream={...state.assistantStream,attemptId:null}
      if(event.type==='turn/start'){state.streamTurn=Number.isFinite(event.data?.turn)?event.data.turn:null;state.streamStep=null}
      if(event.type==='step/start')state.streamStep=Number.isFinite(event.data?.step)?event.data.step:null
    }
    const task=reduceTask(state.task,event)
    const selected=state===this.presentation
    const changed=selected&&(STATS_EVENTS.has(event.type)||event.surfaceOp)?this.updateStats(session):false
    if(task===state.task&&!changed)return
    state.task=task;if(state===this.presentation)this.publish()
    if(selected&&event.type==='turn/end'&&this.config.showUsage&&(!this.usage.checkedAt||this.now()-this.usage.checkedAt>=5000))void this.refresh()
  }
  dispose(){this.closed=true;this.sessionStates.clear();this.presentation.assistantStream=null;this.routeVersion++;this.cancelQuery();this.listeners.clear()}
}
