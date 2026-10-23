/** Optional companion. Persona editing and prompt assembly do not depend on it. */
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises'
import { dirname,join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PetController } from './controller.js'
import { createUsageReader } from './usage.js'
import { NAMES } from './model.js'
import { NativePet } from './native.js'
const HERE=dirname(fileURLToPath(import.meta.url))
export function applyPet(ctx,{catalog,home}){
  ctx.inject(['sessions','connection'],scope=>{
    const path=join(home,'kujira-pet.json'),assets=new Map(),streams=new Set()
    let closed=false,controller=null,native=null,rendererChoice='',offState=()=>{},offEvent=()=>{}
    const ready=(async()=>{
      let config={}
      try{config=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')scope.logger?.warn?.('Kujira 桌宠设置暂时无法读取，保持关闭')}
      if(closed)return null
      controller=new PetController({config,resolvePersona:route=>catalog.resolve(route),queryUsage:createUsageReader(scope),persist:async value=>{
        await mkdir(home,{recursive:true});const temp=path+`.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(value,null,2)+'\n');await rename(temp,path)
      }})
      function nativeStatus(renderer,error){if(closed)return;if(controller.renderer!==renderer||controller.nativeError!==error){controller.renderer=renderer;controller.nativeError=error;controller.publish()}}
      native=new NativePet(HERE,nativeStatus,message=>{
        if(message.action==='close')void controller.configure({enabled:false})
        if(message.action==='refresh')void controller.refresh()
      })
      function render(state){
        const target=!state.config.enabled?'none':state.config.display==='page'?'page':process.platform==='win32'?'desktop':state.config.display==='desktop'?'unsupported':'page'
        if(target!==rendererChoice){rendererChoice=target
          if(target!=='desktop')native.hide()
          if(target==='desktop')void native.show(state)
          else nativeStatus(target==='page'?'page':'none',target==='unsupported'?'当前系统没有原生桌宠，选择页面内显示即可':'')
        }else if(target==='desktop')native.send(state)
      }
      offState=controller.subscribe(state=>{
        render(state)
        const bytes=new TextEncoder().encode(`data: ${JSON.stringify(controller.snapshot())}\n\n`)
        for(const stream of streams)try{stream.enqueue(bytes)}catch{streams.delete(stream)}
      })
      offEvent=ctx.on('session/event',(session,event)=>controller.event(session,event),{global:true})
      render(controller.snapshot());return controller
    })().catch(()=>{scope.logger?.warn?.('Kujira 桌宠未启动，人设功能继续可用');return null})
    scope.connection.rpc.handle('/kujira-pet',async(endpoint,payload,_signal,peer)=>{
      if(peer?.principal?.kind!=='owner')return {ok:false,error:{code:'kujira-pet',message:'需要当前 DSH 用户',details:{issues:[]}}}
      const c=await ready;if(!c||closed)return {ok:false,error:{code:'kujira-pet',message:'桌宠设置暂不可用',details:{issues:[]}}}
      try{
        let value
        switch(endpoint){
          case 'state':value=c.snapshot();break
          case 'config':value=await c.configure(payload??{});break
          case 'select':value=await c.select(payload??{});break
          case 'refresh':value=await c.refresh();break
          default:throw new Error('未知操作')
        }
        return {ok:true,value}
      }catch{return {ok:false,error:{code:'kujira-pet',message:'未能完成这次设置，请重试',details:{issues:[]}}}}
    })
    scope.connection.fetch.register({path:'/api/kujira-pet/events',methods:['GET'],requestBody:'buffered',fetch:async request=>{
      const c=await ready;if(!c)return new Response('unavailable',{status:503})
      let stream
      const body=new ReadableStream({start(s){stream=s;streams.add(s);s.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(c.snapshot())}\n\n`))},cancel(){streams.delete(stream)}})
      request.signal.addEventListener('abort',()=>{streams.delete(stream);try{stream.close()}catch{}},{once:true})
      return new Response(body,{headers:{'content-type':'text/event-stream','cache-control':'no-store'}})
    }})
    scope.connection.fetch.register({path:'/api/kujira-pet/image',methods:['GET'],requestBody:'buffered',fetch:async request=>{
      const id=new URL(request.url).searchParams.get('id')??'unknown'
      if(id!=='unknown'&&!Object.hasOwn(NAMES,id))return new Response('not found',{status:404})
      try{if(!assets.has(id))assets.set(id,await readFile(join(HERE,'assets',id+'.svg')));return new Response(assets.get(id),{headers:{'content-type':'image/svg+xml','cache-control':'private, max-age=86400'}})}catch{return new Response('not found',{status:404})}
    }})
    scope.on('dispose',()=>{closed=true;offEvent();offState();controller?.dispose();native?.dispose();for(const s of streams)try{s.close()}catch{};streams.clear();assets.clear()})
  })
}
