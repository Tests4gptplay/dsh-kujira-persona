import * as React from 'react'
import {createRoot} from 'react-dom/client'
import {Context} from '@deepseek-ai/cordis'
import {Menu,MenuSurface,MenuItemButton} from '@deepseek-ai/dsh-client-ui-primitives'
import {settings} from '../../pet/model.js'
const ctx=new Context(),calls=[],roots=new Map();let source,fiber,definition
let state={config:settings({enabled:true,display:'page',showUsage:false,showStats:false}),renderer:'page',route:{name:'QA',persona:'gpt',art:'gpt',sessionId:'qa'},task:{phase:'working',text:'菜单功能检查'},revision:1}
window.EventSource=class{constructor(){source=this;this.closed=false}close(){this.closed=true}}
const publish=()=>source?.onmessage?.({data:JSON.stringify(state)})
const patch=config=>{state={...state,config:settings({...state.config,...config}),revision:state.revision+1};publish()}
ctx.provide('connection',{rpc:{call:async(_api,method,payload)=>{calls.push({method,payload});if(method==='kujira-pet/config')patch(payload);return{ok:true,value:state}}}})
ctx.provide('theme',{getTheme:()=>({})})
const mount=()=>{fiber=ctx.plugin({name:'actual-kujira-client-lifecycle',apply(scope){
 scope.provide('slots',{inject:(_name,fn)=>fn(),register:(spec,component)=>{
  if(spec.name!=='shell.overlay')return
  scope.effect(()=>{const node=document.createElement('div');document.body.appendChild(node);const root=createRoot(node);root.render(React.createElement(component));roots.set(spec.id,{root,node});return()=>{root.unmount();node.remove();roots.delete(spec.id)}})
 }})
 definition.apply(scope)
}});return Promise.resolve(fiber)}
window.__ModuleLoader__={load:entry=>{definition=entry.factory(name=>{if(name==='react')return React;if(name==='@deepseek-ai/dsh-client-ui-primitives')return{Menu,MenuSurface,MenuItemButton};throw Error(name)});void mount()}}
window.QA={calls,patch,ctx,get state(){return state},get closed(){return source?.closed},theme:()=>ctx.emit('theme/change',{}),unmount:()=>fiber.dispose(),mount}
