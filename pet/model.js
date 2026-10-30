import { usageProfiles, modelPrices } from './usage-config.js'
import { ui, uiError, zhUi } from './ui-messages.js'
/** Presentation data only. No model calls, file scans, or work execution. */
export const NAMES = Object.freeze({ deepseek:'DeepSeek',gpt:'GPT',gemini:'星猫',claude:'Claude',grok:'Grok',glm:'GLM',kimi:'Kimi',qwen:'Qwen',minimax:'MiniMax',llama:'Llama',doubao:'豆包',mistral:'Mistral',hunyuan:'混元',mimo:'MiMo',stella:'星璃' })
export const DEFAULTS = Object.freeze({ enabled:false, showPet:true, display:'auto', scale:1, bubbleScale:1, activity:'normal', reducedMotion:false, sound:false, bubble:'always', bubbleBeforeHidden:'always', showUsage:true, showStats:true, refreshSeconds:60, x:null, y:null, pageRight:null, pageBottom:null, desktopX:null, desktopY:null })
export function settings(input={}) {
  const value={...DEFAULTS}
  for(const key of ['enabled','showPet','reducedMotion','sound','showUsage','showStats']) if(typeof input[key]==='boolean') value[key]=input[key]
  for(const [key,options] of Object.entries({display:['auto','desktop','page'],activity:['quiet','normal','lively'],bubble:['always','tasks','hidden'],bubbleBeforeHidden:['always','tasks']})) if(options.includes(input[key])) value[key]=input[key]
  for(const key of ['scale','bubbleScale'])if(Number.isFinite(input[key])&&input[key]>0)value[key]=input[key]
  if(Number.isFinite(input.refreshSeconds))value.refreshSeconds=Math.max(0,input.refreshSeconds)
  for(const key of ['x','y','pageRight','pageBottom','desktopX','desktopY']) if(Number.isFinite(input[key])) value[key]=input[key]
  if(value.bubble!=='hidden')value.bubbleBeforeHidden=value.bubble
  value.usageProfiles=usageProfiles(input.usageProfiles)
  value.modelPrices=modelPrices(input.modelPrices)
  return value
}
export {emptyTask,reduceTask} from './task.js'
const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null
export function codexQuota(body) {
  const raw=body?.rateLimits??body
  if(!raw||typeof raw!=='object')return {kind:'codex',status:'unavailable',title:'Codex 套餐',titleUi:ui('usage.codex'),lines:['暂未取得套餐余量'],linesUi:[ui('usage.noQuota')],windows:[]}
  const windows=[]
  for(const key of ['primary','secondary']){
    const w=raw[key],used=numeric(w?.usedPercent);if(!w||used===null)continue
    const mins=numeric(w.windowDurationMins)
    const labelUi=mins===null?ui('usage.'+key):mins%1440===0?ui('usage.days',{count:mins/1440}):mins%60===0?ui('usage.hours',{count:mins/60}):ui('usage.minutes',{count:mins})
    const reset=numeric(w.resetsAt)
    windows.push({label:zhUi(labelUi),labelUi,remainingPercent:Math.max(0,Math.min(100,100-used)),resetAt:reset===null?null:reset*1000})
  }
  const linesUi=windows.map(w=>ui('usage.remaining',{label:w.labelUi,percent:Math.round(w.remainingPercent*10)/10}))
  if(raw.credits?.unlimited===true)linesUi.push(ui('usage.unlimited'))
  else if(raw.credits?.balance!=null)linesUi.push(ui('usage.credits',{balance:String(raw.credits.balance)}))
  const status=windows.length||linesUi.length?'ready':'unavailable'
  if(!linesUi.length)linesUi.push(ui('usage.noWindows'))
  return {kind:'codex',status,title:raw.planType?`Codex · ${raw.planType}`:'Codex 套餐',titleUi:raw.planType?null:ui('usage.codex'),lines:linesUi.map(zhUi),linesUi,windows}
}
export function apiBalance(body,source='api-key') {
  const rows=Array.isArray(body?.balance_infos)?body.balance_infos:[]
  const balances=rows.filter(r=>typeof r.currency==='string'&&numeric(r.total_balance)!==null).map(r=>({currency:r.currency,total:String(r.total_balance),granted:String(r.granted_balance??''),toppedUp:String(r.topped_up_balance??'')}))
  if(!balances.length)throw uiError('usage.noAmount')
  return {kind:'balance',status:'ready',title:source==='account'?'DeepSeek 账户余额':'DeepSeek API 余额',titleUi:ui(source==='account'?'usage.accountBalance':'usage.apiBalance'),source,balances,windows:[],lines:balances.map(r=>`${r.currency==='CNY'?'¥':r.currency==='USD'?'$':r.currency+' '}${Number(r.total).toLocaleString('zh-CN',{maximumFractionDigits:4})}`)}
}
export function unknownUsage(kind='usage',message='当前接入未提供余额或套餐接口',messageUi) {
  if(arguments.length<2)messageUi=ui('usage.unsupported')
  return {kind,status:'unavailable',title:kind==='codex'?'Codex 套餐':kind==='balance'?'DeepSeek 余额':'用量',titleUi:ui(kind==='codex'?'usage.codex':kind==='balance'?'usage.balance':'usage.usage'),lines:[message],linesUi:[messageUi??null],windows:[]}
}
