import test from 'node:test'
import assert from 'node:assert/strict'
const {accountConfigurationOptions}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/account-options.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/account-options.js',import.meta.url))
const {createUsageReader}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/usage.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/usage.js',import.meta.url))
const {PetController}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/controller.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/controller.js',import.meta.url))
const providers={deepseek:{baseURL:'https://api.deepseek.com',apiKeyEnv:'DEEPSEEK_API_KEY'},openai:{baseURL:'https://api.openai.com'},qwen:{baseURL:'https://dashscope.aliyuncs.com'},claude:{baseURL:'https://api.anthropic.com'},gemini:{baseURL:'https://generativelanguage.googleapis.com'},proxy:{baseURL:'https://example.invalid/v1'}}
const read=createUsageReader({settings:{describe:()=>[{value:{providers}}]}},{fetch:()=>{throw Error('unexpected network')},environment:{}})
const info=p=>read.describe({provider:p,model:({openai:'gpt-test',deepseek:'deepseek-test',claude:'claude-test',qwen:'qwen-test',gemini:'gemini-test',proxy:'deepseek-test',ark:'doubao-test'})[p]??'unknown'},{})
test('only extra-setup query methods on configured endpoints are listed; labels distinguish third parties',()=>{
 const infos=Object.keys(providers).map(info);infos.find(i=>i.provider==='proxy').profile={adapter:'deepseek-compatible'}
 const options=accountConfigurationOptions(infos)
 assert.equal(options.some(o=>o.provider==='deepseek'),false)
 assert.equal(options.some(o=>o.adapter==='openai'&&o.provider==='openai'&&!o.thirdParty),true)
 assert.equal(options.some(o=>o.provider==='qwen'),false)
 assert.equal(options.some(o=>/claude-code|codex-local|deepseek-account/.test(o.adapter)),false)
 assert.equal(options.some(o=>o.provider==='claude'&&o.adapter==='anthropic'),true)
 assert.equal(options.some(o=>o.provider==='proxy'&&o.adapter==='deepseek-compatible'&&o.thirdParty),true)
 assert.equal(options.some(o=>o.adapter==='moonshot-admin'),false)
 assert.equal(options.some(o=>o.provider==='gemini'),false)
 assert.equal(accountConfigurationOptions([info('proxy')]).length,0)
})
test('Host automatic accounts are omitted without querying them',()=>{
 const options=accountConfigurationOptions([{provider:'automatic',model:'default',hostAccount:true,adapters:[{id:'host',auth:'host',available:true}]}])
 assert.deepEqual(options,[])
})
test('no known automatic query returns hidden unsupported without any request',async()=>{
 const result=await read({provider:'gemini',model:'gemini-test'},undefined,{})
 assert.equal(result.status,'unsupported');assert.equal(result.hidden,true)
 const controller=new PetController({queryUsage:read,resolvePersona:async()=>({})})
 controller.usage=result
 assert.equal(controller.snapshot().usage,null)
})
test('supported configuration and valid zero are not hidden',async()=>{
 const result=await read({provider:'openai',model:'gpt-test'},undefined,{})
 assert.equal(result.status,'configuration-needed');assert.equal(result.hidden,false)
 const controller=new PetController({queryUsage:read,resolvePersona:async()=>({})});controller.usage=result
 assert.equal(controller.snapshot().usage.status,'configuration-needed')
 controller.usage={status:'ready',metrics:[{kind:'balance',value:0}],lines:['0']}
 assert.equal(controller.snapshot().usage.metrics[0].value,0)
})

test('cloud model endpoints never fall back to generic cloud billing',async()=>{
 for(const provider of ['qwen']){const result=await read({provider,model:'qwen-test'});assert.equal(result.hidden,true);assert.equal(result.status,'unsupported')}
 const ark=createUsageReader({settings:{describe:()=>[{value:{providers:{ark:{baseURL:'https://ark.cn-beijing.volces.com'}}}}]}},{environment:{}}).describe({provider:'ark',model:'doubao-test'})
 const options=accountConfigurationOptions([ark]);assert.deepEqual(options.map(o=>o.adapter),['volcengine-agent-plan'])
 assert.equal(ark.autoAdapter,'volcengine-agent-plan')
 for(const blocked of ['alibaba-billing','tencent-billing','volcengine-billing'])assert.equal(ark.adapters.some(a=>a.id===blocked),false)
})

test('known provider cannot invent a named model identity or query another model company',async()=>{
 for(const model of ['unnamed-future-ai','claude-other-company']){
  const route={provider:'openai',model};assert.equal((await read(route)).hidden,true)
  assert.deepEqual(accountConfigurationOptions([read.describe(route)]),[])
 }
})
