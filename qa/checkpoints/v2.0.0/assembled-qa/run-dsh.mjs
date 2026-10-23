import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const requests=[];let sequence=0
const ids=['deepseek-chat','gpt-4o','gpt-4.1','glm-4.6','gemini-2.5-pro','private-model-v1']
const models=ids.map(id=>({id,name:id+' API [模拟]',contextWindow:128000,maxTokens:4096}))
const makeProvider=(displayName,models)=>({displayName,api:'openai-completions',apiKeyEnv:'KUJIRA_TRIAL_KEY',baseURL:'http://127.0.0.1:18181/v1',models})
const providers={'trial-metered':makeProvider('API 测试接入',models),'codex-local':makeProvider('Codex Native 接口模拟',models.filter(m=>m.id.startsWith('gpt')).map(m=>({...m,name:m.id+' Codex [模拟]'})))}
await writeFile('trial/home/profiles/web/cordis.patch.yml',JSON.stringify([{id:'llm-pi-ai',config:{providers}},{id:'agent-default-model',config:{provider:'trial-metered',model:'deepseek-chat'}},{id:'session-title-llm',disabled:true},{insert:[{id:'kujira-qa-account',name:resolve('qa/host-fixture.mjs')}]}],null,2))
await writeFile('trial/workspace/sample.txt','Kujira 桌宠测试。只有一只；模型切换更换形象。\n')
const server=createServer(async(req,res)=>{
 if(req.url==='/user/balance'){res.setHeader('content-type','application/json');res.end(JSON.stringify({is_available:true,balance_infos:[{currency:'CNY',total_balance:'57.25',granted_balance:'7.25',topped_up_balance:'50'}]}));return}
 if(req.url==='/qa/requests'){res.setHeader('content-type','application/json');res.end(JSON.stringify(requests));return}
 if(req.method==='GET'&&req.url==='/v1/models'){res.setHeader('content-type','application/json');res.end(JSON.stringify({data:models.map(m=>({id:m.id,object:'model'}))}));return}
 if(req.method!=='POST'||req.url!=='/v1/chat/completions'){res.writeHead(404);res.end();return}
 let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),id=++sequence;requests.push({id,body});await writeFile(`evidence/request-${id}.json`,JSON.stringify(body,null,2))
 const needsRead=body.messages.some(m=>typeof m.content==='string'&&m.content.includes('读取 sample.txt'))
 const afterTool=body.messages.at(-1)?.role==='tool',tool=(body.tools??[]).find(t=>t.function?.name==='read')?.function
 let content='这是模拟模型的回复。任务已经完成。',calls=[]
 if(needsRead&&!afterTool&&tool){const props=tool.parameters?.properties??{};const key=Object.keys(props).find(k=>/path/i.test(k))??'path';calls=[{index:0,id:'call_read_'+id,type:'function',function:{name:tool.name,arguments:JSON.stringify({[key]:resolve('trial/workspace/sample.txt')})}}]}
 else if(afterTool)content='读取完成：文件里写着，桌宠只有一只，模型切换时更换形象。'
 await new Promise(r=>setTimeout(r,1800))
 res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'})
 const send=(delta,finish_reason=null)=>res.write(`data: ${JSON.stringify({id:'mock_'+id,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:body.model,choices:[{index:0,delta,finish_reason}]})}\n\n`)
 send({role:'assistant'});if(calls.length)send({tool_calls:calls});else send({content});send({},calls.length?'tool_calls':'stop');res.end('data: [DONE]\n\n')
})
await new Promise(r=>server.listen(18181,'127.0.0.1',r))
const env={...process.env,DSH_HOME:resolve('trial/home'),KUJIRA_TRIAL_KEY:'synthetic-test-no-real-key',PATH:resolve('payload/node-bin')+':'+resolve('payload/runtime/node_modules/.bin')+':'+process.env.PATH}
const child=spawn(resolve('payload/node-bin/node'),[resolve('payload/runtime/node_modules/@deepseek-ai/dsh/lib/bin.js'),'web','--no-open'],{cwd:resolve('trial/workspace'),env,stdio:['ignore','pipe','pipe']})
let logs='';function log(b){const t=b.toString();process.stdout.write(t);logs+=t;void writeFile('evidence/dsh.log',logs)}child.stdout.on('data',log);child.stderr.on('data',log)
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{child.kill('SIGTERM');server.close();setTimeout(()=>process.exit(),500).unref()})
child.on('exit',code=>{server.close();process.exitCode=code??1})
