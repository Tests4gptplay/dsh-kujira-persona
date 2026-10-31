/** Read-only signed Ark Agent Plan model allowance.
 * No credential discovery, inference calls, dashboard endpoints or logging.
 */
import {createHash, createHmac} from 'node:crypto'
const hash = s => createHash('sha256').update(s).digest('hex')
const mac = (key, s) => createHmac('sha256', key).update(s).digest()
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const query = u => [...u.searchParams].map(([k,v])=>[enc(k),enc(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0).map(x=>x.join('=')).join('&')
const canonical = (method,u,headers,body) => {
  const names=Object.keys(headers).sort(), signed=names.join(';')
  return {signed, text:[method,u.pathname,query(u),names.map(k=>`${k}:${String(headers[k]).trim()}\n`).join(''),signed,hash(body)].join('\n')}
}
const date = now => {const d=new Date(now);if(!Number.isFinite(+d))throw new Error('invalid-time');return d.toISOString().replace(/\.\d{3}Z$/,'Z')}
// Ark uses this official signed request format.
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
const obj = v => {if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('invalid-schema');return v}
function vendorError(code){const e=new Error('ark-plan-query-failed');if(/Auth|Permission|Forbidden|Unauthorized|Token|Signature|AccessDenied|NotAuthorized|NoPermission/i.test(String(code)))e.status=403;throw e}
async function credentials({profile,resolveCredential}) {
  if(typeof resolveCredential!=='function')throw new Error('credentials-required')
  const get=async ref=>{if(typeof ref!=='string'||!ref)throw new Error('credentials-required');const value=await resolveCredential(ref);if(typeof value!=='string'||!value||/[\r\n]/.test(value))throw new Error('credentials-required');return value}
  const accessKey=await get(profile.credentialRef),secret=await get(profile.secretRef),token=profile.sessionTokenRef?await get(profile.sessionTokenRef):undefined
  return {accessKey,secret,token}
}
const common={auth:'signed',headers:()=>({}),requiredFields:['credentialRef','secretRef']}
export const arkPlanAdapters = {
  'volcengine-agent-plan': {
    ...common,label:'Ark Agent Plan AFP',origins:['https://ark.cn-beijing.volces.com'],queryOrigins:['https://ark.cn-beijing.volcengineapi.com'],capabilities:['quota'],docsUrl:'https://docs.volcengine.com/docs/ark/get-afp-usage-api?lang=zh',
    async read(ctx){const {request,now=Date.now()}=ctx,keys=await credentials(ctx),url='https://ark.cn-beijing.volcengineapi.com/?Action=GetAFPUsage&Version=2024-01-01',body='{}'
      const d=obj(await request(url,{method:'POST',body,headers:signVolcengine({url,...keys,now,body,region:'cn-beijing',service:'ark'})}))
      if(d.ResponseMetadata?.Error)vendorError(d.ResponseMetadata.Error.Code)
      const data=obj(d.Result),metrics=[],issues=[]
      for(const [field,label] of [['AFPFiveHour','5h'],['AFPDaily','rolling-day'],['AFPWeekly','rolling-week'],['AFPMonthly','rolling-month']]){
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
