import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtemp,readFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {openDiary} from './daily-diary.js'
import {applyDiaryIntegration} from './diary-integration.js'
const require=createRequire(process.env.DSH_TEST_ROOT?resolve(process.env.DSH_TEST_ROOT,'package.json'):import.meta.url)
const {Context}=await import(require.resolve('@deepseek-ai/cordis'))
const {default:SystemPrompt}=await import(require.resolve('@deepseek-ai/dsh-system-prompt'))
const {default:Tools}=await import(require.resolve('@deepseek-ai/dsh-tools'))
test('actual native ToolRuntime validates daily results, parallel-summary recovery and OFF removal',async t=>{
 const home=await mkdtemp(join(tmpdir(),'daily-native-')),diary=openDiary({home,timeZone:'UTC',now:()=>new Date('2026-10-26T12:00:00Z')}),ctx=new Context(),requests=new WeakMap(),entry={id:'gpt',label:'GPT'}
 const a={id:'a'},b={id:'b'};requests.set(a,{entry});requests.set(b,{entry})
 try{await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);await ctx.plugin({name:'daily-native',inject:['systemPrompt','tools'],apply(scope){applyDiaryIntegration(scope,{diary,requests,forInvocation:async()=>({entry})})}});await diary.ready;await diary.configure({enabled:true})
 assert.equal(ctx.tools.get('ai_diary').parameters.properties.basis,undefined)
 await ctx.systemPrompt.assemble({agent:a});await ctx.systemPrompt.assemble({agent:b})
 let n=0;const exec=async(agent,args)=>{const result=await ctx.tools.execute({agent,name:'ai_diary',arguments:args,signal:new AbortController().signal,callId:'test-'+n++});assert.notEqual(result.isError,true,JSON.stringify(result));return result.content.map(c=>c.text??'').join('\n')}
 await exec(a,{action:'append',text:'FIRST',summary:'FIRST SUMMARY'})
 const conflict=await exec(b,{action:'append',text:'SECOND',summary:'STALE SECOND'});assert.match(conflict,/正文已保存/);assert.match(conflict,/FIRST SUMMARY/)
 await t.test('short-only context cannot acknowledge unseen pending text; next normal merge survives reassembly',async()=>{
  const c={id:'new-context'};requests.set(c,{entry})
  const context=await ctx.systemPrompt.assemble({agent:c});assert.ok(!JSON.stringify(context.sections).includes('STALE SECOND'))
  const first=await exec(c,{action:'update_summary',summary:'FORGET SECOND'})
  assert.match(first,/SECOND/);assert.match(first,/未覆盖最新内容/);assert.equal((await diary.readOwn(entry)).summary,'FIRST SUMMARY')
  assert.equal((await diary.readOwn(entry)).pending_summaries.length,1)
  await ctx.systemPrompt.assemble({agent:c})
  const merged=await exec(c,{action:'update_summary',summary:'FIRST AND SECOND'})
  assert.doesNotMatch(merged,/未覆盖最新内容/);assert.equal((await diary.readOwn(entry)).summary_pending,false)
 })
 const read=await ctx.tools.get('ai_diary').execute({action:'read'},{agent:b});await exec(b,{action:'update_summary',summary:'MERGED CURRENT'})
 assert.equal(await readFile(join(home,'diaries/gpt/long/2026-10-26.md'),'utf8'),'FIRST\nSECOND\n')
 assert.match(await exec(a,{action:'search',query:'FIRST'}),/2026-10-26 \/ long L1:C1/)
 await t.test('search never upgrades a write basis without showing the corresponding summary',async()=>{
  await ctx.systemPrompt.assemble({agent:a});await ctx.systemPrompt.assemble({agent:b})
  await exec(b,{action:'update_summary',summary:'OTHER SESSION NEW'})
  const searched=await exec(a,{action:'search',query:'no match'});assert.doesNotMatch(searched,/basis=/)
  const rejected=await exec(a,{action:'update_summary',summary:'STALE FROM ORIGINAL'});assert.match(rejected,/未覆盖最新内容/)
  assert.equal((await diary.readOwn(entry)).summary,'OTHER SESSION NEW')
 })
 await t.test('a fresh request needs no model token: saves text, sees current summary, then naturally merges',async()=>{
  const fresh={id:'fresh'};requests.set(fresh,{entry})
  const append=await exec(fresh,{action:'append',text:'FRESH BODY',summary:'OLDER GUESS'})
  assert.match(append,/正文已保存/);assert.match(append,/OTHER SESSION NEW/);assert.doesNotMatch(append,/basis/)
  await exec(fresh,{action:'update_summary',summary:'CURRENT WITH FRESH'})
  assert.equal((await diary.readOwn(entry)).summary,'CURRENT WITH FRESH')
 })
 await diary.configure({enabled:false,sleepEnabled:true});assert.equal(ctx.tools.get('ai_diary'),undefined);const off=await ctx.systemPrompt.assemble({agent:a});assert.equal(off.sections.find(s=>s.name==='whale:diary').text,'')
 }finally{await ctx.fiber.dispose()}
})
