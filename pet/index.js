/** Optional companion. Persona editing and prompt assembly do not depend on it. */
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises'
import { dirname,join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STATS_KEYS } from './stats.js'
import { PetController } from './controller.js'
import { createUsageReader } from './usage.js'
import { NAMES } from './model.js'
import { NativePet } from './native.js'
import { artFor } from './art.js'
const HERE=dirname(fileURLToPath(import.meta.url))
export function applyPet(ctx,{catalog,home}){
  ctx.inject(['sessions','connection','webServer'],scope=>{
    const path=join(home,'kujira-pet.json'),assets=new Map(),streams=new Set()
    let closed=false,controller=null,native=null,rendererChoice='',offState=()=>{},offEvent=()=>{},offCatalog=()=>{}
    const ready=(async()=>{
      let config={}
      try{config=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')scope.logger?.warn?.('Kujira 桌宠设置暂时无法读取，保持关闭')}
      if(closed)return null
      controller=new PetController({config,resolvePersona:route=>catalog.resolve(route),queryUsage:createUsageReader(scope),readStats:(id,session)=>{
        const selected=session??scope.sessions.get(id)
        return selected?scope.get('sessionProjections')?.snapshot(selected,STATS_KEYS).values:undefined
      },persist:async value=>{
        await mkdir(home,{recursive:true});const temp=path+`.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(value,null,2)+'\n');await rename(temp,path)
      }})
      function nativeStatus(renderer,error){if(closed)return;if(controller.renderer!==renderer||controller.nativeError!==error){controller.renderer=renderer;controller.nativeError=error;controller.publish()}}
      native=new NativePet(HERE,nativeStatus,message=>{
        if(message.action==='close')void controller.configure({enabled:false})
        if(message.action==='refresh')void controller.refresh()
        if(message.action==='position')void controller.configure({desktopX:message.x,desktopY:message.y})
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
      offCatalog=catalog.subscribe(()=>{if(!closed)void controller.refreshPersona()})
      offEvent=ctx.on('session/event',(session,event)=>controller.event(session,event),{global:true})
      render(controller.snapshot());return controller
    })().catch(()=>{scope.logger?.warn?.('Kujira 桌宠未启动，人设功能继续可用');return null})
    const dispatch=async(endpoint,payload)=>{
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
    }
    for(const endpoint of ['state','config','select','refresh'])scope.connection.fetch.register({path:'/api/kujira-pet/'+endpoint,methods:['POST'],requestBody:'buffered',fetch:async request=>{
      let envelope;try{envelope=await request.json()}catch{return new Response('Expected JSON',{status:400})}
      if(envelope.type!=='client-request'||envelope.method!=='kujira-pet/'+endpoint||typeof envelope.rpcId!=='string')return new Response('Invalid request',{status:400})
      return Response.json({type:'server-response',rpcId:envelope.rpcId,result:await dispatch(endpoint,envelope.payload)})
    }})
    scope.connection.fetch.register({path:'/api/kujira-pet/events',methods:['GET'],requestBody:'buffered',fetch:async request=>{
      const c=await ready;if(!c)return new Response('unavailable',{status:503})
      let stream
      const body=new ReadableStream({start(s){stream=s;streams.add(s);s.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(c.snapshot())}\n\n`))},cancel(){streams.delete(stream)}})
      request.signal.addEventListener('abort',()=>{streams.delete(stream);try{stream.close()}catch{}},{once:true})
      return new Response(body,{headers:{'content-type':'text/event-stream','cache-control':'no-store'}})
    }})
    for(const file of ['animation.js','sprite-canvas.js'])scope.connection.fetch.register({path:'/api/kujira-pet/'+file,methods:['GET'],requestBody:'buffered',fetch:async()=>{
      if(!assets.has(file))assets.set(file,await readFile(join(HERE,file)))
      return new Response(assets.get(file),{headers:{'content-type':'text/javascript; charset=utf-8'}})
    }})
    scope.connection.fetch.register({path:'/api/kujira-pet/art',methods:['GET'],requestBody:'buffered',fetch:async request=>{
      const id=new URL(request.url).searchParams.get('id'),manifest=artFor(id)
      if(!manifest)return new Response('not found',{status:404})
      const urls=Object.fromEntries(Object.keys(manifest.sheets).map(sheet=>[sheet,'/api/kujira-pet/sprite?id='+encodeURIComponent(id)+'&sheet='+encodeURIComponent(sheet)+'&v='+manifest.revision]))
      return Response.json({manifest,urls})
    }})
    scope.connection.fetch.register({path:'/api/kujira-pet/sprite',methods:['GET'],requestBody:'buffered',fetch:async request=>{
      const query=new URL(request.url).searchParams,manifest=artFor(query.get('id')),file=manifest?.sheets[query.get('sheet')]
      if(typeof file!=='string')return new Response('not found',{status:404})
      try{
        if(!assets.has(file))assets.set(file,await readFile(join(HERE,'assets',file)))
        return new Response(assets.get(file),{headers:{'content-type':'image/png','cache-control':'private, max-age=86400'}})
      }catch{return new Response('not found',{status:404})}
    }})
    scope.connection.fetch.register({path:'/api/kujira-pet/image',methods:['GET'],requestBody:'buffered',fetch:async request=>{
      const id=new URL(request.url).searchParams.get('id')??'unknown'
      if(id!=='unknown'&&!Object.hasOwn(NAMES,id))return new Response('not found',{status:404})
      try{if(!assets.has(id))assets.set(id,await readFile(join(HERE,'assets',id+'.svg')));return new Response(assets.get(id),{headers:{'content-type':'image/svg+xml','cache-control':'private, max-age=86400'}})}catch{return new Response('not found',{status:404})}
    }})
    scope.on('dispose',()=>{closed=true;offEvent();offState();offCatalog();controller?.dispose();native?.dispose();for(const s of streams)try{s.close()}catch{};streams.clear();assets.clear()})
  })
}

