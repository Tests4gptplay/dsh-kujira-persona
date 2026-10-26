import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink,chmod} from 'node:fs/promises'
import {join} from 'node:path'
import {openCatalog} from '../../catalog.js'
import {openDossier} from '../../dossier.js'
import {migrateDeepSeek} from '../../persona-migration.js'
async function fixture(t){const root=await mkdtemp('/tmp/kujira-history-recovery-');t.after(()=>rm(root,{recursive:true,force:true}));return root}
test('catalog malformed JSON is preserved, built-ins still work, repaired data is picked up without reload',async t=>{
 const root=await fixture(t),file=join(root,'.kujira-catalog.json');await writeFile(file,'{broken');const c=openCatalog({personasDir:root,modelRules:[]})
 assert.equal((await c.resolve({model:'gpt'})).id,'gpt');assert.equal(await readFile(file,'utf8'),'{broken')
 await writeFile(file,JSON.stringify({v:99,personas:[{id:'mine',label:'Mine'}],bindings:[{model:'mine-model',persona:'mine'}]}))
 assert.equal((await c.resolve({model:'mine-model'})).id,'mine')
})
test('invalid catalog records do not suppress valid ones; later mutation keeps bad original backup',async t=>{
 const root=await fixture(t),file=join(root,'.kujira-catalog.json'),raw=JSON.stringify({v:7,personas:[null,{id:'mine',label:'Mine'}],bindings:[null,{model:'mine-model',persona:'mine'},{model:5,persona:'gpt'}]});await writeFile(file,raw)
 const c=openCatalog({personasDir:root,modelRules:[]});assert.equal((await c.resolve({model:'mine-model'})).id,'mine');assert.equal((await c.resolve({model:'gpt'})).id,'gpt')
 await c.change({action:'bind',persona:'mine',model:'second'},{});const backup=(await readdir(root)).find(n=>n.endsWith('.bak'));assert.ok(backup);assert.equal(await readFile(join(root,backup),'utf8'),raw)
 assert.equal((await c.resolve({model:'second'})).id,'mine')
})
test('catalog transient IO failure does not poison ordinary later operations',async t=>{
 const root=await fixture(t),file=join(root,'.kujira-catalog.json');await mkdir(file);const c=openCatalog({personasDir:root,modelRules:[]});await assert.rejects(c.list());await rm(file,{recursive:true});assert.equal((await c.resolve({model:'gpt'})).id,'gpt')
})
test('create retry after failed index save preserves existing custom files and registers the role',async t=>{
 const root=await fixture(t),c=openCatalog({personasDir:root,modelRules:[]});await c.list();const file=join(root,'.kujira-catalog.json');await mkdir(file)
 const args={action:'create',persona:'custom-a',name:'A',text:'original'};await assert.rejects(c.change(args,{}));await rm(file,{recursive:true});const body=join(root,'custom-a/00-用户设定.md');await writeFile(body,'USER MODIFIED DURING RECOVERY')
 await c.change({...args,text:'DO NOT OVERWRITE'},{});assert.equal(await readFile(body,'utf8'),'USER MODIFIED DURING RECOVERY');assert.equal((await c.get('custom-a')).label,'A')
})
test('recovery create does not follow a role-directory symlink',async t=>{
 const root=await fixture(t),outside=join(root,'other');await mkdir(outside);await symlink(outside,join(root,'custom-a'),'dir');const c=openCatalog({personasDir:root,modelRules:[]});await assert.rejects(c.change({action:'create',persona:'custom-a',name:'A',text:'no'},{}),/自己的目录/);assert.deepEqual(await readdir(outside),[])
})
test('role IDs have no arbitrary 64-character ceiling; actual filesystem failure does not poison the next create',async t=>{
 const root=await fixture(t),c=openCatalog({personasDir:root,modelRules:[]}),id='r'+'x'.repeat(90);await c.change({action:'create',persona:id,name:'Long ID',text:'valid'},{});assert.equal((await c.get(id)).id,id)
 await assert.rejects(c.change({action:'create',persona:'r'+'x'.repeat(300),name:'OS limit',text:'not a permanent gate'},{}));await c.change({action:'create',persona:'short-id',name:'Next works',text:'valid'},{});assert.equal((await c.get('short-id')).label,'Next works')
})
test('creating an empty role shell does not require invented basic persona text',async t=>{
 const root=await fixture(t),c=openCatalog({personasDir:root,modelRules:[]});await c.change({action:'create',persona:'empty-role'},{});assert.equal((await c.get('empty-role')).label,'empty-role');assert.match(await readFile(join(root,'empty-role/00-用户设定.md'),'utf8'),/# empty-role/)
})
test('persona append accepts empty/whitespace strings and preserves supplied text without a content gate',async t=>{
 const root=await fixture(t),d=openDossier({personaDir:root,id:'x',label:'X',seed:false,sync:false});await d.edit({action:'append',text:''});await d.edit({action:'append',text:'  \t  '});const body=await readFile(join(root,'95-自补-人设.md'),'utf8');assert.match(body,/  \t  /);await assert.rejects(d.edit({action:'append',text:{}}),/字符串/);await d.edit({action:'append',text:'after bad type'});assert.match((await d.compose()).text,/after bad type/)
})
test('explicit underscore/dot Markdown read/edit works without automatic prompt injection or path escape',async t=>{
 const root=await fixture(t),d=openDossier({personaDir:root,id:'x',label:'X',seed:false,sync:false});for(const file of ['_notes.md','.notes.md']){await d.edit({action:'append',file,text:'EXPLICIT NOTE'});assert.match((await d.read(file)).text,/EXPLICIT NOTE/);assert.doesNotMatch((await d.compose()).text,/EXPLICIT NOTE/);await d.edit({action:'replace',file,oldText:'EXPLICIT NOTE',newText:'EDITED NOTE'});assert.match((await d.read(file)).text,/EDITED NOTE/);assert.doesNotMatch((await d.compose()).text,/EDITED NOTE/)}await d.reload();assert.doesNotMatch((await d.compose()).text,/EDITED NOTE/);await assert.rejects(d.read('../foreign.md'),/不能带路径/)
})
test('dossier repaired directory recovers on compose/edit without explicit reload',async t=>{
 const root=await fixture(t),dir=join(root,'persona');await writeFile(dir,'not a directory');const d=openDossier({personaDir:dir,id:'x',label:'X',seed:false,sync:false});await assert.rejects(d.compose());await rm(dir);await mkdir(dir);await writeFile(join(dir,'note.md'),'repaired');assert.match((await d.compose()).text,/repaired/);await d.edit({action:'append',text:'new text'});assert.match((await d.compose()).text,/new text/)
})
test('dossier failed reload does not latch failure after filesystem repair',async t=>{
 const root=await fixture(t),dir=join(root,'persona');await mkdir(dir);const d=openDossier({personaDir:dir,id:'x',label:'X',seed:false,sync:false});await d.compose();await rm(dir,{recursive:true});await writeFile(dir,'temporary');await assert.rejects(d.reload());await rm(dir);await mkdir(dir);await writeFile(join(dir,'note.md'),'restored');assert.match((await d.compose()).text,/restored/)
})
test('no arbitrary append, source-file or composed-text truncation; exact edits still require a unique target',async t=>{
 const root=await fixture(t),d=openDossier({personaDir:root,id:'x',label:'X',seed:false,sync:false});await d.edit({action:'append',text:'x'.repeat(4001)});const body='LARGE_START\n'+'x'.repeat(300000)+'\nLARGE_END';await writeFile(join(root,'large.md'),body);await d.reload();assert.ok((await d.files()).some(f=>f.file==='large.md'));assert.match((await d.compose()).text,/LARGE_END/);assert.ok((await d.compose()).text.length>300000);await assert.rejects(d.edit({action:'replace',file:'large.md',oldText:'x',newText:'z'}),/唯一匹配/);assert.equal(await readFile(join(root,'large.md'),'utf8'),body)
})
test('migration bad ownership and bad completion marker retain bytes and do not block import',async t=>{
 const root=await fixture(t),old=join(root,'old'),target=join(root,'new');await mkdir(old);await mkdir(target);await writeFile(join(old,'note.md'),'ORIGINAL');await writeFile(join(old,'.kujira-state.json'),JSON.stringify({files:{'note.md':{source:'user'}}}));await writeFile(join(target,'.kujira-state.json'),'{bad-state');await writeFile(join(target,'.kujira-legacy-migration.json'),'{bad-marker');const r=await migrateDeepSeek({legacyDir:old,targetDir:target});assert.equal(r.migrated,true);assert.equal(await readFile(join(target,'note.md'),'utf8'),'ORIGINAL');const names=await readdir(target);for(const prefix of ['.kujira-state.json.recovered-','.kujira-legacy-migration.json.recovered-'])assert.ok(names.some(n=>n.startsWith(prefix)&&n.endsWith('.bak')));assert.equal(await readFile(join(old,'note.md'),'utf8'),'ORIGINAL');assert.equal((await migrateDeepSeek({legacyDir:old,targetDir:target})).reason,'previously-imported')
})
test('read-only legacy source with damaged metadata is copied without any source-side write dependency',async t=>{
 const root=await fixture(t),old=join(root,'old'),target=join(root,'new');await mkdir(old);await writeFile(join(old,'note.md'),'READ ONLY ORIGINAL');await writeFile(join(old,'.kujira-state.json'),'{broken old metadata');await chmod(old,0o555)
 try{const r=await migrateDeepSeek({legacyDir:old,targetDir:target});assert.equal(r.migrated,true);assert.equal(await readFile(join(target,'note.md'),'utf8'),'READ ONLY ORIGINAL');assert.equal(await readFile(join(old,'.kujira-state.json'),'utf8'),'{broken old metadata');assert.deepEqual((await readdir(old)).sort(),['.kujira-state.json','note.md'])}finally{await chmod(old,0o755)}
})
test('actual index retries migration after a transient directory failure; remember and reload recover',async t=>{
 const root=await fixture(t),oldHome=process.env.DSH_HOME;process.env.DSH_HOME=root;t.after(()=>{if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome})
 await mkdir(join(root,'persona'));await writeFile(join(root,'persona/note.md'),'legacy');await mkdir(join(root,'personas'));await writeFile(join(root,'personas/deepseek'),'blocked directory')
 const commands=new Map(),tools=new Map(),listeners=new Map(),ctx={logger:{warn(){}},systemPrompt:{section(){}},get(){},on(n,f){listeners.set(n,f);return()=>{}},commands:{register(v){commands.set(v.name,v)}},tools:{register(v){tools.set(v.name,v);return()=>{}}},inject(deps,f){if(deps.length===1&&['commands','tools'].includes(deps[0]))f(ctx)}}
 const{apply}=await import('../../index.js?history-recovery');apply(ctx,{seed:false,sync:false});const agent={session:{requestHeader:()=>({config:{provider:'fixture',model:'deepseek'}})}};const remember=()=>commands.get('remember').handler({rawInput:'after repair',agent});assert.equal((await remember()).kind,'error');await rm(join(root,'personas/deepseek'));assert.equal((await remember()).kind,'success');assert.equal((await commands.get('persona').handler({rawInput:'reload',agent})).kind,'success');assert.match(await readFile(join(root,'personas/deepseek/90-记忆.md'),'utf8'),/after repair/)
 const tool=tools.get('persona_edit');await tool.execute({action:'append',file:'_notes.md',text:'EXPLICIT TOOL NOTE'},{agent});assert.match((await tool.execute({action:'read',file:'_notes.md'},{agent})).text,/EXPLICIT TOOL NOTE/);assert.doesNotMatch((await tool.execute({action:'read'},{agent})).text,/EXPLICIT TOOL NOTE/);listeners.get('dispose')?.()
})
