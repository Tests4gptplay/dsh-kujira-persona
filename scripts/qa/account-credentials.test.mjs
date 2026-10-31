import test from 'node:test'
import assert from 'node:assert/strict'
const {makeQueryCredentialRef,describeQueryCredentials,saveQueryCredential}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/account-credentials.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/account-credentials.js',import.meta.url))

const args={provider:'openai',adapter:'openai',field:'credentialRef',value:'synthetic-query-secret'}
const ref=makeQueryCredentialRef(args.provider,args.adapter,args.field)
function fixture(overrides={}) {
  let configured=false
  const calls=[]
  return {calls,service:{
    async describe(refs){calls.push(['describe',refs]);return {ok:true,value:Object.fromEntries(refs.map(r=>[r,{configured,writable:true,source:configured?'store':'none'}]))}},
    async set(r,v){calls.push(['set',r,v]);configured=true;return {ok:true,value:undefined}},
    ...overrides,
  }}
}
test('stable, bounded, field-specific identifiers do not collapse sanitized names',()=>{
  assert.match(ref,/^KUJIRA_QUERY_[A-Z0-9_]+_CREDENTIAL_KEY$/)
  assert.equal(ref,makeQueryCredentialRef('openai','openai'))
  assert.notEqual(makeQueryCredentialRef('foo-bar','x'),makeQueryCredentialRef('foo_bar','x'))
  assert.notEqual(ref,makeQueryCredentialRef('openai','openai','secretRef'))
  assert.notEqual(ref,makeQueryCredentialRef('openai','openai','sessionTokenRef'))
  assert.ok(makeQueryCredentialRef('a'.repeat(512),'b'.repeat(512)).length<=110)
  for(const bad of ['',null,{},'x\n','a'.repeat(513)]) assert.equal(makeQueryCredentialRef(bad,'openai'),null)
  assert.equal(makeQueryCredentialRef('x','y','__proto__'),null)
})
test('describe allows custom refs but returns only safe metadata',async()=>{
  const x=fixture({describe:async refs=>({ok:true,value:{[refs[0]]:{configured:true,writable:false,source:'SENSITIVE-SOURCE',value:args.value,error:args.value},OTHER:{value:args.value}}})})
  const result=await describeQueryCredentials(x.service,['CUSTOM_EXISTING_REF','CUSTOM_EXISTING_REF'])
  assert.equal(result.ok,true)
  assert.deepEqual(Object.keys(result.value),['CUSTOM_EXISTING_REF'])
  assert.deepEqual(result.value.CUSTOM_EXISTING_REF,{configured:true,writable:false,source:'unknown'})
  assert.ok(!JSON.stringify(result).includes(args.value))
})
test('missing or old Host and malformed metadata fail closed',async()=>{
  assert.deepEqual(await describeQueryCredentials(null,[ref]),{ok:false,error:'unavailable'})
  for(const response of [null,{ok:false,error:args.value},{ok:true,value:{}},{ok:true,value:{[ref]:{configured:'yes',writable:true,source:'store'}}},{ok:true,value:{[ref]:{configured:true}}}]){
    assert.deepEqual(await describeQueryCredentials({describe:async()=>response},[ref]),{ok:false,error:'unavailable'})
  }
  assert.deepEqual(await describeQueryCredentials({describe:async()=>{throw Error(args.value)}},[ref]),{ok:false,error:'unavailable'})
})
test('optional source is neither read nor forwarded',async()=>{
  const item={configured:false,writable:true,get source(){throw Error(args.value)}}
  const result=await describeQueryCredentials({describe:async()=>({ok:true,value:{[ref]:item}})},[ref])
  assert.equal(result.ok,true)
  assert.deepEqual(result.value[ref],{configured:false,writable:true,source:'unknown'})
})
test('invalid reference arrays never call Host',async()=>{
  const x=fixture()
  for(const refs of [null,'A',['bad-ref'],[''],Array(33).fill('OK')]) assert.deepEqual(await describeQueryCredentials(x.service,refs),{ok:false,error:'invalid-input'})
  assert.equal(x.calls.length,0)
})
test('successful write uses describe/set/describe and returns no secret',async()=>{
  const x=fixture(), result=await saveQueryCredential(x.service,args)
  assert.deepEqual(x.calls.map(x=>x[0]),['describe','set','describe'])
  assert.deepEqual(x.calls[1],['set',ref,args.value])
  assert.deepEqual(result,{ok:true,ref,metadata:{configured:true,writable:true,source:'unknown'}})
  assert.ok(!JSON.stringify(result).includes(args.value))
})
test('model and foreign references cannot be overwritten',async()=>{
  const x=fixture()
  assert.deepEqual(await saveQueryCredential(x.service,{...args,ref:'OPENAI_API_KEY',protectedRefs:['OPENAI_API_KEY']}),{ok:false,error:'protected-ref'})
  assert.deepEqual(await saveQueryCredential(x.service,{...args,protectedRefs:[ref.toLowerCase()]}),{ok:false,error:'protected-ref'})
  for(const foreign of ['CUSTOM_EXISTING_REF','KUJIRA_QUERY_SOMEONE_ELSE_KEY',makeQueryCredentialRef('other','openai')]) assert.deepEqual(await saveQueryCredential(x.service,{...args,ref:foreign}),{ok:false,error:'foreign-ref'})
  assert.equal(x.calls.length,0)
})
test('empty/invalid values and options never call Host',async()=>{
  const x=fixture()
  for(const value of ['', '  ', null,{},'x\ny','x\ry','x\0y','a'.repeat(32769)]) assert.deepEqual(await saveQueryCredential(x.service,{...args,value}),{ok:false,error:'invalid-input'})
  assert.deepEqual(await saveQueryCredential(x.service,{...args,protectedRefs:null}),{ok:false,error:'invalid-input'})
  assert.deepEqual(await saveQueryCredential(x.service,{}),{ok:false,error:'invalid-input'})
  assert.deepEqual(await saveQueryCredential(x.service,null),{ok:false,error:'invalid-input'})
  assert.equal(x.calls.length,0)
})
test('missing set, failed describe, and read-only credential sources do not write',async()=>{
  for(const service of [null,{}, {describe:async()=>({ok:true,value:{}})},fixture({describe:async()=>({ok:false,error:args.value})}).service,fixture({describe:async()=>({ok:true,value:{[ref]:{configured:true,writable:false,source:'env'}}})}).service]) {
    assert.deepEqual(await saveQueryCredential(service,args),{ok:false,error:'unavailable'})
  }
})
test('write errors are redacted and never automatically retried',async()=>{
  for(const throws of [false,true]) {
    let writes=0
    const x=fixture({set:async()=>{writes++;if(throws)throw Error(args.value+' '+ref);return {ok:false,error:args.value+' '+ref}}})
    const result=await saveQueryCredential(x.service,args)
    assert.deepEqual(result,{ok:false,error:'write-failed'})
    assert.equal(writes,1)
    assert.ok(!JSON.stringify(result).includes(args.value))
    assert.ok(!JSON.stringify(result).includes(ref))
  }
})
test('post-write missing, false, or failing describe is unconfirmed, not success',async()=>{
  for(const mode of ['false','throw','malformed']) {
    let describes=0,writes=0
    const service={describe:async()=>{describes++;if(describes>1&&mode==='throw')throw Error(args.value);if(describes>1&&mode==='malformed')return {ok:false,error:args.value};return {ok:true,value:{[ref]:{configured:false,writable:true,source:'none'}}}},set:async()=>{writes++;return {ok:true,value:args.value}}}
    assert.deepEqual(await saveQueryCredential(service,args),{ok:false,error:'verification-failed'})
    assert.equal(writes,1)
    assert.equal(describes,2)
  }
})
