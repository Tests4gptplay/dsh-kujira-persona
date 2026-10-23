import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from 'playwright'

const repo = process.env.GITHUB_REPOSITORY
const branch = 'qa/live-dsh-relay-20261023'
const root = resolve('trial')
const evidence = join(root, 'evidence')
const home = join(root, 'home')
const workspace = join(root, 'workspace')
await Promise.all([mkdir(evidence, { recursive: true }), mkdir(home, { recursive: true }), mkdir(workspace, { recursive: true })])
const headers = { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
const api = `https://api.github.com/repos/${repo}/contents/`
const sha = new Map()
async function get(path) {
  const r = await fetch(`${api}${path}?ref=${encodeURIComponent(branch)}`, { headers })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`GitHub read ${path}: ${r.status}`)
  const o = await r.json(); sha.set(path, o.sha)
  return JSON.parse(Buffer.from(o.content.replace(/\s/g, ''), 'base64').toString('utf8'))
}
let writes = Promise.resolve()
function publish(path, data) {
  const job = writes.then(async () => {
    if (!sha.has(path)) await get(path)
    const r = await fetch(`${api}${path}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ branch, message: `test evidence: ${path}`, content: Buffer.from(JSON.stringify(data, null, 2)+'\n').toString('base64'), ...(sha.has(path) ? { sha: sha.get(path) } : {}) }) })
    if (!r.ok) throw new Error(`GitHub write ${path}: ${r.status} ${(await r.text()).slice(0,300)}`)
    const o = await r.json(); sha.set(path, o.content.sha)
  })
  writes = job.catch(() => {})
  return job
}
const state = extra => publish('qa/live/state.json', { updated_at: new Date().toISOString(), ...extra })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/TOKEN|SECRET|PASSWORD|API_KEY|ACTIONS_RUNTIME/i.test(key)))
env.DSH_HOME = home
env.KUJIRA_TRIAL_KEY = 'synthetic-local-relay-no-credentials'
env.DSH_TOOLS_MODE = 'native'
env.PATH = `${resolve('payload/node-bin')}:${resolve('payload/runtime/node_modules/.bin')}:${env.PATH}`
const dsh = resolve('payload/runtime/node_modules/.bin/dsh')
function run(args, name) {
  return new Promise((resolveRun, reject) => {
    const p = spawn(dsh, args, { cwd: workspace, env })
    let out = '', err = ''
    p.stdout.on('data', b => { out += b.toString() })
    p.stderr.on('data', b => { err += b.toString() })
    p.on('error', reject)
    p.on('close', async code => {
      await writeFile(join(evidence, `${name}.stdout`), out)
      await writeFile(join(evidence, `${name}.stderr`), err)
      if (code !== 0) reject(new Error(`${name} exit ${code}: ${(err+'\n'+out).slice(-7000)}`))
      else resolveRun(out)
    })
  })
}
let browser, web, server, done = false, requestNumber = 0
const pending = new Map(), requests = [], replies = []
try {
  await state({ stage: 'installing', dsh: '0.2.1-rc.2', kujira: '1.6.1', model_backend: 'current-assistant-manual-relay', user_profile_changed: false })
  await run(['plugin','--profile','web','add',resolve('payload/releases/dsh-kujira-persona-1.6.1.tgz')], 'plugin-install')
  const models = ['deepseek-chat','gpt-4o','gpt-4.1','gemini-2.5-pro','claude-sonnet-4','private-model-v1'].map(id => ({ id, name: `${id} [TEST RELAY]`, contextWindow: 128000, maxTokens: 8192 }))
  const patch = [
    { id: 'llm-pi-ai', config: { providers: { 'trial-relay': { name: 'Current assistant · test relay', api: 'openai-completions', apiKeyEnv: 'KUJIRA_TRIAL_KEY', baseURL: 'http://127.0.0.1:18181/v1', models } } } },
    { id: 'agent-default-model', config: { provider: 'trial-relay', model: 'deepseek-chat' } },
    { id: 'session-title-llm', disabled: true }
  ]
  const patchPath = join(root, 'trial.patch.yml')
  await writeFile(patchPath, JSON.stringify(patch, null, 2))
  server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/v1/models') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ object:'list', data:models.map(m=>({id:m.id,object:'model',owned_by:'qa-relay'})) })); return }
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') { res.writeHead(404); res.end(); return }
      let raw = ''; for await (const b of req) raw += b.toString()
      const body = JSON.parse(raw)
      const id = String(++requestNumber).padStart(4,'0')
      const record = { id, received_at: new Date().toISOString(), body }
      requests.push(record)
      await writeFile(join(evidence, `request-${id}.json`), JSON.stringify(record,null,2))
      await publish(`qa/live/request-${id}.json`, record)
      await state({ stage:'awaiting_model_response', request_id:id, model:body.model, request_path:`qa/live/request-${id}.json`, tools:(body.tools??[]).map(t=>t.function?.name), messages:body.messages.length, reply_path:`qa/live/reply-${id}.json` })
      // The intermediary is QA-only. It waits for an actual assistant-authored reply.
      const response = await new Promise((yes,no) => pending.set(id,{yes,no}))
      replies.push({ id, response })
      await writeFile(join(evidence, `reply-${id}.json`), JSON.stringify(response,null,2))
      const calls = response.tool_calls?.map((c,i)=>({ index:i, id:c.id??`call_${id}_${i}`, type:'function', function:{ name:c.name, arguments:JSON.stringify(c.arguments??{}) } }))
      const finish = calls?.length ? 'tool_calls' : 'stop'
      if (body.stream) {
        res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', Connection:'keep-alive' })
        const chunk = (delta, finish_reason=null) => res.write(`data: ${JSON.stringify({id:`chatcmpl-qa-${id}`,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:body.model,choices:[{index:0,delta,finish_reason}]})}\n\n`)
        chunk({role:'assistant'})
        if (response.content) chunk({content:response.content})
        if (calls?.length) chunk({tool_calls:calls})
        chunk({},finish); res.end('data: [DONE]\n\n')
      } else {
        res.setHeader('Content-Type','application/json')
        res.end(JSON.stringify({id:`chatcmpl-qa-${id}`,object:'chat.completion',created:Math.floor(Date.now()/1000),model:body.model,choices:[{index:0,message:{role:'assistant',content:response.content??null,...(calls?.length?{tool_calls:calls.map(({index,...c})=>c)}:{})},finish_reason:finish}]}))
      }
    } catch(e) { if(!res.headersSent)res.writeHead(500);res.end(JSON.stringify({error:e.message})) }
  })
  await new Promise(r => server.listen(18181,'127.0.0.1',r))
  let log = ''
  web = spawn(dsh,['web','--no-open','--patch',patchPath],{cwd:workspace,env})
  web.stdout.on('data',b=>{log+=b.toString()})
  web.stderr.on('data',b=>{log+=b.toString()})
  let url
  for(let i=0;i<90;i++) {
    await sleep(1000)
    await writeFile(join(evidence,'web.log'),log)
    const matches = log.match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+[^\s\u001b]*/g)??[]
    url = matches.find(u=>u.includes('token=')) ?? matches.at(-1)
    if(url)break
    if(web.exitCode!==null)throw new Error(`Web startup exited ${web.exitCode}: ${log.slice(-7000)}`)
  }
  if(!url)throw new Error(`No Web URL: ${log.slice(-7000)}`)
  browser=await chromium.launch({headless:true,args:['--no-sandbox']})
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  const errors=[]
  page.on('pageerror', e=>errors.push(e.message))
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000})
  await page.waitForTimeout(2500)
  async function snapshot(id) {
    await page.screenshot({path:join(evidence,`${id}.png`),fullPage:true})
    return { url:page.url().replace(/([?&#]token=)[^&#]+/g,'$1[redacted]'), text:(await page.locator('body').innerText()).slice(0,18000), inputs:await page.locator('input,textarea,[contenteditable=true]').evaluateAll(ns=>ns.map(n=>({tag:n.tagName,placeholder:n.getAttribute('placeholder'),aria:n.getAttribute('aria-label'),role:n.getAttribute('role'),type:n.getAttribute('type')}))), buttons:await page.getByRole('button').evaluateAll(ns=>ns.map(n=>({text:n.textContent?.trim(),aria:n.getAttribute('aria-label'),title:n.getAttribute('title')}))).then(a=>a.slice(0,70)),pageErrors:errors }
  }
  await state({stage:'web_ready',snapshot:await snapshot('initial'),next_command:'qa/live/command-0001.json'})
  let commandId=1
  const deadline=Date.now()+30*60*1000
  while(!done&&Date.now()<deadline) {
    for(const [id,p] of pending) {
      const reply=await get(`qa/live/reply-${id}.json`)
      if(reply) {pending.delete(id);p.yes(reply)}
    }
    const id=String(commandId).padStart(4,'0')
    const command=await get(`qa/live/command-${id}.json`)
    if(command) {
      let result
      try {
        if(command.action==='stop'){done=true;result='stopped'}
        else {
          const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
          result=await new AsyncFunction('page','home','workspace','readFile','writeFile','readdir','join',command.code)(page,home,workspace,readFile,writeFile,readdir,join)
        }
        await page.waitForTimeout(800)
        const s=await snapshot(`command-${id}`)
        await publish(`qa/live/result-${id}.json`,{ok:true,result:result??null,snapshot:s,pending_requests:[...pending.keys()]})
      }catch(e){await publish(`qa/live/result-${id}.json`,{ok:false,error:e.message,snapshot:await snapshot(`command-${id}-error`)})}
      commandId++
    }
    await sleep(1500)
  }
  await state({stage:'finished',request_count:requests.length,reply_count:replies.length,commands:commandId-1,stopped_by_user_or_assistant:done})
} catch(error) {
  await state({stage:'error',error:error.stack})
  process.exitCode=1
} finally {
  for(const p of pending.values())p.no(new Error('Trial ended'))
  await browser?.close().catch(()=>{})
  if(web&&web.exitCode===null)web.kill('SIGTERM')
  server?.close()
  await writeFile(join(evidence,'summary.json'),JSON.stringify({requests:requests.map(r=>({id:r.id,model:r.body.model})),replies:replies.length,market_unchanged:true,user_profile_unchanged:true,backend:'manual assistant relay, not an independent provider inference run'},null,2))
}
