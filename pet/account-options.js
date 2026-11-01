/** Configuration menu: only existing endpoint profiles with extra setup.
 * Ordinary inference-key queries and Host account integrations stay automatic.
 */
export function accountConfigurationOptions(infos=[]) {
  const result=[],seen=new Set()
  for(const info of infos){
    if(!info||info.hostAccount||!info.provider||!info.model)continue
    for(const adapter of info.adapters??[]){
      if(!adapter.available||adapter.auth==='host'||adapter.configurationSupported===false)continue
      if(adapter.auth==='inference'&&!adapter.thirdParty)continue
      if(adapter.thirdParty&&info.profile?.adapter!==adapter.id)continue
      const key=JSON.stringify([info.profileKey??info.provider,adapter.id]);if(seen.has(key))continue;seen.add(key)
      result.push({key,provider:info.provider,model:info.model,origin:info.origin,endpoint:info.endpoint??info.origin,credentialRef:info.inferenceCredentialRef??null,adapter:adapter.id,label:adapter.label,auth:adapter.auth,thirdParty:adapter.thirdParty===true,docsUrl:adapter.docsUrl})
    }
  }
  const labels=new Map()
  for(const option of result){const label=JSON.stringify([option.label,option.auth,option.thirdParty,option.provider]);labels.set(label,(labels.get(label)??0)+1)}
  for(const option of result){const label=JSON.stringify([option.label,option.auth,option.thirdParty,option.provider]);if(labels.get(label)>1)option.detail=[option.endpoint,option.credentialRef].filter(Boolean).join(' · ')}
  const remaining=new Map()
  for(const option of result){const label=JSON.stringify([option.label,option.auth,option.thirdParty,option.provider,option.detail]);if(!remaining.has(label))remaining.set(label,[]);remaining.get(label).push(option)}
  // Only still-indistinguishable labels receive an ordinal; routing keys stay intact.
  for(const group of remaining.values())if(group.length>1)group.slice().sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).forEach((option,index)=>{option.connectionNumber=index+1})
  return result
}
