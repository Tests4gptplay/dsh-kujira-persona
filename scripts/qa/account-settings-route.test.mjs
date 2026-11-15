/** Real React DOM regression; set DSH_BROWSER_TEST_ROOT to a React/jsdom install. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {join} from 'node:path'
import {settings} from '../../pet/model.js'
import {createUsageReader} from '../../pet/usage.js'

const root=fileURLToPath(new URL('../../',import.meta.url))
const require=createRequire(join(process.env.DSH_BROWSER_TEST_ROOT??root,'package.json'))

test('account settings query the shared account without model controls and ignore old model results',async t=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://fixture.invalid'})
 const previous={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT}
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const React=require('react'),{createRoot}=require('react-dom/client'),{act}=React
 let reactRoot,Settings,boot,source,queryResolve,deferQuery=true
 const effects=[],calls=[],catalogListeners=new Set(),messages={},localeSnapshot={active:'zh'},noop=()=>()=>{}
 const groups=[{id:'openai',models:[{id:'gpt-4'},{id:'gpt-6.1-sol'},{id:'gpt-6.1-other'}]}]
 let state={config:settings({enabled:false,usageProfiles:{openai:{adapter:'openai',credentialRef:'SYNTHETIC_ADMIN'}},modelPrices:{'openai/gpt-4':{currency:'USD',input:99,output:99}}}),route:{provider:'openai',model:'gpt-6.1-sol',sessionId:'qa',name:'GPT'},task:{phase:'idle'},revision:1}
 const reader=createUsageReader({settings:{describe:()=>[{value:{providers:{openai:{baseURL:'https://api.openai.com'}}}}]}},{environment:{}})
 const result=lines=>({kind:'account',status:'ready',title:'OpenAI',lines,details:lines,metrics:[],windows:[],checkedAt:Date.UTC(2026,10,15)})
 const directory={store:{getSnapshot:()=>({groups}),subscribe:fn=>{catalogListeners.add(fn);return()=>catalogListeners.delete(fn)}},load:async()=>({groups})}
 const ctx={locale:{register:(ns,value)=>{messages[ns]=value;return()=>{}},bind:ns=>(key,args={})=>{let value=messages[ns]?.zh?.[key]??key;for(const[k,v]of Object.entries(args))value=value.replaceAll('{'+k+'}',v);return value},getSnapshot:()=>localeSnapshot,subscribe:noop},get:name=>name==='modelDirectories'?{directoryFor:()=>directory}:name==='remote.credentials'?{describe:async refs=>({ok:true,value:Object.fromEntries(refs.map(ref=>[ref,{configured:true,writable:true}]))})}:undefined,on:noop,inject:()=>{},effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')effects.push(cleanup)},slots:{inject:(_,fn)=>fn(),register:(spec,component)=>{if(spec.id==='kujira-persona')Settings=component}},connection:{rpc:{call:async(_,method,payload={})=>{
   calls.push({method,payload})
   let value
   if(method==='kujira-pet/usage-info')value=payload.routes?reader.describeMany(payload.routes,state.config):reader.describe(payload,state.config)
   else if(method==='kujira-pet/account-query')value=deferQuery?await new Promise(resolve=>{queryResolve=resolve}):result(['CURRENT_ACCOUNT_TOTAL'])
   else if(method==='kujira-pet/folders')value={characters:[],groups:[],totalBytes:0}
   else if(method==='kujira-pet/diary-settings')value={enabled:false,directory:'',sleepEnabled:false}
   else value=state
   return {ok:true,value}
 }}}}
 class EventSource {constructor(){source=this}close(){}}
 t.after(async()=>{await act(async()=>reactRoot?.unmount());for(const dispose of effects)dispose();dom.window.close();for(const[k,v]of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v})
 dom.window.__ModuleLoader__={load:definition=>{boot=definition.factory(name=>name==='react'?React:{}).apply(ctx)}}
 const code=(await readFile(join(root,'pet/client.js'),'utf8')).replaceAll(/(['"])\/api\/kujira-pet\/([^'"]+)\1/g,(_,quote,name)=>JSON.stringify(pathToFileURL(join(root,'pet',name)).href))
 new Function('window','document','EventSource',code)(dom.window,dom.window.document,EventSource)
 await boot
 const flush=async fn=>act(async()=>{fn?.();for(let i=0;i<30;i++)await Promise.resolve()})
 await flush(()=>{reactRoot=createRoot(dom.window.document.getElementById('root'));reactRoot.render(React.createElement(Settings))})
 const panel=()=>dom.window.document.querySelector('[data-kujira-account-settings]')
 const click=async label=>{const button=[...panel().querySelectorAll('button')].find(button=>button.textContent===label);assert(button);assert.equal(button.disabled,false);await flush(()=>button.click())}
 assert(panel())
 assert.equal(dom.window.document.querySelector('[data-kujira-model-pricing]'),null)
 assert(!panel().textContent.includes('gpt-4'))
 assert(!panel().textContent.includes('当前接入／模型'))
 assert(panel().textContent.includes('不按对话模型筛选'))
 assert.equal(panel().querySelector('a[href="https://platform.openai.com/settings/organization/billing/overview"]').textContent,'查看 OpenAI 官方余额与账单')
 assert.equal(calls.filter(call=>Array.isArray(call.payload.routes)).length,1)
 assert.equal(calls.find(call=>Array.isArray(call.payload.routes)).payload.routes[0].model,'gpt-6.1-sol')
 await flush(()=>{for(const fn of catalogListeners)fn()})
 assert.equal(calls.filter(call=>Array.isArray(call.payload.routes)).length,1,'unchanged catalog must not trigger another batch')
 const edit=async(input,value)=>flush(()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})
 await edit(panel().querySelector('input[aria-label="项目 ID"]'),'proj_unsaved')
 await edit(panel().querySelector('input[type=password]'),'synthetic-unsaved-draft')
 await click('查询账户信息')
 panel().querySelector('details').open=false
 assert.equal(calls.find(call=>call.method==='kujira-pet/account-query').payload.model,'gpt-6.1-sol')
 state={...state,route:{...state.route,model:'gpt-6.1-other'},revision:2}
 await flush(()=>source.onmessage({data:JSON.stringify(state)}))
 await flush(()=>queryResolve(result(['STALE_OLD_MODEL'])))
 assert(!panel().textContent.includes('STALE_OLD_MODEL'))
 assert.equal(panel().querySelector('input[aria-label="项目 ID"]').value,'proj_unsaved')
 assert.equal(panel().querySelector('input[type=password]').value,'synthetic-unsaved-draft')
 assert.equal(panel().querySelector('details').open,false,'model changes preserve the account details disclosure')
 assert.equal(calls.filter(call=>call.method==='kujira-pet/usage-info'&&!call.payload.routes).at(-1).payload.model,'gpt-6.1-other')
 deferQuery=false
 await click('查询账户信息')
 assert.equal(calls.filter(call=>call.method==='kujira-pet/account-query').at(-1).payload.model,'gpt-6.1-other')
 assert(panel().textContent.includes('CURRENT_ACCOUNT_TOTAL'))
 assert(panel().textContent.includes('查询时间：'))
 assert.equal(state.config.modelPrices['openai/gpt-4'].input,99,'retired editor must preserve saved legacy prices')
})
