// Offline synthetic Host bridge; renders the unchanged product Settings component.
import * as React from 'react'
import {createRoot} from 'react-dom/client'
const messages={},localeSnapshot={active:'zh'},noop=()=>()=>{}
const locale={register:(ns,m)=>{messages[ns]=m;return()=>{}},bind:ns=>(key,args={})=>{let s=messages[ns]?.zh?.[key]??key;for(const [k,v] of Object.entries(args))s=s.replaceAll('{'+k+'}',v);return s},getSnapshot:()=>localeSnapshot,subscribe:noop}
const rpc=async(method,payload={})=>{const r=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,payload})});return r.json()}
const models={deepseek:'deepseek-test',openai:'gpt-test',qwen:'qwen-test',anthropic:'claude-test',ark:'doubao-test'}
const groups=['deepseek','openai','qwen','anthropic','ark'].map(id=>({id,name:id,models:[{id:models[id],name:id+' test model'}]}))
const snap={groups,current:{provider:'deepseek',model:'deepseek-test'},status:'ready',routable:true}
const directories={directoryFor:()=>({store:{getSnapshot:()=>snap,subscribe:noop},load:async()=>snap,select:()=>{throw Error('Configuration picker must not select conversation model')}})}
const credentials={describe:refs=>rpc('credentials.describe',{refs}),set:(ref,value)=>rpc('credentials.set',{ref,value})}
let root,component
const mount=()=>{root?.unmount();root=createRoot(document.getElementById('root'));root.render(React.createElement(component))}
window.EventSource=class{close(){}}
const ctx={locale,get:name=>name==='remote.credentials'?credentials:name==='modelDirectories'?directories:undefined,on:noop,effect:fn=>fn(),inject:()=>{},slots:{inject:(_,fn)=>fn(),register:(spec,C)=>{if(spec.id==='kujira-persona'){component=C;mount()}}},connection:{rpc:{call:(_,method,payload)=>rpc(method,payload)}}}
window.__ModuleLoader__={load:definition=>definition.factory(name=>{if(name==='react')return React;if(name==='@deepseek-ai/dsh-client-ui-primitives')return {Menu:()=>null,MenuSurface:()=>null,MenuItemButton:()=>null};throw Error(name)}).apply(ctx)}
window.QA={remount:mount}
