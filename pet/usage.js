import { modelFamily } from '../catalog.js'
import { ui } from './ui-messages.js'
/** Read the selected provider's existing account interface; never runs inference. */
import { randomUUID, createHash } from 'node:crypto'
import { apiBalance,codexQuota,unknownUsage } from './model.js'
import { westernAdapters, finite } from './usage-western.js'
import { minimaxAdapters } from './usage-minimax.js'
import { arkPlanAdapters } from './usage-ark-plan.js'
import { vendorAdapters } from './usage-vendors.js'
import { ui as message, zhUi } from './ui-messages.js'
const service=(ctx,name)=>{try{return ctx.get?.(name)??ctx[name]}catch{return undefined}}
const deepseek = {
  label:'DeepSeek',origins:['https://api.deepseek.com'],auth:'inference',capabilities:['balance'],
  docsUrl:'https://api-docs.deepseek.com/api/get-user-balance/',
  async read({request,baseURL}) {
    const body=await request(new URL('/user/balance',baseURL))
    if(!Array.isArray(body?.balance_infos))throw new Error('invalid-schema')
    for(const r of body.balance_infos)finite(r?.total_balance)
    const parsed=apiBalance(body)
    return {metrics:parsed.balances.map(r=>({kind:'balance',value:Number(r.total),currency:r.currency,scope:'account'}))}
  }
}
const deepseekCompatible={...deepseek,label:'DeepSeek-compatible',explicitOnly:true,origins:[],
  async read({request,baseURL}){const url=new URL(baseURL);url.pathname=url.pathname.replace(/\/(v1|anthropic)\/?$/,'').replace(/\/$/,'')+'/user/balance';url.search='';url.hash='';const body=await request(url);if(!Array.isArray(body?.balance_infos))throw new Error('invalid-schema');for(const r of body.balance_infos)finite(r?.total_balance);const data=apiBalance(body);return {metrics:data.balances.map(r=>({kind:'balance',value:Number(r.total),currency:r.currency,scope:'account'}))}}
}
export const USAGE_ADAPTERS={deepseek,...westernAdapters,...vendorAdapters,...arkPlanAdapters,...minimaxAdapters,'deepseek-compatible':deepseekCompatible}
const ACCOUNT_FAMILIES={deepseek:['deepseek'],mistral:['mistral'],openai:['gpt'],anthropic:['claude'],xai:['grok'],moonshot:['kimi'],'glm-coding-plan':['glm'],'minimax-token-plan':['minimax'],'volcengine-agent-plan':['doubao']}
const matchesModel=(id,info)=>info.family!=='none'&&(!ACCOUNT_FAMILIES[id]||ACCOUNT_FAMILIES[id].includes(info.family))
// Public reference pages, not live price feeds. Only actual provider origins match.
const PRICE_REFERENCES={
  'https://api.openai.com':'https://developers.openai.com/api/docs/pricing',
  'https://api.anthropic.com':'https://platform.claude.com/docs/en/about-claude/pricing',
  'https://generativelanguage.googleapis.com':'https://ai.google.dev/gemini-api/docs/pricing',
  'https://api.deepseek.com':'https://api-docs.deepseek.com/quick_start/pricing/',
  'https://api.x.ai':'https://docs.x.ai/developers/pricing',
  'https://api.mistral.ai':'https://docs.mistral.ai/inference/pricing',
  'https://api.moonshot.cn':'https://platform.kimi.com/docs/pricing/chat',
  'https://open.bigmodel.cn':'https://docs.bigmodel.cn/cn/guide/start/pricing'
}
const originOf = base => {try{const u=new URL(base);return u.protocol==='https:'&&!u.username&&!u.password?u.origin:null}catch{return null}}
function providerInfo(ctx,route){
  const forms=service(ctx,'settings')?.describe?.()??[]
  const declared=service(ctx,'llm')?.listConfigurableProviders?.().find(p=>p.provider===route.provider)
  let provider=declared?forms.find(f=>f.ns===declared.settingsNs)?.value:null
  for(const segment of declared?.settingsPath??[])provider=provider?.[segment]
  if(!provider)for(const f of forms){if(f.value?.providers?.[route.provider]){provider=f.value.providers[route.provider];break}}
  const official=['deepseek-official','deepseek-messages'].includes(route.provider)
  const modelOverride=provider?.modelOverrides?.[route.model]??provider?.models?.find?.(m=>m.id===route.model)
  // An endpoint environment override must not fall back to a different origin.
  const envBase=(declared?.baseURLEnv??[]).map(name=>process.env[name]).find(Boolean)
  const baseURL=modelOverride?.baseURL??provider?.baseURL??envBase??(official?process.env.DEEPSEEK_BASE_URL??'https://api.deepseek.com':declared?.defaultBaseURL)
  const credentialRef=modelOverride?.apiKeyEnv??provider?.apiKeyEnv??(official?'DEEPSEEK_API_KEY':undefined)
  return {baseURL,family:modelFamily(route),credentialRef,nativeAuth:declared?.nativeAuth,settingsNs:declared?.settingsNs}
}
// Keep provider identities separate: matching ref names alone do not prove that
// two Host providers use the same account/organization. Models inside one
// provider share only the exact endpoint and declared inference credential ref.
function profileKeyFor(route,info){
  if(!originOf(info.baseURL))return route.provider
  const endpoint=new URL(info.baseURL);endpoint.hash='';endpoint.pathname=endpoint.pathname.replace(/\/$/,'')
  return 'account:'+createHash('sha256').update(JSON.stringify([route.provider,endpoint.href,info.credentialRef??null])).digest('hex')
}
function profileFor(config,route,info){const key=profileKeyFor(route,info);return config.usageProfiles?.[key]??config.usageProfiles?.[route.provider]??{adapter:'auto'}}
function adapterFor(info,profile){
  if(profile?.adapter==='none')return null
  const origin=originOf(info.baseURL)
  if(profile?.adapter&&profile.adapter!=='auto'){
    const adapter=Object.hasOwn(USAGE_ADAPTERS,profile.adapter)?USAGE_ADAPTERS[profile.adapter]:null
    return adapter&&matchesModel(profile.adapter,info)&&(adapter.origins.includes(origin)||(adapter.explicitOnly&&origin))?{id:profile.adapter,...adapter}:null
  }
  // Prefer the normal key adapter when both inference and admin capabilities exist.
  const entries=Object.entries(USAGE_ADAPTERS).filter(([id,a])=>matchesModel(id,info)&&a.origins.includes(origin))
  const found=entries.find(([,a])=>a.auth==='inference')??entries.find(([,a])=>a.auth!=='coding-plan')
  return found?{id:found[0],...found[1]}:null
}
const failure=(status,key='usage.query.'+status)=>({kind:'account',status,hidden:status==='unsupported'||status==='disabled',title:'账户',titleUi:message('usage.account'),lines:[zhUi(message(key))],linesUi:[message(key)],windows:[],metrics:[]})
function presented(data,adapter){
  if(data.unsupported===true)return failure('unsupported')
  const metrics=(data.metrics??[]).filter(m=>m&&['balance','spend','tokens','quota'].includes(m.kind)&&Number.isFinite(m.value))
  const noticeKey={'no-budget':'usage.noBudget','unlimited-plan':'usage.unlimitedPlan','not-in-plan':'usage.notInPlan'}[data.notice]
  if(!metrics.length&&noticeKey){const d=message(noticeKey);return {kind:'account',status:data.notice==='not-in-plan'?'unsupported':'ready',title:adapter.label,adapter:adapter.id,metrics:[],windows:[],lines:[zhUi(d)],linesUi:[d],details:[zhUi(d)],detailsUi:[d]}}
  if(!metrics.length)return failure('unavailable')
  const metricLabel=m=>({'Coding used':message('usage.quota.coding'),'MCP used':message('usage.quota.mcp'),interval:message('usage.quota.interval'),week:message('usage.quota.week'),day:message('usage.quota.day'),month:message('usage.quota.month'),'5h':message('usage.quota.fiveHours'),'rolling-day':message('usage.quota.rollingDay'),'rolling-week':message('usage.quota.rollingWeek'),'rolling-month':message('usage.quota.rollingMonth')})[m.label]??m.label??''
  const descriptors=metrics.map(m=>message(m.kind==='tokens'&&m.category==='completions'?'usage.metric.completions':'usage.metric.'+m.kind,{value:Number(m.value.toFixed(6)).toLocaleString('en-US'),currency:m.currency??'',scope:message('usage.scope.'+(m.scope??'account')),period:message('usage.period.'+(typeof m.period==='string'?m.period:m.period?.kind??'current')),label:metricLabel(m),unit:m.unit==='percent'?'%':m.unit??'',direction:message(m.remaining===false?'usage.used':'usage.left')}))
  const primary=metrics.map((m,i)=>({m,d:descriptors[i]})).slice(0,2).map(x=>x.d)
  const linesUi=primary.length?primary:descriptors.slice(0,1)
  if(noticeKey)descriptors.push(message(noticeKey))
  if(data.issues?.length)linesUi.push(message('usage.query.partial'))
  return {kind:'account',status:'ready',title:adapter.label,titleUi:null,adapter:adapter.id,metrics,details:descriptors.map(zhUi),detailsUi:descriptors,lines:linesUi.map(zhUi),linesUi,windows:metrics.filter(m=>Number.isFinite(m.resetAt)).map(m=>({label:typeof metricLabel(m)==='string'?metricLabel(m):zhUi(metricLabel(m)),labelUi:typeof metricLabel(m)==='object'?metricLabel(m):null,resetAt:m.resetAt})),prices:data.prices??[],pricingUnavailable:!!data.pricingUnavailable,issues:data.issues??[]}
}
export function createUsageReader(ctx,{fetch:transport=globalThis.fetch,now=Date.now,environment=process.env}={}) {
  const read=async (route,signal,config={})=>{
    const info=providerInfo(ctx,route),profile=profileFor(config,route,info)
    if(profile.adapter==='none')return failure('disabled')
    signal?.throwIfAborted()
    if(route.provider==='codex-local'){
      const connection=service(ctx,'connection')
      if(!connection)return unknownUsage('codex','Codex 账户接口尚未加载',ui('usage.codexNotLoaded'))
      const method='codex-native/quota'
      const request=new Request(`http://dsh.local/api/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method,payload:{}}),signal})
      const response=await connection.createSharedFetchHandler('/api').fetch(request,connection.browserPeer)
      if(!response.ok)return unknownUsage('codex','请启用 Codex Native 插件并在 DSH 中登录',ui('usage.codexLogin'))
      const envelope=await response.json()
      signal?.throwIfAborted()
      if(!envelope.result?.ok)return unknownUsage('codex','套餐查询暂不可用；请检查 Codex 登录状态',ui('usage.codexUnavailable'))
      return codexQuota(envelope.result.value)
    }
    if(route.provider==='deepseek-account'){
      const account=service(ctx,'deepseekAccount')
      if(!account?.getBalance)return unknownUsage('balance','请在 DSH 中登录 DeepSeek 账户',ui('usage.deepseekLogin'))
      const state=await account.getState()
      signal?.throwIfAborted()
      if(state?.status!=='credential-stored')return unknownUsage('balance','DeepSeek 账户尚未登录',ui('usage.deepseekLoggedOut'))
      const body=await account.getBalance({version:service(ctx,'pluginPackages')?.packageOf?.('@deepseek-ai/dsh-app-boot',import.meta.url)?.version??'0.2.1',locale:'zh-CN',timezoneOffsetSeconds:-new Date().getTimezoneOffset()*60})
      signal?.throwIfAborted()
      if(body?.status!=='ready')return unknownUsage('balance','账户余额暂不可用',ui('usage.accountUnavailable'))
      if(!Array.isArray(body.value)||(body.bonusWallets!==undefined&&!Array.isArray(body.bonusWallets)))throw new Error('invalid-schema')
      const totals=new Map()
      for(const [field,wallets] of [['topped_up_balance',body.value],['granted_balance',body.bonusWallets]])for(const wallet of wallets??[]){
        const n=finite(wallet?.balance);if(typeof wallet.currency!=='string'||!wallet.currency)throw new Error('invalid-schema')
        const row=totals.get(wallet.currency)??{currency:wallet.currency,granted_balance:0,topped_up_balance:0}
        row[field]+=n;totals.set(wallet.currency,row)
      }
      return apiBalance({balance_infos:[...totals.values()].map(r=>({...r,total_balance:r.granted_balance+r.topped_up_balance}))},'account')
    }

    const adapter=adapterFor(info,profile)
    if(!adapter)return failure(Object.entries(USAGE_ADAPTERS).some(([id,a])=>matchesModel(id,info)&&a.origins.includes(originOf(info.baseURL)))&&(!profile.adapter||profile.adapter==='auto')?'configuration-needed':'unsupported')
    const credentialCache=new Map()
    const resolveCredential=async ref=>{
      if(typeof ref!=='string'||!ref)return null
      if(credentialCache.has(ref))return credentialCache.get(ref)
      const credentials=service(ctx,'credentials')
      const secret=credentials?await credentials.resolve(ref):{value:environment[ref]}
      const value=typeof secret?.value==='string'&&secret.value?secret.value:null
      credentialCache.set(ref,value);return value
    }
    const permissionFailure=()=>failure('permission-needed',adapter.id==='openai'?'usage.query.openai-permission-needed':'usage.query.permission-needed')
    const missingCredential=()=>adapter.id==='openai'?failure('configuration-needed','usage.query.openai-not-connected'):permissionFailure()
    const explicit=profile.credentialRef
    if(adapter.requiredFields?.some(field=>!profile[field]))return failure('configuration-needed')
    // Administration permissions are independent from model inference keys.
    if(adapter.auth!=='inference'&&!explicit)return missingCredential()
    let credentialRef=explicit??info.credentialRef
    if(!credentialRef&&adapter.auth==='inference')credentialRef=info.nativeAuth?.env?.find(name=>/^[A-Z][A-Z0-9_]*_API_KEY$/.test(name))
    let key
    if(explicit||info.credentialRef)key=await resolveCredential(credentialRef)
    else if(adapter.auth==='inference'){
      // Only the actual owning pi-ai adapter's stored API-key record; never OAuth grants.
      if(info.settingsNs==='llm-pi-ai'&&/^[a-z][a-z0-9-]*$/.test(route.provider)){
        const record=await service(ctx,'credentials')?.readRecord?.('llm-pi-ai/'+route.provider)
        if(record&&record.kind!=='api-key')return failure('permission-needed')
        if(record?.kind==='api-key')key=typeof record.key==='string'?record.key:credentialRef?record.env?.[credentialRef]:null
      }
      if(!key&&credentialRef)key=await resolveCredential(credentialRef)
    }
    if(!key)return missingCredential()
    const allowed=adapter.explicitOnly?[originOf(info.baseURL)]:(adapter.queryOrigins??adapter.origins)
    const request=async(url,options={})=>{
      signal?.throwIfAborted()
      const target=new URL(url)
      if(target.username||target.password||!allowed.includes(target.origin)||target.protocol!=='https:')throw new Error('query-origin-rejected')
      const headers={...(adapter.headers?adapter.headers(key):adapter.auth==='signed'?{}:{Authorization:`Bearer ${key}`}),...(options.body?{'content-type':'application/json'}:{}),...options.headers}
      const response=await transport(target,{...options,headers,signal,redirect:'error'})
      if(!response.ok){
        const error=new Error('query-failed');error.status=response.status
        throw error
      }
      return response.json()
    }
    try{const data=await adapter.read({request,profile,route,baseURL:info.baseURL,now:now(),resolveCredential});signal?.throwIfAborted();return presented(data,adapter)}
    catch(error){if(signal?.aborted)throw error;if(error.status===401||error.status===403||error.message==='credentials-required')return permissionFailure();if(error.status===404)return failure('unsupported');throw error}
  }
  read.describe=(route,config={})=>{
    const info=providerInfo(ctx,route),profile=profileFor(config,route,info),adapter=adapterFor(info,profile),origin=originOf(info.baseURL)
    const hostAccount=['deepseek-account','codex-local'].includes(route.provider)
    if(hostAccount)return {provider:route.provider,model:route.model,origin:null,hostAccount:true,adapter:profile.adapter==='none'?null:route.provider,autoAdapter:route.provider,profile,priceKey:route.provider+'/'+route.model,price:config.modelPrices?.[route.provider+'/'+route.model]??null,adapters:[{id:route.provider,label:route.provider==='codex-local'?'Codex':'DeepSeek',auth:'host',capabilities:[route.provider==='codex-local'?'quota':'balance'],requiredFields:[],optionalFields:[],available:true}]}
    return {provider:route.provider,model:route.model,profileKey:profileKeyFor(route,info),origin,endpoint:origin?origin+new URL(info.baseURL).pathname:null,inferenceCredentialRef:info.credentialRef??null,pricingReference:PRICE_REFERENCES[origin]?{url:PRICE_REFERENCES[origin],checkedAt:'2026-10-29',kind:'reference-only'}:null,adapter:adapter?.id??null,autoAdapter:adapterFor(info,{adapter:'auto'})?.id??null,profile,priceKey:route.provider+'/'+route.model,price:config.modelPrices?.[route.provider+'/'+route.model]??null,adapters:Object.entries(USAGE_ADAPTERS).map(([id,a])=>({id,label:a.label,auth:a.auth,thirdParty:!!a.explicitOnly,configurationSupported:true,capabilities:a.capabilities,requiredFields:a.requiredFields??[],optionalFields:a.optionalFields??(a.auth==='signed'?['sessionTokenRef']:[]),docsUrl:a.docsUrl,available:matchesModel(id,info)&&(a.origins.includes(origin)||!!(a.explicitOnly&&origin))}))}
  }
  return read
}
