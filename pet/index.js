/** Optional companion. Persona editing and prompt assembly do not depend on it. */
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises'
import { dirname,join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STATS_KEYS } from './stats.js'
import { PetController } from './controller.js'
import { createUsageReader } from './usage.js'
import { NativePet } from './native.js'
import { artFor } from './art.js'
import { createFolderBrowser } from './folders.js'
const HERE=dirname(fileURLToPath(import.meta.url))
export async function applyNativeAction(controller,message){
  try{
    if(message.action==='close')await controller.configure({enabled:false})
    else if(message.action==='toggle-pet')await controller.configure({showPet:!controller.config.showPet})
    else if(message.action==='toggle-bubble')await controller.configure({bubble:controller.config.bubble==='hidden'?controller.config.bubbleBeforeHidden:'hidden'})
    else if(message.action==='refresh')await controller.refresh()
    else if(message.action==='position')await controller.configure({desktopX:message.x,desktopY:message.y})
    else return
    if(controller.nativeError){controller.nativeError='';controller.publish()}
  }catch(error){
    controller.nativeError=error?.code==='kujira-config-save'?error.message:'桌宠操作未能完成，请查看 DSH 日志。'
    controller.publish()
  }
}
export function applyPet(ctx,{catalog,home,folders={worldDir:join(home,'world'),personasDir:join(home,'personas')},ensureFolder,ensureSeeded,diary,sleep}){
  ctx.inject(['sessions','agents','sessionQuery','connection','webServer'],scope=>{
    const path=join(home,'kujira-pet.json'),assets=new Map(),streams=new Set()
    const folderBrowser=createFolderBrowser({...folders,catalog,ensureFolder,ensureSeeded})
    let closed=false,controller=null,native=null,rendererChoice='',menuTheme=null,offState=()=>{},offEvent=()=>{},offAssistant=()=>{},offStatus=()=>{},offSession=()=>{},offCatalog=()=>{}
    const ready=(async()=>{
      let config={}
      try{config=JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code!=='ENOENT')scope.logger?.warn?.('Kujira 桌宠设置暂时无法读取，保持关闭')}
      if(closed)return null
      controller=new PetController({config,resolvePersona:route=>catalog.resolve(route),queryUsage:createUsageReader(scope),readSession:async(id,afterSeq)=>{
        const query=scope.get('sessionQuery')
        const observation=await query.observeSession(id)
        try{return {header:observation.header,events:afterSeq===observation.cursor?[]:observation.events.slice(afterSeq===undefined||afterSeq>observation.cursor?observation.inheritedEventCount:afterSeq+1),inheritedEventCount:observation.inheritedEventCount,cursor:observation.cursor,projections:observation.projections,running:scope.get('agents')?.get(id)?.status==='running'}}
        finally{observation[Symbol.dispose]()}
      },readStats:(id,session)=>{
        const selected=session??scope.sessions.get(id)
        return selected?scope.get('sessionProjections')?.snapshot(selected,STATS_KEYS).values:undefined
      },persist:async value=>{
        await mkdir(home,{recursive:true});const temp=path+`.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(value,null,2)+'\n');await rename(temp,path)
      }})
      function nativeStatus(renderer,error){if(closed)return;if(controller.renderer!==renderer||controller.nativeError!==error){controller.renderer=renderer;controller.nativeError=error;controller.publish()}}
      // A retired native child can exit after the page renderer is selected.
      // Its status belongs to desktop mode, not the currently selected surface.
      native=new NativePet(HERE,(renderer,error)=>{if(rendererChoice==='desktop')nativeStatus(renderer,error)},message=>{void applyNativeAction(controller,message)})
      function render(state){
        const target=!state.config.enabled?'none':state.config.display==='page'?'page':process.platform==='win32'?'desktop':state.config.display==='desktop'?'unsupported':'page'
        if(target!==rendererChoice){rendererChoice=target
          if(target!=='desktop')native.hide()
          if(target==='desktop')void native.show({...state,menuTheme})
          else nativeStatus(target==='page'?'page':'none',target==='unsupported'?'当前系统没有原生桌宠，选择页面内显示即可':'')
        }else if(target==='desktop')native.send({...state,menuTheme})
      }
      offState=controller.subscribe(state=>{
        render(state)
        const bytes=new TextEncoder().encode(`data: ${JSON.stringify(controller.snapshot())}\n\n`)
        for(const stream of streams)try{stream.enqueue(bytes)}catch{streams.delete(stream)}
      })
      offCatalog=catalog.subscribe(()=>{if(!closed)void controller.refreshPersona()})
      offEvent=ctx.on('session/event',(session,event)=>controller.event(session,event),{global:true})
      offSession=ctx.on('session/disposed',session=>controller.forgetSession(session),{global:true})
      offStatus=ctx.on('agent/status',event=>controller.status(event),{global:true})
      offAssistant=ctx.on('agent/assistant-stream',event=>controller.assistantFrame(event),{global:true})
      render(controller.snapshot());return controller
    })().catch(()=>{scope.logger?.warn?.('Kujira 桌宠未启动，人设功能继续可用');return null})
    const endPointError=(endpoint,e)=>endpoint.startsWith('diary-')?(e?.message??'未能完成日记设置，请重试'):endpoint==='config'&&e?.code==='kujira-config-save'?e.message:endpoint==='open-folder'?'无法打开文件夹：'+(e?.message??'请检查文件管理器与访问权限'):endpoint==='folders'?'读取文件夹大小失败：'+(e?.message??'请检查目录权限'):'未能完成这次设置，请重试'
    const dispatch=async(endpoint,payload)=>{
      try{
        if(endpoint.startsWith('diary-')){
          if(closed||!diary)throw new Error('日记设置暂不可用，请重试')
          let value
          switch(endpoint){
            case 'diary-settings':value={...await diary.getSettings(),sleepStatus:sleep?.snapshot()};break
            case 'diary-config':value={...await diary.configure(payload??{}),sleepStatus:sleep?.snapshot()};break
            case 'diary-front':value=await sleep?.select(payload??{});break
            case 'diary-open-folder':value=await diary.openFolder();break
            default:throw new Error('未知日记操作')
          }
          return {ok:true,value}
        }
        const c=await ready;if(!c||closed)return {ok:false,error:{code:'kujira-pet',message:'桌宠设置暂不可用',details:{issues:[]}}}
        let value
        switch(endpoint){
          case 'state':value=c.snapshot();break
          case 'menu-theme':
            if(['background','foreground','border','hover','hoverForeground'].every(key=>/^#[0-9a-f]{6}$/i.test(payload?.[key]??''))){menuTheme=Object.fromEntries(['background','foreground','border','hover','hoverForeground'].map(key=>[key,payload[key]]));if(payload.geometry&&typeof payload.geometry==='object')menuTheme.geometry=Object.fromEntries(['surfaceRadius','surfacePadding','surfaceBorderWidth','surfaceMinWidth','itemRadius','itemPadding','itemMinHeight','fontFamily','fontSize','fontWeight','lineHeight'].map(key=>[key,payload.geometry[key]]));if(rendererChoice==='desktop')native.send({...c.snapshot(),menuTheme})}
            value=c.snapshot();break
          case 'config':value=await c.configure(payload??{});break
          case 'select':value=await c.select(payload??{});break
          case 'refresh':value=await c.refresh();break
          case 'folders':value=await folderBrowser.list();break
          case 'open-folder':value=await folderBrowser.open(payload?.id);break
          default:throw new Error('未知操作')
        }
        return {ok:true,value}
      }catch(e){return {ok:false,error:{code:e?.code==='kujira-config-save'?'kujira-config-save':'kujira-pet',message:endPointError(endpoint,e),details:{issues:[]}}}}
    }
    for(const endpoint of ['state','config','select','refresh','folders','open-folder','menu-theme','diary-settings','diary-config','diary-open-folder','diary-front'])scope.connection.fetch.register({path:'/api/kujira-pet/'+endpoint,methods:['POST'],requestBody:'buffered',fetch:async request=>{
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
    scope.effect(()=>()=>{closed=true;offEvent();offAssistant();offStatus();offSession();offState();offCatalog();controller?.dispose();const stopped=native?.dispose();for(const s of streams)try{s.close()}catch{};streams.clear();assets.clear();return stopped})
  })
}

