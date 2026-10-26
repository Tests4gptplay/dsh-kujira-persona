import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {migrateDeepSeek} from '../../persona-migration.js'
import {BUILTINS} from '../../catalog.js'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const wait=async predicate=>{for(let i=0;i<100;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,30))}throw new Error('preset initialization timeout')}

test('startup creates all 15 packaged persona folders and real prompts use community nicknames',async()=>{
 const base=await mkdtemp(join(tmpdir(),'kujira-persona-'))
 const oldHome=process.env.DSH_HOME;process.env.DSH_HOME=base
 const promptHooks=[]
 const ctx={systemPrompt:{section(){}},inject(){},on(event,fn,options={}){if(event==='system-prompt/assemble'){if(options.prepend)promptHooks.unshift(fn);else promptHooks.push(fn)}},get(){return null}}
 const promptHook=async(assembly,context,next)=>{const run=i=>i===promptHooks.length?next():promptHooks[i](assembly,context,()=>run(i+1));return run(0)}
 try{
   const {apply}=await import(pathToFileURL(join(root,'index.js')))
   apply(ctx,{personasDir:join(base,'personas'),worldDir:join(base,'world'),personaDir:join(base,'old')})
   assert.equal(BUILTINS.length,15)
   await wait(async()=>{
     const rows=await Promise.all(BUILTINS.map(async({id})=>{
       const files=await readdir(join(base,'personas',id)).catch(()=>[])
       return files.some(x=>x.startsWith('00-'))&&files.some(x=>x.startsWith('90-'))
     }))
     return rows.every(Boolean)
   })
   for(const [model,identity]of [['deepseek-chat','DeepSeek'],['gemini-3-pro','Gemini'],['gpt-6-astra','GPT'],['unmapped','星璃']]){
     const response=await promptHook(null,{agent:null},async()=>({variables:{provider:'test',model},sections:[{name:'whale:world',text:''},{name:'whale:persona',text:''}]}))
     const text=response.sections.map(x=>x.text).join('\n')
     assert(text.includes(identity))
     assert(text.includes('大肥鱼')&&text.includes('蓝色大肥鱼')&&text.includes('猫猫')&&text.includes('哈基米'))
     if(identity!=='星璃')assert(!/小鲸|我活泼|我好胜|我爱撒娇/.test(text))
   }
 }finally{
   if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome
   await rm(base,{recursive:true,force:true})
 }
})

test('DeepSeek migration is once-only and keeps custom files, tombstones and originals',async()=>{
 const base=await mkdtemp(join(tmpdir(),'kujira-migrate-'))
 const old=join(base,'old'),target=join(base,'personas','deepseek')
 try{
   await mkdir(old,{recursive:true});await mkdir(target,{recursive:true})
   await writeFile(join(old,'00-身份.md'),'custom name')
   await writeFile(join(old,'90-记忆.md'),'old memory')
   await writeFile(join(target,'90-记忆.md'),'current memory')
   await writeFile(join(old,'.kujira-state.json'),JSON.stringify({files:{'00-身份.md':{source:'user',hash:'x'},'50-关系.md':{source:'deleted'}}}))
   assert((await migrateDeepSeek({legacyDir:old,targetDir:target,legacyMemoryFile:join(old,'90-记忆.md')})).migrated)
   assert.equal(await readFile(join(target,'00-身份.md'),'utf8'),'custom name')
   assert.equal(await readFile(join(target,'90-记忆.md'),'utf8'),'current memory')
   assert.equal(JSON.parse(await readFile(join(target,'.kujira-state.json'),'utf8')).files['50-关系.md'].source,'deleted')
   await rm(join(target,'00-身份.md'))
   assert.equal((await migrateDeepSeek({legacyDir:old,targetDir:target})).migrated,false)
   await assert.rejects(readFile(join(target,'00-身份.md'),'utf8'),{code:'ENOENT'})
   assert.equal(await readFile(join(old,'00-身份.md'),'utf8'),'custom name')
 }finally{await rm(base,{recursive:true,force:true})}
})

test('packaged default persona text avoids invented private personalities',async()=>{
 for(const {id}of BUILTINS.filter(p=>p.id!=='stella')){
   const folder=id==='deepseek'?'persona':`personas/${id}`
   const files=await readdir(join(root,folder))
   for(const file of files.filter(f=>f.endsWith('.md')&&!f.startsWith('_'))){
     const text=await readFile(join(root,folder,file),'utf8')
     assert(!/小鲸|我(?:活泼|直率|好奇|从容|沉着|安静|热情|随和|亲切)|撒娇|好胜心/.test(text),folder+'/'+file)
   }
 }
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'))
 assert(pkg.files.includes('persona-migration.js'))
})
