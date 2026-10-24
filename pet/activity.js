/**
 * Activity classification adapted from QCYTSN/dsh-dafeiyu (MIT, 2026 QCYTSN).
 * See dsh-dafeiyu-LICENSE.txt. Tool names only; never inspect arguments or output.
 */
export function toolActivity(name) {
  const tokens=String(name||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean)
  const has=(...names)=>tokens.some(token=>names.includes(token))
  if(has('stdin'))return 'commanding'
  if(has('search','grep','find','glob','web','read','fetch','open','list'))return 'searching'
  if(has('test','check','lint','build','verify'))return 'testing'
  if(has('write','edit','patch','replace','create','move','delete','update'))return 'editing'
  if(has('shell','bash','exec','execute','command','terminal','powershell','pwsh'))return 'commanding'
  return 'using-tool'
}
export function toolCallIdOf(event) {
  const data=event?.data??{},message=data.message??{},content=message.content
  const item=Array.isArray(content)?content.find(value=>value?.toolCallId):null
  return String(message.source?.callId??item?.toolCallId??message.toolCallId??message.callId??data.callId??'')
}
export function isUserQuestionTool(name) {
  const tokens=String(name||'').toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean)
  const asks=new Set(['ask','asking','request','requests','requesting','require','requires','prompt','needs','need','seek','seeks','get','gets'])
  const filler=new Set(['for','from','the','a','an']),users=new Set(['user','human','me'])
  const nouns=new Set(['question','questions','input','answer','answers','decision','decisions','confirmation','approval','permission','authorization','authorisation','consent','clarify','clarification','help'])
  return tokens.some((token,index)=>{
    if(users.has(token)&&nouns.has(tokens[index+1]))return true
    if(nouns.has(token)&&tokens[index+1]==='from'&&users.has(tokens[index+2]))return true
    if(['authorize','authorise','consent'].includes(token))return true
    if(token==='exit'&&tokens[index+1]==='plan'&&tokens[index+2]==='mode')return true
    if(!asks.has(token))return false
    let cursor=index+1
    while(cursor<tokens.length&&(filler.has(tokens[cursor])||users.has(tokens[cursor]))){
      if(users.has(tokens[cursor]))return !tokens[cursor+1]||nouns.has(tokens[cursor+1])
      cursor++
    }
    return nouns.has(tokens[cursor])
  })
}

