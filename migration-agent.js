/** Separate one-time native agent; no recurrent migration prompt or model settings. */
import {randomUUID} from 'node:crypto'
import {join} from 'node:path'
import {openMigration,MIGRATION_RULE} from './migration-task.js'
import {readJSON,atomicJSON} from './migration-state.js'
const queues=new Map()
function waitFor(previous,signal){
 signal.throwIfAborted()
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason??new Error('迁移已取消'))}
  signal.addEventListener('abort',abort,{once:true})
  previous.catch(()=>{}).then(()=>{signal.removeEventListener('abort',abort);resolve()})
 })
}
export function applyMigrationAgent(ctx,{home,world,dossier,cleanup,allowWrite,ready=async()=>{}}){
 const own=new WeakSet(),scheduled=new Map(),jobs=new Set(),progress=new Map(),turns=new WeakMap(),lifetime=new AbortController(),dispatch=join(home,'.kujira-migration-dispatch.json');let closed=false
 const tell=(agent,text)=>{try{agent?.inject({id:randomUUID(),role:'user',content:[{type:'text',text}],source:{kind:'kujira-migration-status'}})}catch{} }
 async function run(source,route,entry,force=false,sourceSignal){
  if(closed||!source||own.has(source)||!entry||!route.provider||!route.model)return
  const approvalService=ctx.get('approval')
  let permissionPolicy=approvalService?.overrideOf(source.session)??approvalService?.config?.policy??'ask'
  const priorJob=scheduled.get(entry.id)
  if(priorJob){
   if(!priorJob.signal.aborted){priorJob.acceptSource(source.session,permissionPolicy);return priorJob.promise}
   await waitFor(priorJob.promise,sourceSignal??lifetime.signal)
   return run(source,route,entry,force,sourceSignal)
  }
  if(sourceSignal?.aborted&&sourceSignal.reason?.kind!=='disposed')return{pending:true,status:'cancelled'}
  const control=new AbortController(),signal=control.signal;let handle,approvalEpoch=new AbortController()
  const cancel=reason=>{control.abort(reason);progress.set(entry.id,{status:'cancelled'});handle?.agent.cancel({kind:'user'})}
  const sourceCancelled=()=>{if(sourceSignal.reason?.kind!=='disposed')cancel(sourceSignal.reason)}
  const unloaded=()=>cancel(lifetime.signal.reason)
  sourceSignal?.addEventListener('abort',sourceCancelled,{once:true});lifetime.signal.addEventListener('abort',unloaded,{once:true})
  const restrictPolicy=policy=>{if(policy==='never'&&permissionPolicy!=='never'){permissionPolicy='never';approvalEpoch.abort(new Error('审批策略已收紧'));approvalEpoch=new AbortController();if(handle&&approvalService?.overrideOf(handle.agent.session)!=='never')approvalService?.setPolicy(handle.agent,'never')}}
  // Every admitted Session may tighten this job later; its scope does not own the job.
  const sources=new Set()
  const acceptSource=(session,policy)=>{sources.add(session);restrictPolicy(policy)}
  acceptSource(source.session,permissionPolicy)
  const offPolicy=ctx.on('session/event',(session,event)=>{if(sources.has(session)&&event.type==='approval/policy')restrictPolicy(event.data.policy)},{global:true})
  const update=(status,detail)=>progress.set(entry.id,{status,...detail?{detail}:{},...(handle?{sessionId:handle.agent.id}:{})})
  update('queued')
  const operation=async()=>{
   signal.throwIfAborted();await ready();signal.throwIfAborted()
   const stores={world,persona:dossier(entry)},tasks=Object.fromEntries(Object.entries(stores).map(([k,v])=>[k,openMigration(v)])),pending={world:await tasks.world.discover(),persona:await tasks.persona.discover()},clean=await cleanup.inventory()
   if(!pending.world.length&&!pending.persona.length&&clean.completed){update('completed');return{completed:true}}
   const state=await readJSON(dispatch,{roles:{}}),prior=state.roles[entry.id]
   if(!force&&!allowWrite()&&prior?.status==='write_permission_requested'){update('permission_required');return{pending:true,status:'permission_required'}}
   if(!force&&!pending.world.length&&!pending.persona.length&&clean.paused){update('cleanup_rejected');return{completed:true,cleanupCompleted:false,status:'cleanup_rejected'}}
   let complete=false,cleanupCompleted=false,cleanupAttempted=false,permissionAsked=false
   try{
    const agents=ctx.get('agents');if(!agents)throw Error('宿主 agents 服务不可用，需要官方 agent-loop 工厂；更新保持待处理')
    update('creating');signal.throwIfAborted()
    handle=await agents.create({signal,sessionId:'kujira-migration-'+randomUUID(),agentOptions:{provider:route.provider,model:route.model,...route.reasoningEffort?{reasoningEffort:route.reasoningEffort}:{}},setup(scope,agent){
     own.add(agent)
     acceptSource(agent.session,permissionPolicy)
     agent.session.append('approval/policy',{policy:permissionPolicy,source:'delegation'})
     const turnSignals=new WeakSet()
     scope.on('agent/pre-step',async(payload,next)=>{if(!turnSignals.has(payload.signal)){turnSignals.add(payload.signal);const stopped=()=>{if(!signal.aborted)cancel(payload.signal.reason)};payload.signal.addEventListener('abort',stopped,{once:true});scope.effect(()=>()=>payload.signal.removeEventListener('abort',stopped))}return next()})
     const tools=scope.get('tools');if(!tools)throw Error('宿主 tools 服务不可用')
     const inherited=tools.schemas(agent).map(t=>t.name).filter(n=>n!=='run_code');if(inherited.length)tools.restrict({deny:inherited})
     tools.guard(exec=>exec.name!=='kujira_migrate'?'独立迁移任务只能使用本次迁移工具':undefined)
     scope.on('agent/request',async(_payload,next)=>{const actual=await next();if(actual.provider!==route.provider||actual.model!==route.model)throw Error('迁移模型路由已改变；保留待处理');return actual})
     tools.register({name:'kujira_migrate',description:'执行本次 world 与当前角色迁移。先 list/inspect，必要时 edit，重新 inspect 回读，再 record 决策。所有文件记录后 finish。cleanup_inventory 列出旧备份；cleanup 请求确切范围的一次性删除确认。request_permission 主动说明迁移所需权限；拒绝或不可用时保留待处理。',parameters:{type:'object',properties:{action:{type:'string',enum:['list','inspect','edit','record','finish','rebuild_missing','cleanup_inventory','cleanup','request_permission']},scope:{type:'string',enum:['world','persona']},id:{type:'string'},file:{type:'string'},edit_action:{type:'string',enum:['replace','append','delete','create']},oldText:{type:'string'},newText:{type:'string'},text:{type:'string'},decision:{type:'string',enum:['merged','already_satisfied','preserve_custom_conflict']},reason:{type:'string'},fingerprint:{type:'string'},reviewed:{type:'array',items:{type:'string'},description:'仅当用户需要核验旧来源时，列出 inventory 中 reviewable=true 的确切路径；审批会同时请求确认它们确为插件生成备份。'}},required:['action'],additionalProperties:false},output:{schema:{type:'object'},render(_args,value){return[{type:'text',text:JSON.stringify(value)}]}},async execute(args,exec){
      exec.signal?.throwIfAborted();signal.throwIfAborted();update('working',{action:args.action,scope:args.scope,file:args.file})
      const approve=async reason=>{const approval=scope.get('approval');if(permissionPolicy==='never'&&approval?.overrideOf(agent.session)!=='never')approval?.setPolicy(agent,'never');return approval?approval.request({agent,toolName:'kujira_migrate',callId:exec.callId,signal:AbortSignal.any([exec.signal,approvalEpoch.signal].filter(Boolean)),reason}):'unavailable'}
      if(args.action==='request_permission'){if(permissionAsked)return{pending:true,status:'already_requested'};permissionAsked=true;const reason='需要启用 AI 档案编辑权限，仅用于 world 与 '+entry.id+' 的基础更新逐文件合并、保存回读和更新包收尾；保留现有自定义。';const result=await approve(reason);if(!allowWrite()&&['rejected','allowed-once'].includes(result)){const saved=await readJSON(dispatch,{roles:{}});saved.roles[entry.id]={status:'write_permission_requested',outcome:result};await atomicJSON(dispatch,saved)}tell(source,reason+' 审批结果：'+result+'。当前设置仍关闭时，请启用所需权限；下次请求会重新检查。');return{status:result,pending:true,enabled:allowWrite()}}
      if(args.action==='cleanup_inventory')return cleanup.inventory()
      if(args.action==='cleanup'){if(cleanupAttempted)return{completed:false,status:'already_requested',note:'本次任务已请求过清理确认；受阻时保留待处理'};cleanupAttempted=true;return cleanup.cleanup(args.fingerprint,inventory=>approve('一次性删除以下可核验的插件历史副本。默认版本比较依据已独立保存，正式档案不在范围中。请确认实际删除这些确切文件：\n'+JSON.stringify(inventory.files)+'\n默认基线检查：'+JSON.stringify(inventory.baselines)+(inventory.ownershipConfirmation?.length?'\n另请确认以下来源不确定项确实是鲸鱼自动生成的旧备份，而非正式档案：'+JSON.stringify(inventory.ownershipConfirmation):'')),exec.signal,args.reviewed??[],force)}
      const target=tasks[args.scope];if(!target)throw Error('只能选择 world 或当前 persona')
      if(args.action==='list')return{packages:await target.discover()}
      if(args.action==='inspect')return target.inspect(args.id,args.file)
      if(!allowWrite())throw Error('AI 档案编辑权限关闭；主动调用 request_permission 说明范围与用途，保留 pending')
      if(args.action==='rebuild_missing')return target.rebuild(args.id,exec.signal)
      if(args.action==='edit')return target.edit(args.id,{action:args.edit_action,file:args.file,text:args.text,oldText:args.oldText,newText:args.newText},exec.signal)
      if(args.action==='record')return target.record(args.id,args.file,args.decision,args.reason,exec.signal)
      if(args.action==='finish')return target.finish(args.id,exec.signal)
      throw Error('未知迁移操作')
     }})
    }})
    signal.throwIfAborted();update('running')
    handle.agent.followup({id:randomUUID(),role:'user',source:{kind:'kujira-default-migration'},content:[{type:'text',text:MIGRATION_RULE+'\n这是与日常对话分开的独立一次性迁移任务。只处理共同 world 与当前角色 '+entry.id+'；不得批量改其他角色。读当前原文、可靠旧默认及新版差异，保留用户自定义。旧包完全缺失时可 rebuild_missing 生成当前安装默认的重新核对参照，不得宣称恢复未知旧包；半成包保留待核对。缺失基线时明确记录不确定性；不得假装知道旧默认。已满足或保留自定义冲突可以不写内容，记录具体理由即可。每文件 edit 后必须重新 inspect 回读再 record；完成对应包才 finish。不得用删除通知或包证明完成。\nAI 编辑权限：'+allowWrite()+'。权限不足主动 request_permission；清理备份必须先 cleanup_inventory，再 cleanup 请求确切删除确认，拒绝后不得重试。不要只口头说完成。\n待处理：'+JSON.stringify(pending)+'\n旧备份清理状态：'+JSON.stringify({completed:clean.completed,count:clean.files.length,unresolved:clean.unresolved})}]})
    await handle.agent.whenIdle()
    const remaining={world:await tasks.world.discover(),persona:await tasks.persona.discover()},after=await cleanup.inventory();cleanupCompleted=after.completed;complete=!remaining.world.length&&!remaining.persona.length
    update(complete?'completed':signal.aborted?'cancelled':'pending',{cleanupCompleted:after.completed,cleanupStatus:after.paused?'rejected':after.completed?'completed':'pending'})
    if(!complete&&!signal.aborted)tell(source,'独立迁移仍有待处理项，未作完成标记。下次请求会检查实际状态；需要补充权限或核对来源时请明确说明。')
   }finally{if(handle)await handle.dispose()}
   return{completed:complete,cleanupCompleted}
  }
  // Shared world decisions are serialized within this runtime; ordinary requests never wait here.
  const key=world.config.personaDir,previous=queues.get(key)??Promise.resolve()
  const work=waitFor(previous,signal).then(operation).catch(e=>{
   update(signal.aborted?'cancelled':'error',e.message)
   if(!signal.aborted){tell(source,'独立迁移尚未完成：'+e.message);ctx.logger?.warn?.('Kujira 迁移：'+e.message)}
   return{completed:false,...signal.aborted?{status:'cancelled'}:{error:e.message}}
  }).finally(async()=>{offPolicy();sources.clear();sourceSignal?.removeEventListener('abort',sourceCancelled);lifetime.signal.removeEventListener('abort',unloaded);scheduled.delete(entry.id);jobs.delete(work);if(queues.get(key)===tail)queues.delete(key)})
  const tail=Promise.allSettled([previous,work]);queues.set(key,tail);scheduled.set(entry.id,{promise:work,signal,acceptSource});jobs.add(work)
  return work
 }
 const api={
  isTask:agent=>own.has(agent),
  encounter:(source,route,entry,signal)=>run(source,route,entry,false,signal),
  // Scheduling is synchronous. The owned promise is retained and failures are reported above.
  start(source,route,entry,signal){
   if(!entry||closed||own.has(source)||!signal||signal.aborted)return
   let roles=turns.get(signal);if(!roles){roles=new Set();turns.set(signal,roles)}
   if(roles.has(entry.id))return;roles.add(entry.id)
   return run(source,route,entry,false,signal).catch(error=>{progress.set(entry.id,{status:'error',detail:error.message});ctx.logger?.warn?.('Kujira 迁移：'+error.message);return{completed:false,error:error.message}})
  },
  status:id=>progress.get(id)??{status:'not_started'},
  describe(id){const current=progress.get(id)??{status:'not_started'},labels={not_started:'尚未启动',queued:'等待当前世界观迁移收尾',creating:'正在创建独立迁移会话',running:'迁移任务运行中',working:'正在处理迁移文件',completed:'规则更新已完成',pending:'规则更新仍有待处理项',cancelled:'本次迁移已取消，未完成项保留',error:'迁移遇到错误，未完成项保留',permission_required:'等待档案写入权限',cleanup_rejected:'规则更新已完成；旧备份删除未获允许'};return (labels[current.status]??current.status)+(current.sessionId?'\n独立任务会话：'+current.sessionId:'')+(typeof current.detail==='string'?'\n'+current.detail:current.detail?.file?'\n当前档案：'+current.detail.scope+'/'+current.detail.file:'')+(current.detail?.cleanupCompleted===false?'\n旧备份清理仍待处理，不影响已完成的规则更新。':'')},
  resume:(agent,route,entry)=>run(agent,route,entry,true),
  async dispose(){closed=true;lifetime.abort(new Error('迁移插件已卸载'));await Promise.allSettled([...jobs])}
 }
 ctx.effect(()=>()=>api.dispose());return api
}
