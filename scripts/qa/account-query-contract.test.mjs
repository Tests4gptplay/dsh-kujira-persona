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
 assert.equal(result.status,'permission-needed');assert.match(result.lines.join(' '),/OpenAI.*本月.*消费.*用量/);assert.equal(calls,0)
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
for(const code of ['NotAuthorized','NoPermission','AuthSiteFail'])test('Alibaba HTTP400 official permission code '+code,async()=>{
 const read=reader('qwen','https://dashscope.aliyuncs.com',async()=>Response.json({Code:code,Message:'do not expose response body'}, {status:400}),{AK:'synthetic-id',SK:'synthetic-secret'})
 const result=await read({provider:'qwen',model:'qwen'},null,config('qwen',{adapter:'alibaba-billing',credentialRef:'AK',secretRef:'SK',site:'china'}))
 assert.equal(result.status,'permission-needed');assert.equal(JSON.stringify(result).includes('do not expose'),false)
})
test('Unrecognized Alibaba HTTP400 stays an error, not zero or guessed permission',async()=>{
 const read=reader('qwen','https://dashscope.aliyuncs.com',async()=>Response.json({Code:'InvalidParameter'}, {status:400}),{AK:'synthetic-id',SK:'synthetic-secret'})
 await assert.rejects(read({provider:'qwen',model:'qwen'},null,config('qwen',{adapter:'alibaba-billing',credentialRef:'AK',secretRef:'SK',site:'china'})))
})
test('GLM official quota windows retained',async()=>{
 const r=await vendorAdapters['glm-coding-plan'].read({baseURL:'https://api.z.ai',request:async()=>({data:{limits:[{type:'TOKENS_LIMIT',percentage:25},{type:'TIME_LIMIT',percentage:10}]}})})
 assert.deepEqual(r.metrics.map(x=>x.period),['five-hours','month']);assert.equal(r.metrics.every(x=>x.remaining===false),true)
})
