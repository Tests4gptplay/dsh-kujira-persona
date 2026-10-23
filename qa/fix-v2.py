from pathlib import Path
p=Path('qa/pet-source/index.js');s=p.read_text();start=s.index("    scope.connection.rpc.handle(");end=s.index("    scope.connection.fetch.register({path:'/api/kujira-pet/events'",start)
s=s[:start]+'''    const dispatch=async(endpoint,payload)=>{
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
''' + s[end:];p.write_text(s)
p=Path('qa/pet-source/client.js');s=p.read_text().replace("rpc.call('/kujira-pet',endpoint,payload)","rpc.call('/api','kujira-pet/'+endpoint,payload)")
s=s.replace("function RouteBinder({directory,sessionId}){", "function RouteBinder({getDirectory,sessionId}){const pet=usePet();return pet?.config.enabled?h(ModelFollower,{directory:getDirectory(),sessionId}):null}\n    function ModelFollower({directory,sessionId}){")
s=s.replace("inject:['slots','connection']", "inject:['slots','connection','sessions','remote','remote.session']")
s=s.replace("ctx.inject(['modelDirectories','sessions']", "ctx.inject(['modelDirectories','sessions','remote','remote.session']")
s=s.replace("sessionId,directory:scope.modelDirectories.directoryFor(sessionId)","sessionId,getDirectory:()=>scope.modelDirectories.directoryFor(sessionId)")
p.write_text(s)
p=Path('qa/pet-source/usage.js');s=p.read_text().replace("let provider=declared?forms.find(f=>f.ns===declared.settingsNs)?.value:null", "let provider=declared?forms.find(f=>f.ns===declared.settingsNs)?.value:null\n    for(const segment of declared?.settingsPath??[])provider=provider?.[segment]");p.write_text(s)
p=Path('qa/pet-source/controller.js');s=p.read_text().replace('fn(state)}catch{}}return state','fn(state)}catch{}}return this.snapshot()');p.write_text(s)
p=Path('qa/ui-test.mjs');s=p.read_text().replace("fetch('/kujira-pet/'+method", "fetch('/api/kujira-pet/'+method").replace("rpcId:'qa-'+Date.now(),method,payload", "rpcId:'qa-'+Date.now(),method:'kujira-pet/'+method,payload");p.write_text(s)
p=Path('qa/KujiraPet.cs');s=p.read_text().replace('image.Height=image.Width*380/320;', 'image.Height=image.Width*380/320; double right=Left+Width,bottom=Top+Height; Width=Math.Max(290,image.Width+20);Height=Math.Max(540,image.Height+180);if(initialized){Left=right-Width;Top=bottom-Height;}');p.write_text(s)
