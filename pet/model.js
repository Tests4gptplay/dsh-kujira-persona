/** Presentation data only. No model calls, file scans, or work execution. */
export const NAMES = Object.freeze({ deepseek:'DeepSeek',gpt:'GPT',gemini:'Gemini',claude:'Claude',grok:'Grok',glm:'GLM',kimi:'Kimi',qwen:'Qwen',minimax:'MiniMax',llama:'Llama',doubao:'豆包',mistral:'Mistral',hunyuan:'混元',mimo:'MiMo' })
export const DEFAULTS = Object.freeze({ enabled:false, display:'auto', scale:1, bubbleScale:1, activity:'normal', reducedMotion:false, sound:false, bubble:'always', showUsage:true, refreshSeconds:60, x:null, y:null })
export function settings(input={}) {
  const value={...DEFAULTS}
  for(const key of ['enabled','reducedMotion','sound','showUsage']) if(typeof input[key]==='boolean') value[key]=input[key]
  for(const [key,options] of Object.entries({display:['auto','desktop','page'],activity:['quiet','normal','lively'],bubble:['always','tasks','hidden']})) if(options.includes(input[key])) value[key]=input[key]
  for(const [key,lo,hi] of [['scale',0.55,1.6],['bubbleScale',0.8,1.4],['refreshSeconds',30,600]]) if(Number.isFinite(input[key])) value[key]=Math.min(hi,Math.max(lo,input[key]))
  for(const key of ['x','y']) if(Number.isFinite(input[key])) value[key]=input[key]
  return value
}
export const emptyTask=()=>({phase:'idle',text:'等你开始',tool:'',progress:null,inputTokens:0,outputTokens:0})
export function reduceTask(previous,event) {
  const task={...previous},data=event?.data??{}
  switch(event?.type){
    case 'turn/start': return {...emptyTask(),phase:'thinking',text:'正在思考'}
    case 'step/start': task.phase='thinking';task.text='正在思考';break
    case 'tool/call':
      task.tool=String(data.name??'工具');
      task.phase=['ask_user_question','exit_plan_mode'].includes(task.tool)?'waiting':'working';
      task.text=task.phase==='waiting'?'等你确认':`正在使用 ${task.tool}`;break
    case 'approval/asked': task.phase='waiting';task.text='等你确认';break
    case 'approval/decided': task.phase='working';task.text='继续处理';break
    case 'tool/result': task.phase=data.error?'error':'thinking';task.text=data.error?'这一步遇到了问题':'正在整理结果';break
    case 'assistant/message':
      if(data.usage){task.inputTokens+=Number(data.usage.inputTokens)||0;task.outputTokens+=Number(data.usage.outputTokens)||0}
      break
    case 'todo/write':{
      const todos=Array.isArray(data.todos)?data.todos:[];
      task.progress=todos.length?{done:todos.filter(t=>['completed','done'].includes(t.status)).length,total:todos.length}:null;break
    }
    case 'turn/end':{
      const reason=data.reason?.kind??'completed';
      task.phase=reason==='completed'?'completed':reason==='aborted'?'idle':reason==='blocked'?'waiting':'error';
      task.text={completed:'做完啦',idle:'已停止',waiting:'等你确认',error:'这次遇到了问题'}[task.phase];task.tool='';break
    }
    default:return previous
  }
  return task
}
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null
export function codexQuota(body) {
  const raw=body?.rateLimits??body
  if(!raw||typeof raw!=='object')return {kind:'codex',status:'unavailable',title:'Codex 套餐',lines:['暂未取得套餐余量'],windows:[]}
  const windows=[]
  for(const [key,label] of [['primary','当前窗口'],['secondary','另一窗口']]){
    const w=raw[key],used=numeric(w?.usedPercent);if(!w||used===null)continue
    const mins=numeric(w.windowDurationMins)
    const name=mins===null?label:mins%1440===0?`${mins/1440} 天`:mins%60===0?`${mins/60} 小时`:`${mins} 分钟`
    const reset=numeric(w.resetsAt)
    windows.push({label:name,remainingPercent:Math.max(0,Math.min(100,100-used)),resetAt:reset===null?null:reset*1000})
  }
  const lines=windows.map(w=>`${w.label}剩余 ${Math.round(w.remainingPercent*10)/10}%`)
  if(raw.credits?.unlimited===true)lines.push('附加积分：无限额')
  else if(raw.credits?.balance!=null)lines.push(`附加积分：${String(raw.credits.balance)}`)
  return {kind:'codex',status:windows.length||lines.length?'ready':'unavailable',title:raw.planType?`Codex · ${raw.planType}`:'Codex 套餐',lines:lines.length?lines:['接口未提供余量窗口'],windows}
}
export function apiBalance(body,source='api-key') {
  const rows=Array.isArray(body?.balance_infos)?body.balance_infos:[]
  const balances=rows.filter(r=>typeof r.currency==='string'&&numeric(r.total_balance)!==null).map(r=>({currency:r.currency,total:String(r.total_balance),granted:String(r.granted_balance??''),toppedUp:String(r.topped_up_balance??'')}))
  if(!balances.length)throw new Error('余额接口没有提供可读金额')
  return {kind:'balance',status:'ready',title:source==='account'?'DeepSeek 账户余额':'DeepSeek API 余额',source,balances,windows:[],lines:balances.map(r=>`${r.currency==='CNY'?'¥':r.currency==='USD'?'$':r.currency+' '}${Number(r.total).toLocaleString('zh-CN',{maximumFractionDigits:4})}`)}
}
export function unknownUsage(kind='usage',message='当前接入未提供余额或套餐接口') {
  return {kind,status:'unavailable',title:kind==='codex'?'Codex 套餐':kind==='balance'?'DeepSeek 余额':'用量',lines:[message],windows:[]}
}
