import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=process.env.SOURCE_DIR;
let calls=0;
for (const k of ['readFile','readdir','stat','writeFile','mkdir','rename','rm']) {
 const original=fs[k]; fs[k]=(...args)=>{calls++;return original(...args)};
}
syncBuiltinESMExports();
const {apply}=await import(pathToFileURL(join(root,'index.js')));
const {modelFamily,BUILTINS}=await import(pathToFileURL(join(root,'catalog.js')));
const {openDossier}=await import(pathToFileURL(join(root,'dossier.js')));
async function fixture(t) {
 const dir=await fs.mkdtemp(join(tmpdir(),'kujira161-'));
 const sections=[],tools=new Map(),commands=new Map();let hook;
 const ctx={systemPrompt:{section:s=>sections.push(s)},on:(n,h)=>{assert.equal(n,'system-prompt/assemble');hook=h},get:()=>undefined,
  inject:(_deps,callback)=>callback({tools:{register:t=>tools.set(t.name,t)},commands:{register:c=>commands.set(c.name,c)}})};
 const config={personaDir:join(dir,'persona'),personasDir:join(dir,'personas'),worldDir:join(dir,'world')};
 apply(ctx,config);
 function agent(model){const a={options:{provider:'test',model},header:null};a.session={requestHeader:()=>a.header};return a;}
 async function assemble(a,model=a.options.model){
  const original={sections:[{name:'host',text:'UNCHANGED'},...sections.map(s=>({...s}))],tools:[{name:'host-tool'}],contexts:[{name:'host-context'}],variables:{}};
  const result=await hook(original,{agent:a},async()=>({...original,variables:{provider:'test',model}}));
  a.header={config:{provider:'test',model}};
  assert.equal(result.tools,original.tools);assert.equal(result.contexts,original.contexts);assert.equal(result.sections[0],original.sections[0]);
  return Object.fromEntries(result.sections.map(s=>[s.name,s.text]));
 }
 t.after(async()=>{await fs.rm(dir,{recursive:true,force:true})});
 return {dir,config,agent,assemble,tools,commands};
}
test('14 family mappings share roles across versions and aliases; unknowns remain empty',()=>{
 assert.equal(BUILTINS.length,14);
 for(const [role,models] of Object.entries({gpt:['gpt-4o','gpt-5-codex','o3'],mistral:['mistral-large','mistralai/mixtral-8x7b','ministral-8b','devstral-small','codestral-latest','magistral-medium'],hunyuan:['hunyuan-t1','tencent/hunyuan-a13b'],mimo:['mimo-v2','xiaomi/mimo-7b']}))
  for(const model of models) assert.equal(modelFamily({provider:'relay',model}),role);
 for(const model of ['gemma-3','nova-pro','private-alias']) assert.equal(modelFamily({provider:'openai-compatible',model}),'none');
});
test('DeepSeek recognizes Gemini/GPT/Claude through shared impressions, not other personal files',async t=>{
 const f=await fixture(t), a=f.agent('deepseek-chat'),value=await f.assemble(a);
 assert.match(value['whale:world'],/猫猫.*哈基米/);assert.match(value['whale:world'],/GPT.*龙娘/);
 assert.match(value['whale:world'],/爱封中国用户号/);assert.match(value['whale:world'],/送鸡蛋/);
 assert.match(value['whale:persona'],/当前角色：DeepSeek/);
 assert.doesNotMatch(value['whale:world'],/BV18zpA6XERn|## 我的性格与表达/);
 assert.doesNotMatch(value['whale:persona'],/Flash_1017|world\.execute|禁用|执行规范/);
});
test('all 14 presets load while new sparse profiles leave personality open',async t=>{
 const f=await fixture(t);
 const models=['deepseek-chat','gpt-4o','gemini-pro','claude-sonnet','grok-4','glm-4','kimi-k2','qwen3','MiniMax-M2','llama-3','doubao-seed','mistral-large','hunyuan-t1','mimo-v2'];
 for(const model of models){const v=await f.assemble(f.agent(model));assert.match(v['whale:persona'],/当前角色/);assert.equal((v['whale:persona'].match(/## 当前角色/g)||[]).length,1)}
 assert.match((await f.assemble(f.agent('mimo-v2')))['whale:persona'],/从用户接下来的对话中继续补充/);
});
test('100 warm assemblies and model version switches retain zero filesystem operations',async t=>{
 const f=await fixture(t),a=f.agent('gpt-4o');await f.assemble(a);calls=0;
 for(let i=0;i<100;i++) await f.assemble(a,i%2?'gpt-5-codex':'gpt-4o');
 assert.equal(calls,0);
});
test('world edits refresh shared cache; personal edits remain isolated',async t=>{
 const f=await fixture(t),a=f.agent('gpt-4o'),b=f.agent('deepseek-chat');await f.assemble(a);await f.assemble(b);
 const edit=(agent,args)=>f.tools.get('persona_edit').execute(args,{agent});
 let r=await edit(a,{action:'append',scope:'world',text:'USER_RELATION_PUBLIC'});assert.equal(r.cache_updated,true);
 assert.match((await f.assemble(b))['whale:world'],/USER_RELATION_PUBLIC/);
 r=await edit(a,{action:'append',category:'memory',text:'DRAGON_PRIVATE_MEMORY'});assert.equal(r.cache_updated,true);
 const vb=await f.assemble(b);assert.doesNotMatch(vb['whale:world']+vb['whale:persona'],/DRAGON_PRIVATE_MEMORY/);
 assert.match((await f.assemble(a))['whale:persona'],/DRAGON_PRIVATE_MEMORY/);
});
test('external edit takes one explicit reload, not per-turn polling',async t=>{
 const f=await fixture(t),a=f.agent('deepseek-chat');await f.assemble(a);
 await fs.writeFile(join(f.config.worldDir,'45-external.md'),'EXTERNAL_SINGLE_RELOAD');
 assert.doesNotMatch((await f.assemble(a))['whale:world'],/EXTERNAL_SINGLE_RELOAD/);
 await f.tools.get('persona_edit').execute({action:'reload',scope:'world'},{agent:a});
 assert.match((await f.assemble(a))['whale:world'],/EXTERNAL_SINGLE_RELOAD/);
});
test('existing user-modified defaults survive the content update',async t=>{
 const dir=await fs.mkdtemp(join(tmpdir(),'kujira161-preserve-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const filename=join(dir,'20-性格.md');await fs.writeFile(filename,'USER_EXISTING_PERSONALITY');
 await fs.writeFile(join(dir,'.kujira-state.json'),JSON.stringify({files:{'20-性格.md':{source:'user',hash:'existing'}}}));
 const store=openDossier({id:'deepseek',label:'DeepSeek',personaDir:dir,packagedDir:join(root,'persona'),seed:true,sync:true});
 await store.compose();assert.equal(await fs.readFile(filename,'utf8'),'USER_EXISTING_PERSONALITY');
});
test('custom roles and wildcard bindings retain the existing flow',async t=>{
 const f=await fixture(t),a=f.agent('private-v1');await f.assemble(a);
 await f.tools.get('persona_manage').execute({action:'create',persona:'stella',name:'星璃',text:'STELLA_USER_SELF',use_current_model:true},{agent:a});
 assert.match((await f.assemble(a))['whale:persona'],/STELLA_USER_SELF/);
 await f.tools.get('persona_manage').execute({action:'bind',persona:'stella',provider:'test',model:'private-*'},{agent:a});
 assert.match((await f.assemble(a,'private-v2'))['whale:persona'],/STELLA_USER_SELF/);
});
test('no dependencies or lifecycle scripts; user and AI help describe dialogue editing',()=>{
 const p=JSON.parse(readFileSync(join(root,'package.json')));
 assert.equal(p.version,'1.6.1');for(const k of ['scripts','dependencies','devDependencies'])assert.ok(!p[k]);
 const zh=JSON.parse(readFileSync(join(root,'locale/zh.json'))).meta.description;
 assert.match(zh,/对话|聊天/);assert.match(zh,/persona_edit/);assert.match(zh,/persona_manage/);
 const guide=readFileSync(join(root,'instructions/README.md'),'utf8');assert.match(guide,/scope=world/);assert.match(guide,/reload/);
});
