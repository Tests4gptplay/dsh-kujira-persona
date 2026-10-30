/** Read-only signed cloud billing. Public contracts checked 2026-10-29.
 * No credential discovery, inference calls, dashboard endpoints or logging.
 */
import {createHash, createHmac, randomUUID} from 'node:crypto'
const hash = s => createHash('sha256').update(s).digest('hex')
const mac = (key, s) => createHmac('sha256', key).update(s).digest()
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const query = u => [...u.searchParams].map(([k,v])=>[enc(k),enc(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0).map(x=>x.join('=')).join('&')
const canonical = (method,u,headers,body) => {
  const names=Object.keys(headers).sort(), signed=names.join(';')
  return {signed, text:[method,u.pathname,query(u),names.map(k=>`${k}:${String(headers[k]).trim()}\n`).join(''),signed,hash(body)].join('\n')}
}
const date = now => {const d=new Date(now);if(!Number.isFinite(+d))throw new Error('invalid-time');return d.toISOString().replace(/\.\d{3}Z$/,'Z')}
// Exported pure signers permit provider-published vector tests with synthetic keys.
export function signAlibaba({url,method='POST',body='',action,version,accessKey,secret,token,now,nonce=randomUUID()}) {
  const u=new URL(url),headers={host:u.host,'x-acs-action':action,'x-acs-version':version,'x-acs-date':date(now),'x-acs-signature-nonce':nonce,'x-acs-content-sha256':hash(body)}
  if(token)headers['x-acs-security-token']=token
  const c=canonical(method,u,headers,body)
  headers.authorization=`ACS3-HMAC-SHA256 Credential=${accessKey},SignedHeaders=${c.signed},Signature=${mac(secret,'ACS3-HMAC-SHA256\n'+hash(c.text)).toString('hex')}`
  return headers
}
export function signTencent({url,body='{}',action,version,accessKey,secret,token,now,service='billing'}) {
  const u=new URL(url),timestamp=Math.floor(+new Date(now)/1000),day=date(now).slice(0,10)
  const headers={'content-type':'application/json; charset=utf-8',host:u.host},c=canonical('POST',u,headers,body),scope=`${day}/${service}/tc3_request`
  const key=mac(mac(mac('TC3'+secret,day),service),'tc3_request')
  headers.authorization=`TC3-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${c.signed}, Signature=${mac(key,['TC3-HMAC-SHA256',timestamp,scope,hash(c.text)].join('\n')).toString('hex')}`
  headers['X-TC-Action']=action;headers['X-TC-Version']=version;headers['X-TC-Timestamp']=String(timestamp)
  if(token)headers['X-TC-Token']=token
  return headers
}
export function signVolcengine({url,method='POST',body='{}',accessKey,secret,token,now,region,service,compactHeaders=false}) {
  const u=new URL(url),stamp=date(now).replace(/[-:]/g,''),day=stamp.slice(0,8)
  const headers={host:u.host,'x-date':stamp}
  if(!compactHeaders){headers['content-type']='application/json';headers['x-content-sha256']=hash(body)}
  if(token)headers['x-security-token']=token
  const c=canonical(method,u,headers,body),scope=`${day}/${region}/${service}/request`,key=mac(mac(mac(mac(secret,day),region),service),'request')
  headers.authorization=`HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${c.signed}, Signature=${mac(key,['HMAC-SHA256',stamp,scope,hash(c.text)].join('\n')).toString('hex')}`
  return headers
}
const numeric = v => {if(typeof v!=='number' && (typeof v!=='string'||! /^-?\d+(?:\.\d+)?$/.test(v)))throw new Error('invalid-schema');const n=Number(v);if(!Number.isFinite(n))throw new Error('invalid-schema');return n}
const currency = v => {if(typeof v!=='string'||!/^[A-Z]{3}$/.test(v))throw new Error('currency-required');return v}
const obj = v => {if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('invalid-schema');return v}
function vendorError(code){const e=new Error('cloud-query-failed');if(/Auth|Permission|Forbidden|Unauthorized|Token|Signature|AccessDenied|NotAuthorized|NoPermission/i.test(String(code)))e.status=403;throw e}
async function credentials({profile,resolveCredential}) {
  if(typeof resolveCredential!=='function')throw new Error('credentials-required')
  const get=async ref=>{if(typeof ref!=='string'||!ref)throw new Error('credentials-required');const value=await resolveCredential(ref);if(typeof value!=='string'||!value||/[\r\n]/.test(value))throw new Error('credentials-required');return value}
  const accessKey=await get(profile.credentialRef),secret=await get(profile.secretRef),token=profile.sessionTokenRef?await get(profile.sessionTokenRef):undefined
  return {accessKey,secret,token}
}
const site = profile => {if(!['china','international'].includes(profile.site))throw new Error('site-required');return profile.site}
const balance = (value,curr) => ({metrics:[{kind:'balance',value:numeric(value),currency:currency(curr),scope:'cloud-account'}]})
const common={auth:'signed',headers:()=>({}),requiredFields:['credentialRef','secretRef']}
export const cloudVendorAdapters = {
  'alibaba-billing': {
    ...common,label:'Alibaba Cloud balance',origins:['https://dashscope.aliyuncs.com','https://dashscope-intl.aliyuncs.com','https://dashscope-us.aliyuncs.com'],queryOrigins:['https://business.aliyuncs.com','https://business.ap-southeast-1.aliyuncs.com'],requiredFields:[...common.requiredFields,'site'],capabilities:['balance'],docsUrl:'https://help.aliyun.com/en/user-center/developer-reference/api-bssopenapi-2017-12-14-queryaccountbalance',
    async read(ctx){const {profile,request,now=Date.now()}=ctx,url=site(profile)==='china'?'https://business.aliyuncs.com/':'https://business.ap-southeast-1.aliyuncs.com/',keys=await credentials(ctx)
      const d=obj(await request(url,{method:'POST',headers:signAlibaba({url,...keys,now,action:'QueryAccountBalance',version:'2017-12-14'})}))
      if(d.Success!==true)vendorError(d.Code)
      const data=obj(d.Data);return balance(data.AvailableAmount,data.Currency)
    }
  },
  'tencent-billing': {
    ...common,label:'Tencent Cloud balance',origins:['https://api.hunyuan.cloud.tencent.com','https://hunyuan.tencentcloudapi.com','https://hunyuan.ai.tencentcloudapi.com'],queryOrigins:['https://billing.tencentcloudapi.com','https://billing.intl.tencentcloudapi.com'],requiredFields:[...common.requiredFields,'site','currency'],capabilities:['balance'],docsUrl:'https://cloud.tencent.cn/document/product/555/20253',
    async read(ctx){const {profile,request,now=Date.now()}=ctx,curr=currency(profile.currency),url=site(profile)==='china'?'https://billing.tencentcloudapi.com/':'https://billing.intl.tencentcloudapi.com/',keys=await credentials(ctx),body='{}'
      const d=obj(obj(await request(url,{method:'POST',body,headers:signTencent({url,body,...keys,now,action:'DescribeAccountBalance',version:'2018-07-09'})})).Response)
      if(d.Error)vendorError(d.Error.Code)
      const cents=numeric(d.Balance);if(!Number.isSafeInteger(cents))throw new Error('invalid-schema');return balance(cents/100,curr)
    }
  },
  'volcengine-billing': {
    ...common,label:'Volcengine Cloud balance',origins:['https://ark.cn-beijing.volces.com'],queryOrigins:['https://billing.volcengineapi.com'],requiredFields:[...common.requiredFields,'currency'],capabilities:['balance'],docsUrl:'https://docs.volcengine.com/docs/billing-center/query-balance-acct-query-user-account-balance-information?lang=zh',
    async read(ctx){const {profile,request,now=Date.now()}=ctx,curr=currency(profile.currency),keys=await credentials(ctx),url='https://billing.volcengineapi.com/?Action=QueryBalanceAcct&Version=2022-01-01'
      const d=obj(await request(url,{method:'GET',headers:signVolcengine({url,...keys,now,method:'GET',body:'',region:'cn-north-1',service:'billing'})}))
      if(d.ResponseMetadata?.Error)vendorError(d.ResponseMetadata.Error.Code)
      return balance(obj(d.Result).AvailableBalance,curr)
    }
  },
  'volcengine-agent-plan': {
    ...common,label:'Ark Agent Plan AFP',origins:['https://ark.cn-beijing.volces.com'],queryOrigins:['https://ark.cn-beijing.volcengineapi.com'],capabilities:['quota'],docsUrl:'https://docs.volcengine.com/docs/ark/get-afp-usage-api?lang=zh',
    async read(ctx){const {request,now=Date.now()}=ctx,keys=await credentials(ctx),url='https://ark.cn-beijing.volcengineapi.com/?Action=GetAFPUsage&Version=2024-01-01',body='{}'
      const d=obj(await request(url,{method:'POST',body,headers:signVolcengine({url,...keys,now,body,region:'cn-beijing',service:'ark'})}))
      if(d.ResponseMetadata?.Error)vendorError(d.ResponseMetadata.Error.Code)
      const data=obj(d.Result),metrics=[],issues=[]
      for(const [field,label] of [['AFPFiveHour','5h'],['AFPDaily','day'],['AFPWeekly','week'],['AFPMonthly','month']]){
        if(data[field]===undefined){issues.push('missing-quota-window');continue}
        const w=obj(data[field]),total=numeric(w.Quota),used=numeric(w.Used),start=numeric(w.SubscribeTime),reset=numeric(w.ResetTime)
        if(total<0||used<0||!Number.isSafeInteger(start)||!Number.isSafeInteger(reset)||start<0||reset<start)throw new Error('invalid-schema')
        if(total===0){issues.push('unavailable-quota-window');continue}
        if(reset<=+new Date(now)){issues.push('expired-quota-window');continue}
        metrics.push({kind:'quota',value:used/total*100,unit:'percent',scope:'agent-plan',remaining:false,label,resetAt:reset,period:{kind:'window',start:new Date(start).toISOString(),end:new Date(reset).toISOString()}})
      }
      if(!metrics.length)throw new Error('quota-unavailable')
      return {metrics,issues}
    }
  }
}
