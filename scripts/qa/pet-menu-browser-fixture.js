// Offline QA host only; product Menu and React are imported unchanged.
import * as React from 'react'
import {createRoot} from 'react-dom/client'
import {Menu} from '@deepseek-ai/dsh-client-ui-primitives'
import {settings} from '../../pet/model.js'
const slots=new Map(),events=new Map(),calls=[]
let source,state={config:settings({enabled:true,display:'page',showUsage:false,showStats:false}),renderer:'page',route:{name:'GPT',persona:'gpt',art:'gpt',sessionId:'qa'},task:{phase:'working',text:'正在处理当前会话'},revision:1}
window.EventSource=class {constructor(){source=this}close(){}}
const publish=()=>source?.onmessage?.({data:JSON.stringify(state)})
const patch=config=>{state={...state,config:settings({...state.config,...config}),revision:state.revision+1};publish()}
const on=(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);return()=>events.get(name).delete(fn)}
const ctx={on,slots:{inject:(_name,fn)=>fn(),register:(spec,component)=>{slots.set(spec.id,component);if(spec.id==='kujira-one-pet')createRoot(document.getElementById('root')).render(React.createElement(component))}},inject:(_deps,fn)=>fn(ctx),uiSession:{adapter:{current:{getSnapshot:()=>({key:'qa'}),subscribe:()=>()=>{}}}},modelDirectories:{directoryFor:()=>null},connection:{rpc:{call:async(_api,method,payload)=>{calls.push({method,payload});if(method==='kujira-pet/config')patch(payload);return {ok:true,value:state}}}}}
window.__ModuleLoader__={load:definition=>definition.factory(name=>{if(name==='react')return React;if(name==='@deepseek-ai/dsh-client-ui-primitives')return {Menu};throw Error('Unexpected module '+name)}).apply(ctx)}
window.QA={patch,get state(){return state},calls,task:(phase,text='当前会话文本')=>{state={...state,task:{phase,text},revision:state.revision+1};publish()},theme:dark=>{document.body.dataset.theme=dark?'dark':'light';for(const fn of events.get('theme/change')??[])fn({})},reconnect:()=>{source.onopen?.();publish()}}
