import test from 'node:test'
import assert from 'node:assert/strict'
const {cloudVendorAdapters}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/usage-cloud-vendors.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/usage-cloud-vendors.js',import.meta.url))

// Contract fixtures, with synthetic amounts and credentials. No network transport.
// Currency is part of the official QueryBalanceAcctOutput response:
// https://github.com/volcengine/volcengine-go-sdk/blob/master/service/billing/api_query_balance_acct.go
const adapter=cloudVendorAdapters['volcengine-billing']
async function readBalance(result,profile={}) {
  const calls=[]
  const value=await adapter.read({
    profile:{credentialRef:'FIXTURE_ACCESS_KEY',secretRef:'FIXTURE_SECRET_KEY',...profile},
    now:Date.UTC(2026,9,31),
    resolveCredential:async ref=>({FIXTURE_ACCESS_KEY:'synthetic-access-key',FIXTURE_SECRET_KEY:'synthetic-secret-key'})[ref],
    request:async(url,options)=>{calls.push({url,options});return {ResponseMetadata:{Action:'QueryBalanceAcct',Version:'2022-01-01'},Result:result}}
  })
  assert.equal(calls.length,1)
  assert.equal(new URL(calls[0].url).hostname,'billing.volcengineapi.com')
  assert.equal(new URL(calls[0].url).searchParams.get('Action'),'QueryBalanceAcct')
  return value.metrics[0]
}

test('Volcengine currency preference is optional when the API supplies Currency',()=>{
  assert.equal(adapter.requiredFields.includes('currency'),false)
  assert.equal(adapter.optionalFields.includes('currency'),true)
  assert.equal(adapter.optionalFields.includes('sessionTokenRef'),true)
})
test('Volcengine uses response Currency without manual currency configuration',async()=>{
  assert.deepEqual(await readBalance({AvailableBalance:'12.34',Currency:'CNY'}),
    {kind:'balance',value:12.34,currency:'CNY',scope:'cloud-account'})
})
test('Volcengine response Currency takes precedence over a stale manual preference',async()=>{
  const metric=await readBalance({AvailableBalance:'12.34',Currency:'CNY'},{currency:'USD'})
  assert.equal(metric.currency,'CNY')
  assert.equal(metric.value,12.34)
})
test('Volcengine keeps explicit currency fallback for older responses',async()=>{
  assert.equal((await readBalance({AvailableBalance:'12.34'},{currency:'CNY'})).currency,'CNY')
})
test('Volcengine keeps zero and negative balances as returned',async()=>{
  for(const amount of ['0','-1.25']){
    assert.equal((await readBalance({AvailableBalance:amount,Currency:'CNY'})).value,Number(amount))
  }
})
test('Volcengine missing amounts or both currency sources remain query errors',async()=>{
  await assert.rejects(readBalance({Currency:'CNY'}),/invalid-schema/)
  await assert.rejects(readBalance({AvailableBalance:'12.34'}),/currency-required/)
})

test('Alibaba exposes the documented HTTP 400 permission codes',()=>{
  // https://help.aliyun.com/en/user-center/developer-reference/api-bssopenapi-2017-12-14-queryaccountbalance
  assert.deepEqual(cloudVendorAdapters['alibaba-billing'].permissionErrorCodes,
    ['NotAuthorized','NoPermission','AuthSiteFail'])
})
test('Ark AFP keeps rolling window labels, used percentages, and millisecond reset times',async()=>{
  // https://docs.volcengine.com/docs/ark/get-afp-usage-api?lang=zh
  const now=Date.UTC(2026,9,31),reset=now+3600000
  const window={Quota:'50.0',Used:'12.5',SubscribeTime:now-3600000,ResetTime:reset}
  const result=await cloudVendorAdapters['volcengine-agent-plan'].read({
    now,profile:{credentialRef:'FIXTURE_ACCESS_KEY',secretRef:'FIXTURE_SECRET_KEY'},
    resolveCredential:async()=> 'synthetic-key',
    request:async()=>({Result:Object.fromEntries(['AFPFiveHour','AFPDaily','AFPWeekly','AFPMonthly'].map(name=>[name,{...window}]))})
  })
  assert.deepEqual(result.metrics.map(m=>m.label),['5h','rolling-day','rolling-week','rolling-month'])
  for(const metric of result.metrics){
    assert.equal(metric.value,25)
    assert.equal(metric.remaining,false)
    assert.equal(metric.resetAt,reset)
    assert.equal(metric.period.end,new Date(reset).toISOString())
  }
})
