/** Configuration menu: only existing endpoint profiles with extra setup.
 * Ordinary inference-key queries and Host account integrations stay automatic.
 */
export function accountConfigurationOptions(infos=[]) {
  const result=[]
  for(const info of infos){
    if(!info||info.hostAccount||!info.provider||!info.model)continue
    for(const adapter of info.adapters??[]){
      if(!adapter.available||adapter.auth==='host'||adapter.configurationSupported===false)continue
      if(adapter.auth==='inference'&&!adapter.thirdParty)continue
      if(adapter.thirdParty&&info.profile?.adapter!==adapter.id)continue
      result.push({key:JSON.stringify([info.provider,info.model,adapter.id]),provider:info.provider,model:info.model,origin:info.origin,adapter:adapter.id,label:adapter.label,auth:adapter.auth,thirdParty:adapter.thirdParty===true,docsUrl:adapter.docsUrl})
    }
  }
  return result
}
