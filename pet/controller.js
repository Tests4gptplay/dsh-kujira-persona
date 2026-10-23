import { NAMES,settings,emptyTask,reduceTask,unknownUsage } from './model.js'
import { modelFamily } from '../catalog.js'

/** One presentation state, shared by the settings page and the one pet renderer. */
export class PetController {
  constructor({config={},resolvePersona,queryUsage,persist=async()=>{},now=Date.now}){
    this.config=settings(config);this.resolvePersona=resolvePersona;this.queryUsage=queryUsage;this.persist=persist;this.now=now
    this.route={provider:'',model:'',family:'none',persona:'none',name:'Kujira',art:'unknown',sessionId:''}
    this.task=emptyTask();this.usage=unknownUsage('usage','选择模型后显示对应的用量')
    this.renderer='none';this.nativeError='';this.listeners=new Set();this.revision=0;this.routeVersion=0;this.queryVersion=0;this.pending=null;this.timer=null;this.abort=null;this.closed=false;this.writeTail=Promise.resolve()
  }
  snapshot(){return {config:{...this.config},route:{...this.route},task:{...this.task},usage:this.config.showUsage?this.usage:null,renderer:this.renderer,nativeError:this.nativeError,revision:this.revision}}
  publish(){this.revision++;const state=this.snapshot();for(const fn of this.listeners){try{fn(state)}catch{}}return this.snapshot()}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  async configure(patch){
    const work=this.writeTail.then(async()=>{
      const next=settings({...this.config,...patch});await this.persist(next);const was=this.config.enabled&&this.config.showUsage;this.config=next
      if(!next.enabled||!next.showUsage)this.cancelQuery()
      const snapshot=this.publish()
      if(next.enabled&&next.showUsage){if(!was)void this.refresh();else this.schedule()}
      return snapshot
    });this.writeTail=work.catch(()=>{});return work
  }
  cancelQuery(){clearTimeout(this.timer);this.timer=null;this.queryVersion++;this.abort?.abort();this.abort=null;this.pending=null}
  schedule(){clearTimeout(this.timer);this.timer=null;if(!this.closed&&this.config.enabled&&this.config.showUsage&&this.route.model){this.timer=setTimeout(()=>{this.timer=null;void this.refresh()},this.config.refreshSeconds*1000);this.timer.unref?.()}}
  async select(input){
    const provider=typeof input.provider==='string'?input.provider:'';const model=typeof input.model==='string'?input.model:'';const sessionId=typeof input.sessionId==='string'?input.sessionId:''
    if(provider===this.route.provider&&model===this.route.model&&sessionId===this.route.sessionId)return this.snapshot()
    const id=++this.routeVersion
    this.cancelQuery()
    const family=modelFamily({provider,model})
    this.route={provider,model,sessionId,family,persona:family,art:NAMES[family]?family:'unknown',name:NAMES[family]??model??'Kujira'}
    this.task=emptyTask();this.usage=unknownUsage(provider==='codex-local'?'codex':family==='deepseek'?'balance':'usage','正在读取当前接入');this.publish()
    const persona=await Promise.resolve().then(()=>this.resolvePersona?.({provider,model})).catch(()=>null)
    if(id!==this.routeVersion||this.closed)return this.snapshot()
    if(persona){this.route.persona=persona.id;this.route.art=NAMES[persona.id]?persona.id:'unknown';this.route.name=NAMES[persona.id]??persona.label}
    this.publish();if(this.config.enabled&&this.config.showUsage)void this.refresh()
    return this.snapshot()
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
      if(version===this.queryVersion&&!this.closed){this.usage=this.usage.status==='ready'?{...this.usage,status:'stale',lines:[...this.usage.lines,'上次查询；暂时无法刷新']}:unknownUsage(route.provider==='codex-local'?'codex':route.family==='deepseek'?'balance':'usage','暂时无法查询，请稍后刷新');this.publish()}
    }).finally(()=>{if(version===this.queryVersion){this.pending=null;this.abort=null;this.schedule()}}).then(()=>this.snapshot())
    this.pending=pending;return pending
  }
  event(session,event){
    if(!this.config.enabled)return
    const sid=String(session?.header?.id??session?.id??'')
    if(sid!==this.route.sessionId||session?.header?.origin==='subagent'||Number(session?.header?.delegationDepth??0)>0)return
    const task=reduceTask(this.task,event);if(task===this.task)return
    this.task=task;this.publish()
    if(event.type==='turn/end'&&this.config.showUsage&&(!this.usage.checkedAt||this.now()-this.usage.checkedAt>=5000))void this.refresh()
  }
  dispose(){this.closed=true;this.routeVersion++;this.cancelQuery();this.listeners.clear()}
}
