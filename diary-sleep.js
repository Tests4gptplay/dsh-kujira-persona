/** One event-driven, cancellable auxiliary call at a time. Never creates a conversation agent. */
import {randomUUID} from 'node:crypto'
const key=r=>JSON.stringify([r?.sessionId,r?.provider,r?.model,r?.reasoningEffort])
export async function collectResponse(stream,signal){
 const parts=new Map();let finish,replayState
 for await(const chunk of stream){signal.throwIfAborted();const index=chunk.index??0
  if(chunk.type==='finish'){finish=chunk.reason;replayState=chunk.replayState;continue}
  if(chunk.type==='usage')continue
  let item=parts.get(index);if(!item){item={type:chunk.blockType??(chunk.type==='tool-call-delta'?'tool-call':chunk.type==='reasoning-delta'?'reasoning':'text'),text:'',arguments:''};parts.set(index,item)}
  if(item.complete)continue
  if(chunk.type==='block-end'){parts.set(index,{...chunk.block,complete:true});continue}
  if(chunk.type==='text-delta'||chunk.type==='reasoning-delta')item.text+=chunk.text
  if(chunk.type==='tool-call-delta'){item.type='tool-call';item.id=chunk.id;if(chunk.name)item.name=chunk.name;item.arguments+=chunk.argumentsDelta}
 }
 return{finish,replayState,blocks:[...parts.values()].map(({complete,...b})=>b.type==='tool-call'?{type:b.type,id:b.id,name:b.name,arguments:b.arguments}:{type:b.type,text:b.text})}
}
export function applyDiarySleep(ctx,{diary,catalog,personaContext=async()=>'',defer=queueMicrotask}){
 let closed=false,selected=null,epoch=0,active=null,evaluating=false,queued=false,rerun=false,externalCalls=0,timer=null
 let state={phase:'off',message:''},services=null,roleWatch=null,watchedRole=null
 const offs=[],listeners=new Set(),workflows=new Set()
 const setState=(phase,message='')=>{state={phase,message};for(const fn of listeners)try{fn({...state})}catch{}}
 const snapshot=()=>({...state})
 const abort=reason=>{epoch++;active?.abort.abort(new Error(reason))}
 function wake(){if(closed)return;if(evaluating){rerun=true;return}if(queued)return;queued=true;defer(()=>{queued=false;void evaluate()})}
 function change(reason){abort(reason);wake()}
 function scheduleDay(){clearTimeout(timer);timer=null;if(closed||!diary.settings().sleepEnabled||!selected)return
  const start=Date.now(),current=diary.today(),zone=diary.timeZone(),fmt=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'})
  const day=ms=>{const p=fmt.formatToParts(new Date(ms));return['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-')}
  let lo=start,hi=start+27*3600000;while(hi-lo>1000){const mid=Math.floor((lo+hi)/2);if(day(mid)===current)lo=mid;else hi=mid}
  timer=setTimeout(()=>{timer=null;wake();scheduleDay()},Math.max(1000,hi-start+200));timer.unref?.()
 }
 const busy=()=>!services||externalCalls>0||workflows.size>0||services.agents.list().some(a=>a.status==='running'||a.inbox?.hasPending)
 function jobsBusy(){const jobs=ctx.get('jobs');if(!jobs)return false;const ids=new Set([undefined,...(ctx.get('sessions')?.list()??[]).map(s=>s.id),...services.agents.list().map(a=>a.id)]);for(const id of ids)if(jobs.list(id).some(j=>j.status==='running'||j.status==='stopping'))return true;return false}
 async function barrier(mark){if(busy()||jobsBusy())return false;const all=services.agents.list();if(all.some(a=>typeof a.whenIdle!=='function'))throw Error('宿主当前无法确认所有对话任务已结束，后台整理暂不启动');await Promise.all(all.map(a=>a.whenIdle()));return !closed&&epoch===mark&&!busy()&&!jobsBusy()}
 async function evaluate(){
  if(evaluating||closed)return;evaluating=true;rerun=false
  let continueWork=false
  setState('checking')
  try{
   await diary.ready
   if(!diary.settings().sleepEnabled){setState('off');return}
   if(!selected){setState('waiting','尚未取得前台当前模型；不会自动选择其它模型。');return}
   if(!services){setState('waiting','宿主模型或全局任务状态暂不可用。');return}
   if(busy()||jobsBusy()){setState('waiting','等待所有对话任务空闲。');return}
   const mark=epoch,route={...selected};if(!await barrier(mark))return
   const entry=await catalog.resolve(route);if(!entry){setState('waiting','当前模型没有绑定角色，后台整理暂不启动。');return}
   const watchKey=diary.settings().directory+'|'+entry.id
   if(watchedRole!==watchKey&&diary.watchOwn){roleWatch?.();roleWatch=null;watchedRole=null;const stop=await diary.watchOwn(entry,reason=>{if(reason==='watch-error'){if(watchedRole===watchKey){roleWatch=null;watchedRole=null}return}change('日记源文件已改变')});if(closed||mark!==epoch){stop?.();return}roleWatch=stop;watchedRole=roleWatch?watchKey:null}
   // Check local files BEFORE preparing or dispatching any model request.
   const pending=await diary.pendingSleep(entry);if(mark!==epoch||!diary.settings().sleepEnabled)return
   if(!pending.length){setState('idle');return}
   const batch=pending
   const control=new AbortController(),job={abort:control,route,entry};active=job
   const savedPersona=await diary.sleepContext(entry),persona=await personaContext(entry)
   if(!await barrier(mark)||control.signal.aborted)return
   const config={provider:route.provider,model:route.model,...route.reasoningEffort?{reasoningEffort:route.reasoningEffort}:{}}
   const call=await services.llm.prepareCall(config,control.signal)
   if(call.config.provider!==route.provider||call.config.model!==route.model||(route.reasoningEffort&&call.config.reasoningEffort!==route.reasoningEffort))throw Error('宿主未保持前台所选模型，已停止后台整理')
   if(!await barrier(mark)||control.signal.aborted)return
   const system=[persona,savedPersona].filter(Boolean).join('\n\n')
   const list=batch.map(({text,...source})=>({...source,characters:[...text].length}))
   const messages=[{id:randomUUID(),role:'user',source:{kind:'kujira-diary-sleep'},content:[{type:'text',text:'需要整理你自己的旧日记，对长期记忆作压缩与取舍，便于后续回忆。\n未整理日记清单：\n'+JSON.stringify(list)}]}]
   const tools=[
    {name:'sleep_read',description:'读取清单中某段原文。',parameters:{type:'object',properties:{id:{type:'string'},start_character:{type:'integer'},max_chars:{type:'integer'}},required:['id'],additionalProperties:false}},
    {name:'sleep_write',description:'保存自己的整理结果，并记录对应清单段落已处理。空正文可表示不保留该段摘要。',parameters:{type:'object',properties:{id:{type:'string'},text:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['id','text'],additionalProperties:false}}
   ]
   setState('running')
   let prepared=call,written=0
   for(;;){
    control.signal.throwIfAborted();if(!await barrier(mark))return
    const options={...prepared.config,system,messages,tools,purpose:'kujira-diary-sleep',signal:control.signal,...route.sessionId?{sessionId:route.sessionId}:{}}
    const response=await collectResponse(prepared.stream(options),control.signal)
    if(response.finish?.kind!=='stop'&&response.finish?.kind!=='tool-calls')throw Error(response.finish?.failure?.message??'后台整理未完整完成，原文与已有进度保留')
    const calls=response.blocks.filter(b=>b.type==='tool-call')
    if(!calls.length){setState('idle');continueWork=written>0;break}
    messages.push({id:randomUUID(),role:'assistant',source:{kind:'model',provider:route.provider,model:route.model,...response.replayState===undefined?{}:{replayState:response.replayState}},content:response.blocks})
    for(const tool of calls){
     control.signal.throwIfAborted();let value,isError=false
     try{
      const args=typeof tool.arguments==='string'?JSON.parse(tool.arguments):tool.arguments,source=batch.find(b=>b.id===args?.id)
      if(!source)throw Error('只能使用本次清单中的 id')
      if(tool.name==='sleep_read'){
       const start=args.start_character??1,limit=args.max_chars??4000;if(!Number.isSafeInteger(start)||start<1||!Number.isSafeInteger(limit)||limit<1)throw Error('读取范围无效')
       const chars=[...source.text],end=Math.min(chars.length,start-1+limit)
       value={id:source.id,source_file:source.source_file,date:source.date,start_character:source.start_character+start-1,text:chars.slice(start-1,end).join(''),next_start_character:end<chars.length?end+1:null}
      }else if(tool.name==='sleep_write'){
       if(typeof args.text!=='string')throw Error('保存参数无效')
       value=await diary.saveSleep(entry,[{source,text:args.text,tags:Array.isArray(args.tags)?args.tags.filter(t=>typeof t==='string'):[]}],{signal:control.signal});written+=value.saved
      }else throw Error('没有此整理工具')
     }catch(e){control.signal.throwIfAborted();isError=true;value={error:e.message}}
     messages.push({id:randomUUID(),role:'tool',source:{kind:'tool',callId:tool.id},toolCallId:tool.id,content:[{type:'text',text:JSON.stringify(value)}],isError})
    }
    prepared=await services.llm.prepareCall(config,control.signal)
   }

  }catch(error){if(active?.abort.signal.aborted){setState(diary.settings().sleepEnabled?'waiting':'off')}else{setState('error',error?.message??String(error));try{ctx.logger?.warn?.('Kujira 睡眠整理：'+(error?.message??String(error)))}catch{}}}
  finally{active=null;evaluating=false;if(continueWork||rerun)wake()}
 }
 offs.push(diary.subscribe(()=>{roleWatch?.();roleWatch=null;watchedRole=null;change('日记设置已改变');scheduleDay()}),diary.subscribeWrites(()=>wake()),catalog.subscribe(()=>{change('角色绑定已改变')}))
 for(const name of ['agent/created','agent/inbox/inserted'])offs.push(ctx.on(name,()=>change('前台新任务优先'),{global:true}))
 offs.push(ctx.on('agent/status',({status})=>{if(status==='running')change('前台新任务优先');else wake()},{global:true}))
 offs.push(ctx.on('agent/disposed',()=>change('对话任务状态已改变'),{global:true}))
 offs.push(ctx.on('session/event',(session,event)=>{
  if(event.type==='model/selection'&&session.id===selected?.sessionId){selected=null;change('前台模型选择已改变');return}
  if(['turn/start','job/registered'].includes(event.type))change('前台新任务优先')
  else if(['turn/end','job/settled'].includes(event.type))wake()
 },{global:true}))
 offs.push(ctx.on('workflow/start',info=>{workflows.add(info.id);change('前台工作流优先')},{global:true}),ctx.on('workflow/end',info=>{workflows.delete(info.id);wake()},{global:true}))
 // Auxiliary requests do not become agents; the exact own signal excludes only this worker.
 offs.push(ctx.on('llm/stream',(options,next)=>{
  if(active&&options.signal===active.abort.signal&&options.purpose==='kujira-diary-sleep')return next()
  const stream=next()
  return(async function*(){externalCalls++;change('其它模型请求优先');try{yield* stream}finally{externalCalls--;wake()}})()
 },{global:true}))
 ctx.inject(['agents','llm','sessions'],scope=>{services={agents:scope.agents,llm:scope.llm};wake();scope.effect(()=>()=>{services=null;change('宿主服务已停止')})})
 ctx.inject(['jobs'],scope=>{const off=scope.jobs.events.subscribe({owners:'all'},()=>change('后台任务状态已改变'));scope.effect(()=>off)})
 const api={snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
  async select(input={}){
   const next=typeof input.provider==='string'&&input.provider&&typeof input.model==='string'&&input.model&&typeof input.sessionId==='string'&&input.sessionId&&input.ready!==false?{provider:input.provider,model:input.model,sessionId:input.sessionId,...typeof input.reasoningEffort==='string'&&input.reasoningEffort?{reasoningEffort:input.reasoningEffort}:{}}:null
   const changed=key(next)!==key(selected);if(changed){selected=next;abort('前台模型选择已改变')}
   if(next&&input.timeZone&&input.timeZone!==diary.timeZone())await diary.configure({timeZone:input.timeZone})
   scheduleDay();wake();return snapshot()
  },
  dispose(){if(closed)return;closed=true;abort('插件已关闭');clearTimeout(timer);roleWatch?.();for(const off of offs)off?.();listeners.clear()},
 }
 ctx.effect(()=>()=>api.dispose());return api
}
