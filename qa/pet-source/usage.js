/** Read the selected provider's existing account interface; never runs inference. */
import { randomUUID } from 'node:crypto'
import { apiBalance,codexQuota,unknownUsage } from './model.js'
const service=(ctx,name)=>{try{return ctx.get?.(name)??ctx[name]}catch{return undefined}}
export function createUsageReader(ctx) {
  return async (route,signal)=>{
    if(route.provider==='codex-local'){
      const connection=service(ctx,'connection')
      if(!connection)return unknownUsage('codex','Codex 账户接口尚未加载')
      const method='codex-native/quota'
      const request=new Request(`http://dsh.local/api/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method,payload:{}}),signal})
      const response=await connection.createSharedFetchHandler('/api').fetch(request,connection.browserPeer)
      if(!response.ok)return unknownUsage('codex','请启用 Codex Native 插件并在 DSH 中登录')
      const envelope=await response.json()
      if(!envelope.result?.ok)return unknownUsage('codex','套餐查询暂不可用；请检查 Codex 登录状态')
      return codexQuota(envelope.result.value)
    }
    if(route.family!=='deepseek')return unknownUsage()
    if(route.provider==='deepseek-account'){
      const account=service(ctx,'deepseekAccount')
      if(!account?.getBalance)return unknownUsage('balance','请在 DSH 中登录 DeepSeek 账户')
      const state=await account.getState()
      if(state?.status!=='credential-stored')return unknownUsage('balance','DeepSeek 账户尚未登录')
      const body=await account.getBalance({version:service(ctx,'pluginPackages')?.packageOf?.('@deepseek-ai/dsh-app-boot',import.meta.url)?.version??'0.2.1',locale:'zh-CN',timezoneOffsetSeconds:-new Date().getTimezoneOffset()*60})
      if(body?.status!=='ready')return unknownUsage('balance','账户余额暂不可用')
      const totals=new Map()
      for(const [field,wallets] of [['topped_up_balance',body.value],['granted_balance',body.bonusWallets]])for(const wallet of wallets??[]){
        const n=Number(wallet.balance);if(!Number.isFinite(n))continue
        const row=totals.get(wallet.currency)??{currency:wallet.currency,granted_balance:0,topped_up_balance:0}
        row[field]+=n;totals.set(wallet.currency,row)
      }
      return apiBalance({balance_infos:[...totals.values()].map(r=>({...r,total_balance:r.granted_balance+r.topped_up_balance}))},'account')
    }
    const forms=service(ctx,'settings')?.describe?.()??[]
    const declared=service(ctx,'llm')?.listConfigurableProviders?.().find(p=>p.provider===route.provider)
    let provider=declared?forms.find(f=>f.ns===declared.settingsNs)?.value:null
    if(!provider)for(const f of forms){if(f.value?.providers?.[route.provider]){provider=f.value.providers[route.provider];break}}
    const official=['deepseek-official','deepseek-messages'].includes(route.provider)
    if(!provider&&!official)return unknownUsage('balance','这个接入未提供可查询的余额地址')
    const ref=provider?.apiKeyEnv??(official?'DEEPSEEK_API_KEY':null)
    if(!ref)return unknownUsage('balance','请在 DSH 模型设置中配置此接入的凭据')
    const credentials=service(ctx,'credentials')
    const secret=credentials?await credentials.resolve(ref):{value:process.env[ref]}
    if(!secret?.value)return unknownUsage('balance','此接入尚未配置 API Key')
    const base=provider?.baseURL??(official?process.env.DEEPSEEK_BASE_URL??'https://api.deepseek.com':null)
    if(!base)return unknownUsage('balance','此接入没有余额查询地址')
    const url=new URL(base)
    url.pathname=url.pathname.replace(/\/(v1|anthropic)\/?$/,'').replace(/\/$/,'')+'/user/balance';url.search='';url.hash=''
    const response=await fetch(url,{headers:{Authorization:`Bearer ${secret.value}`},signal,redirect:'error'})
    if(!response.ok)return unknownUsage('balance',response.status===401||response.status===403?'余额凭据已失效，请在 DSH 中重新配置':'这个接入暂时无法查询余额')
    return apiBalance(await response.json())
  }
}
