import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {openDossier} from '../../dossier.js'
import {openCatalog} from '../../catalog.js'
import {migrateDeepSeek} from '../../persona-migration.js'

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'kujira-dossier-recovery-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const packagedDir=join(root,'bundle'),personaDir=join(root,'role');await mkdir(packagedDir);await writeFile(join(packagedDir,'00-a.md'),'SEED')
 const config={id:'gpt',label:'GPT',personaDir,packagedDir,seed:true,sync:true}
 return{root,config,dir:personaDir}
}
test('explicit reload refreshes external edits; hand deletion survives restart and sync',async t=>{
 const {config,dir}=await fixture(t),d=openDossier(config);await d.compose()
 await writeFile(join(dir,'00-a.md'),'CUSTOM');assert.doesNotMatch((await d.compose()).text,/CUSTOM/)
 await d.reload();assert.match((await d.compose()).text,/CUSTOM/)
 await rm(join(dir,'00-a.md'));await d.reload();assert.doesNotMatch((await d.compose()).text,/CUSTOM/)
 const again=openDossier(config);await again.compose();await again.sync()
 await assert.rejects(readFile(join(dir,'00-a.md')),/ENOENT/)
 assert.equal(JSON.parse(await readFile(join(dir,'.kujira-state.json'),'utf8')).files['00-a.md'].source,'deleted')
 await writeFile(join(dir,'00-a.md'),'RESTORED');await again.reload();assert.match((await again.compose()).text,/RESTORED/)
})
test('corrupt ownership state preserves original bytes and missing-file intent without blocking edits',async t=>{
 const {config,dir}=await fixture(t),d=openDossier(config);await d.compose();await d.edit({action:'delete',file:'00-a.md'})
 await writeFile(join(dir,'.kujira-state.json'),'{bad');const next=openDossier(config);await next.compose()
 await assert.rejects(readFile(join(dir,'00-a.md')),/ENOENT/)
 const backups=(await readdir(dir)).filter(x=>x.includes('.recovered-'));assert.equal(backups.length,1);assert.equal(await readFile(join(dir,backups[0]),'utf8'),'{bad')
 await next.edit({action:'append',file:'custom.md',text:'KEPT'});assert.match((await next.compose()).text,/KEPT/)
 assert.ok(JSON.parse(await readFile(join(dir,'.kujira-state.json'),'utf8')).files)
})
test('file links cannot redirect writes outside a configured root; internal and root links work',async t=>{
 const {root,config,dir}=await fixture(t);const d=openDossier(config);await d.compose()
 const outside=join(root,'outside.md');await writeFile(outside,'OUTSIDE');await symlink(outside,join(dir,'linked.md'));await d.reload()
 assert.equal((await d.read('linked.md')).text,'OUTSIDE','explicit reads retain existing behavior')
 await assert.rejects(d.edit({action:'replace',file:'linked.md',oldText:'OUTSIDE',newText:'BAD'}),/目录之外/)
 await assert.rejects(d.edit({action:'append',file:'linked.md',text:'BAD'}),/目录之外/)
 assert.equal(await readFile(outside,'utf8'),'OUTSIDE')
 const missing=join(root,'missing.md');await symlink(missing,join(dir,'dangling.md'))
 await assert.rejects(d.edit({action:'append',file:'dangling.md',text:'BAD'}),/目录之外/)
 await assert.rejects(readFile(missing),/ENOENT/)
 await symlink(join(dir,'00-a.md'),join(dir,'inside.md'));await d.reload();await d.edit({action:'replace',file:'inside.md',oldText:'SEED',newText:'INSIDE'})
 assert.equal(await readFile(join(dir,'00-a.md'),'utf8'),'INSIDE');assert.doesNotMatch((await d.compose()).text,/SEED/)
 const linkedRoot=join(root,'root-link');await symlink(dir,linkedRoot);const fromRoot=openDossier({...config,personaDir:linkedRoot});await fromRoot.compose()
 await fromRoot.edit({action:'append',file:'00-a.md',text:'ROOT_OK'});assert.match(await readFile(join(dir,'00-a.md'),'utf8'),/ROOT_OK/)
})
test('content-addressed backups retain multiple originals and failures are visible without global write lock',async t=>{
 const {config,dir}=await fixture(t),d=openDossier(config);await d.compose()
 await d.edit({action:'replace',file:'00-a.md',oldText:'SEED',newText:'SECOND'});await d.edit({action:'replace',file:'00-a.md',oldText:'SECOND',newText:'THIRD'})
 assert.equal((await readdir(join(dir,'.kujira-backup'))).filter(x=>x.endsWith('.bak')).length,2)
 await rm(join(dir,'.kujira-backup'),{recursive:true});await writeFile(join(dir,'.kujira-backup'),'not a directory')
 const result=await d.edit({action:'replace',file:'00-a.md',oldText:'THIRD',newText:'FOURTH'});assert.match(result.note,/备份未完整保存/);assert.match(result.warning,/备份/)
 assert.equal(await readFile(join(dir,'00-a.md'),'utf8'),'FOURTH')
})
test('configured legacy memory wins default source but never replaces existing target or deletion intent',async t=>{
 const {root}=await fixture(t),legacyDir=join(root,'legacy'),memory=join(root,'external.md');await mkdir(legacyDir);await writeFile(join(legacyDir,'90-记忆.md'),'DEFAULT');await writeFile(memory,'EXPLICIT')
 for(const kind of ['empty','existing','deleted']){
  const targetDir=join(root,kind);await mkdir(targetDir)
  if(kind==='existing')await writeFile(join(targetDir,'90-记忆.md'),'TARGET')
  if(kind==='deleted')await writeFile(join(targetDir,'.kujira-state.json'),JSON.stringify({files:{'90-记忆.md':{source:'deleted'}}}))
  await migrateDeepSeek({legacyDir,targetDir,legacyMemoryFile:memory})
  if(kind==='deleted')await assert.rejects(readFile(join(targetDir,'90-记忆.md')),/ENOENT/)
  else assert.equal(await readFile(join(targetDir,'90-记忆.md'),'utf8'),kind==='empty'?'EXPLICIT':'TARGET')
 }
})
test('catalog recovers cold and warm bindings, preserves corrupt bytes, and remains editable',async t=>{
 const {root}=await fixture(t),personasDir=join(root,'catalog'),warnings=[];const config={personasDir,mode:'auto',modelRules:[],onWarning:x=>warnings.push(x)}
 const c=openCatalog(config);await c.change({action:'bind',persona:'claude',model:'gpt-*'})
 await writeFile(join(personasDir,'.kujira-catalog.json'),'{bad');await c.reload();assert.equal((await c.resolve({model:'gpt-test'})).id,'claude')
 const cold=openCatalog(config);assert.equal((await cold.resolve({model:'gpt-test'})).id,'claude');assert.ok(warnings.some(x=>x.includes('最近有效绑定')))
 assert.equal((await readdir(personasDir)).filter(x=>x.includes('.recovered-')).length,1)
 await cold.change({action:'bind',persona:'kimi',model:'gpt-*'});assert.equal((await cold.resolve({model:'gpt-test'})).id,'kimi')
 assert.equal((await openCatalog({...config,mode:'fixed',persona:'gpt'}).resolve({model:''})).id,'stella','preserve established empty-model fallback')
})

test('default synchronization preserves links without writing outside the dossier',async t=>{
 const {root,config,dir}=await fixture(t);await openDossier(config).compose()
 const outside=join(root,'outside.md');await writeFile(outside,'SEED');await rm(join(dir,'00-a.md'));await symlink(outside,join(dir,'00-a.md'))
 await writeFile(join(config.packagedDir,'00-a.md'),'UPGRADE');await openDossier(config).compose()
 assert.equal(await readFile(outside,'utf8'),'SEED')
 await rm(outside);await openDossier(config).compose();await assert.rejects(readFile(outside),/ENOENT/)
})
