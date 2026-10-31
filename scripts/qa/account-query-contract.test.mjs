import test from 'node:test'
import assert from 'node:assert/strict'
const {createUsageReader}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/usage.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/usage.js',import.meta.url))
const {westernAdapters}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/usage-western.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/usage-western.js',import.meta.url))
const {vendorAdapters}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/usage-vendors.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/usage-vendors.js',import.meta.url))
const {projectUiState}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/ui-messages.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/ui-messages.js',import.meta.url))
// Synthetic transports only; endpoint/field assertions derive from official
// docs cited in docs/testing/ACCOUNT-QUERY-20261031.md. No account calls.
const now=Date.UTC(2026,9,31,12)
function reader(provider,baseURL,fetch,refs={}){
 const services={settings:{describe:()=>[{value:{providers:{[provider]:{baseURL,apiKeyEnv:'INFERENCE'}}}}]},credentials:{resolve:async ref=>({value:refs[ref]})}}
 return createUsageReader({get:k=>services[k]},{fetch,now:()=>now,environment:{}})
}
const envelope=results=>({data:[{results}],has_more:false,next_page:null})
const config=(provider,profile)=>({usageProfiles:{[provider]:profile}})
test('OpenAI missing admin reference reports purpose without fetching',async()=>{
 let calls=0;const read=reader('openai','https://api.openai.com/v1',()=>{calls++;throw Error('unexpected')})
 const result=await read({provider:'openai',model:'gpt'},null,{})
 assert.equal(result.status,'configuration-needed');assert.match(result.lines.join(' '),/OpenAI.*未接入.*设置/);assert.equal(calls,0)
})
test('OpenAI official costs and completions remain separate visible account metrics',async()=>{
 const urls=[];const read=reader('openai','https://api.openai.com/v1',async(u,o)=>{
  urls.push(u);assert.equal(o.headers.Authorization,'Bearer synthetic-admin');assert.equal(o.redirect,'error')
  assert.equal(u.searchParams.get('project_ids'),'proj-fixture');assert.equal(u.searchParams.get('start_time'),String(Date.UTC(2026,9,1)/1000))
  return Response.json(envelope(u.pathname.endsWith('/costs')?[{amount:{value:1.25,currency:'usd'}}]:[{input_tokens:100,output_tokens:20}]))
 },{ADMIN:'synthetic-admin'})
 const result=await read({provider:'openai',model:'gpt'},null,config('openai',{credentialRef:'ADMIN',projectId:'proj-fixture'}))
 assert.equal(result.status,'ready');assert.deepEqual(result.metrics.map(x=>[x.kind,x.value]),[['spend',1.25],['tokens',120]])
 assert.equal(result.lines.length,2);assert.match(result.lines.join(' '),/Completions/);assert.equal(result.metrics.some(x=>x.kind==='balance'),false)
 assert.equal(urls.length,2)
 const en=projectUiState({usage:result},'en').usage
 assert.match(en.lines.join(' '),/Completions usage/);assert.match(en.lines.join(' '),/month/)
})
test('OpenAI zero is a successful official response; failed cost keeps only tokens with partial marker',async()=>{
 const read=reader('openai','https://api.openai.com',async u=>u.pathname.endsWith('/costs')?new Response('{}',{status:403}):Response.json(envelope([{input_tokens:0,output_tokens:0}])),{ADMIN:'synthetic'})
 const result=await read({provider:'openai',model:'gpt'},null,config('openai',{credentialRef:'ADMIN'}))
 assert.equal(result.metrics.length,1);assert.equal(result.metrics[0].kind,'tokens');assert.equal(result.metrics[0].value,0);assert.deepEqual(result.issues,['permission-needed'])
})
test('OpenAI malformed fields are not silently converted to zero',async()=>{
 const read=reader('openai','https://api.openai.com',async()=>Response.json(envelope([{}])),{ADMIN:'synthetic'})
 await assert.rejects(read({provider:'openai',model:'gpt'},null,config('openai',{credentialRef:'ADMIN'})))
})
test('Mistral optional no_monthly_limit defaults false per official OpenAPI',async()=>{
 const r=await westernAdapters.mistral.read({request:async()=>({limits:{currency:'USD',completion:{monthly_limit_reached:false,usage_limit:100,total_usage:25}}})})
 assert.equal(r.metrics[0].value,75);assert.equal(r.metrics[0].scope,'organization-budget')
})
test('Mistral explicit unlimited and missing monetary data stay distinct',async()=>{
 assert.equal((await westernAdapters.mistral.read({request:async()=>({limits:{currency:'USD',completion:{no_monthly_limit:true}}})})).notice,'no-budget')
 await assert.rejects(westernAdapters.mistral.read({request:async()=>({limits:{currency:'USD',completion:{monthly_limit_reached:false,usage_limit:null,total_usage:0}}})}))
})
test('Generic cloud billing is not a model account query, even with historical explicit configuration',async()=>{
 for(const [provider,baseURL,adapter] of [['qwen','https://dashscope.aliyuncs.com','alibaba-billing'],['hunyuan','https://api.hunyuan.cloud.tencent.com','tencent-billing'],['doubao','https://ark.cn-beijing.volces.com','volcengine-billing']]){
  let calls=0;const read=reader(provider,baseURL,()=>{calls++;throw Error('unexpected cloud billing request')},{AK:'synthetic',SK:'synthetic'})
  const result=await read({provider,model:'fixture'},null,config(provider,{adapter,credentialRef:'AK',secretRef:'SK',site:'china',currency:'CNY'}))
  assert.equal(result.status,'unsupported');assert.equal(result.hidden,true);assert.equal(calls,0)
 }
})
test('GLM official quota windows retained',async()=>{
 const r=await vendorAdapters['glm-coding-plan'].read({baseURL:'https://api.z.ai',request:async()=>({data:{limits:[{type:'TOKENS_LIMIT',percentage:25},{type:'TIME_LIMIT',percentage:10}]}})})
 assert.deepEqual(r.metrics.map(x=>x.period),['five-hours','month']);assert.equal(r.metrics.every(x=>x.remaining===false),true)
})

test('OpenAI unresolved explicit reference is not presented as a usable configuration path',async()=>{
 let calls=0;const read=reader('openai','https://api.openai.com/v1',()=>{calls++;throw Error('unexpected')})
 const result=await read({provider:'openai',model:'gpt'},null,config('openai',{credentialRef:'MISSING_ADMIN'}))
 assert.equal(result.status,'configuration-needed');assert.match(result.lines.join(' '),/未接入/);assert.equal(calls,0)
})

for(const status of [401,403])test('OpenAI remote '+status+' stays permission failure, not unsupported setup',async()=>{
 const read=reader('openai','https://api.openai.com',async()=>new Response('{}',{status}),{ADMIN:'synthetic'})
 const result=await read({provider:'openai',model:'gpt'},null,config('openai',{credentialRef:'ADMIN'}))
 assert.equal(result.status,'permission-needed');assert.match(result.lines.join(' '),/无效或权限不足/);assert.doesNotMatch(result.lines.join(' '),/请配置|ADMIN|synthetic/)
})

test('xAI uses only the verified USD spend contract, not an inferred prepaid sign conversion',async()=>{
 let calls=0
 const result=await westernAdapters.xai.read({profile:{teamId:'team-fixture'},now,request:async(url,options)=>{calls++;assert.match(url,/\/usage$/);assert.equal(options.method,'POST');assert.equal(JSON.parse(options.body).analyticsRequest.values[0].name,'usd');return {timeSeries:[{dataPoints:[{values:[1.25]},{values:[2]}]}]}}})
 assert.equal(calls,1);assert.deepEqual(westernAdapters.xai.capabilities,['spend']);assert.equal(result.metrics[0].value,3.25);assert.equal(result.metrics[0].currency,'USD');assert.equal(result.metrics[0].kind,'spend')
})
test('unverified Kimi admin contract is not registered or called',async()=>{
 assert.equal(vendorAdapters['moonshot-admin'],undefined)
 const read=reader('kimi','https://api.moonshot.cn',()=>{throw Error('unexpected')})
 const result=await read({provider:'kimi',model:'kimi-test'},null,config('kimi',{adapter:'moonshot-admin',credentialRef:'ADMIN'}))
 assert.equal(result.hidden,true)
})

test('MiniMax does not substitute general/video allowance for a selected model',async()=>{
 const read=reader('minimax','https://api.minimax.io',async()=>Response.json({model_remains:[{model_name:'general',current_interval_remaining_percent:90},{model_name:'video',current_interval_remaining_percent:80}]}),{PLAN:'synthetic'})
 const result=await read({provider:'minimax',model:'MiniMax-M3.1-Flash'},null,config('minimax',{adapter:'minimax-token-plan',credentialRef:'PLAN'}))
 assert.equal(result.hidden,true);assert.equal(result.status,'unsupported')
})
