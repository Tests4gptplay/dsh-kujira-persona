/** Official read-only account adapters; no inference and no dashboard scraping.
 * Sources verified 2026-10-29; official references are listed in each docsUrl.
 */
export const finite = value => {
  if(value === null || value === undefined || value === '' || !['number','string'].includes(typeof value)) throw new Error('invalid-schema')
  if(typeof value==='string'&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))throw new Error('invalid-schema')
  const n=Number(value);if(!Number.isFinite(n))throw new Error('invalid-schema');return n
}
const month = now => {const end=new Date(now);return {start:new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),1)),end}}
async function buckets(request,url){
  const results=[],seen=new Set();let page
  do{
    const target=new URL(url);if(page)target.searchParams.set('page',page)
    const body=await request(target)
    if(!Array.isArray(body?.data)||typeof body.has_more!=='boolean')throw new Error('invalid-schema')
    for(const bucket of body.data){if(!Array.isArray(bucket?.results))throw new Error('invalid-schema');results.push(...bucket.results)}
    if(body.has_more){if(typeof body.next_page!=='string'||!body.next_page||seen.has(body.next_page))throw new Error('invalid-pagination');page=body.next_page;seen.add(page)}else page=null
  }while(page)
  return results
}
async function partial(tasks){
  const metrics=[],issues=[]
  for(const result of await Promise.allSettled(tasks.map(task=>task()))){if(result.status==='fulfilled')metrics.push(...result.value);else {if(['AbortError','TimeoutError'].includes(result.reason?.name))throw result.reason;issues.push(result.reason?.status===401||result.reason?.status===403?'permission-needed':'error')}}
  if(!metrics.length&&issues.length){const error=new Error('query-failed');if(issues.every(x=>x==='permission-needed'))error.status=403;throw error}
  return {metrics,issues}
}
export const westernAdapters = {
  mistral: {
    label:'Mistral',origins:['https://api.mistral.ai'],auth:'admin',capabilities:['quota'],
    docsUrl:'https://docs.mistral.ai/admin/admin-api/usage-metrics',
    async read({request}){
      // Latest official OpenAPI AdminApiKey is Bearer; no authentication fallback.
      const body=await request('https://api.mistral.ai/v1/admin/spend-limit'),limits=body?.limits,c=limits?.completion
      if(!c||(c.no_monthly_limit!==undefined&&typeof c.no_monthly_limit!=='boolean')||typeof limits.currency!=='string')throw new Error('invalid-schema')
      if(c.no_monthly_limit)return {metrics:[],notice:'no-budget'}
      return {metrics:[{kind:'quota',value:finite(c.usage_limit)-finite(c.total_usage),unit:limits.currency,currency:limits.currency,scope:'organization-budget',period:'month',remaining:true}]}
    }
  },
  openai: {
    label:'OpenAI',optionalFields:['projectId'],origins:['https://api.openai.com'],auth:'admin',capabilities:['spend','tokens'],
    docsUrl:'https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs',
    async read({request,profile,now}){
      const {start,end}=month(now),period={kind:'month',start:start.toISOString(),end:end.toISOString()},scope=profile.projectId?'project':'organization'
      const url=path=>{const u=new URL('https://api.openai.com/v1/organization/'+path);u.searchParams.set('start_time',Math.floor(+start/1000));u.searchParams.set('end_time',Math.floor(+end/1000));u.searchParams.set('limit','31');if(profile.projectId)u.searchParams.append('project_ids',profile.projectId);return u}
      return partial([
        async()=>{const rows=await buckets(request,url('costs')),totals=new Map();for(const r of rows){if(!r.amount||typeof r.amount.currency!=='string')throw new Error('invalid-schema');const c=r.amount.currency.toUpperCase();totals.set(c,(totals.get(c)??0)+finite(r.amount.value))}if(!rows.length)return [{kind:'spend',value:0,currency:'USD',scope,period}];return [...totals].map(([currency,value])=>({kind:'spend',value,currency,scope,period}))},
        async()=>{const rows=await buckets(request,url('usage/completions'));let value=0;for(const r of rows)value+=finite(r.input_tokens)+finite(r.output_tokens);return [{kind:'tokens',category:'completions',value,scope,period}]}
      ])
    }
  },
  anthropic: {
    label:'Anthropic',optionalFields:['workspaceId'],origins:['https://api.anthropic.com'],auth:'admin',capabilities:['spend','tokens'],
    headers:key=>({'x-api-key':key,'anthropic-version':'2023-06-01'}),
    docsUrl:'https://platform.claude.com/docs/en/manage-claude/usage-cost-api',
    async read({request,profile,now}){
      const {start,end}=month(now),period={kind:'month',start:start.toISOString(),end:end.toISOString()},scope=profile.workspaceId?'workspace':'organization'
      const url=path=>{const u=new URL('https://api.anthropic.com/v1/organizations/'+path);u.searchParams.set('starting_at',period.start);u.searchParams.set('ending_at',period.end);u.searchParams.set('limit','31');if(profile.workspaceId)u.searchParams.append('workspace_ids[]',profile.workspaceId);return u}
      return partial([
        async()=>{const rows=await buckets(request,url('cost_report'));let value=0;for(const r of rows){if(r.currency?.toUpperCase()!=='USD')throw new Error('invalid-schema');value+=finite(r.amount)/100}return [{kind:'spend',value,currency:'USD',scope,period}]},
        async()=>{const rows=await buckets(request,url('usage_report/messages'));let value=0;for(const r of rows)value+=finite(r.uncached_input_tokens)+finite(r.output_tokens)+finite(r.cache_read_input_tokens)+finite(r.cache_creation?.ephemeral_1h_input_tokens)+finite(r.cache_creation?.ephemeral_5m_input_tokens);return [{kind:'tokens',value,scope,period}]}
      ])
    }
  },
  xai: {
    label:'xAI',origins:['https://api.x.ai'],queryOrigins:['https://management-api.x.ai'],auth:'management',requiredFields:['teamId'],capabilities:['balance','spend'],
    docsUrl:'https://docs.x.ai/developers/rest-api-reference/management/billing',
    async read({request,profile,now}){
      const root='https://management-api.x.ai/v1/billing/teams/'+encodeURIComponent(profile.teamId),{start,end}=month(now),period={kind:'month',start:start.toISOString(),end:end.toISOString()}
      return partial([
        async()=>{const body=await request(root+'/prepaid/balance');return [{kind:'balance',value:-finite(body?.total?.val)/100,currency:'USD',scope:'team'}]},
        async()=>{const body=await request(root+'/usage',{method:'POST',body:JSON.stringify({analyticsRequest:{timeRange:{startTime:period.start.replace('T',' ').slice(0,19),endTime:period.end.replace('T',' ').slice(0,19),timezone:'Etc/GMT'},timeUnit:'TIME_UNIT_DAY',values:[{name:'usd',aggregation:'AGGREGATION_SUM'}],groupBy:['description'],filters:[]}})});if(!Array.isArray(body?.timeSeries))throw new Error('invalid-schema');let value=0;for(const series of body.timeSeries){if(!Array.isArray(series.dataPoints))throw new Error('invalid-schema');for(const point of series.dataPoints){if(!Array.isArray(point.values)||point.values.length!==1)throw new Error('invalid-schema');value+=finite(point.values[0])}}return [{kind:'spend',value,currency:'USD',scope:'team',period}]}
      ])
    }
  }
}
