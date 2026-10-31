import test from 'node:test'
import assert from 'node:assert/strict'
const {arkPlanAdapters}=await import(process.env.KUJIRA_PACKAGE_ROOT?new URL('pet/usage-ark-plan.js', 'file://'+process.env.KUJIRA_PACKAGE_ROOT.replace(/\/$/,'')+'/'):new URL('../../pet/usage-ark-plan.js',import.meta.url))

test('Ark AFP keeps rolling window labels, used percentages, and millisecond reset times',async()=>{
  // https://docs.volcengine.com/docs/ark/get-afp-usage-api?lang=zh
  const now=Date.UTC(2026,9,31),reset=now+3600000
  const window={Quota:'50.0',Used:'12.5',SubscribeTime:now-3600000,ResetTime:reset}
  const result=await arkPlanAdapters['volcengine-agent-plan'].read({
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

test('Generic cloud billing implementations are removed',()=>{assert.deepEqual(Object.keys(arkPlanAdapters),['volcengine-agent-plan'])})
