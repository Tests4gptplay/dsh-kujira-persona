import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,symlink,lstat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {openDossier} from './dossier.js'
import {UPGRADE,NOTICE} from './update-package.js'
const PACK=`更新/${UPGRADE}`,hash=x=>createHash('sha256').update(x).digest('hex')
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'kujira-update13-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const packagedDir=join(root,'bundle'),personaDir=join(root,'gpt');await mkdir(packagedDir);await mkdir(personaDir);
 await writeFile(join(packagedDir,'00-default.md'),'NEW_BASE_LOGIC');await writeFile(join(packagedDir,'90-记忆.md'),'# memory\n');
 const config={id:'gpt',label:'GPT',packagedDir,personaDir};
 return {root,config,open:(extra={})=>openDossier({...config,...extra}),read:n=>readFile(join(personaDir,n),'utf8'),write:(n,s)=>writeFile(join(personaDir,n),s),state:async()=>JSON.parse(await readFile(join(personaDir,'.kujira-state.json'),'utf8'))}
}
test('first install stages defaults and empty memory, injects only notice, explicit create activates files',async t=>{
 const f=await fixture(t),d=f.open(),a=await d.compose();assert.doesNotMatch(a.text,/NEW_BASE_LOGIC/);assert.match(a.text,/首次安装且档案为空/);await assert.rejects(f.read('00-default.md'),{code:'ENOENT'});
 const files=await d.edit({action:'list',file:PACK});assert.ok(files.files.some(x=>x.file===PACK+'/新版/00-default.md'));assert.ok(files.files.some(x=>x.file===PACK+'/新版/90-记忆.md'));
 const source=await d.read(PACK+'/新版/00-default.md');await d.edit({action:'create',file:'00-default.md',text:source.text});assert.match((await d.compose()).text,/NEW_BASE_LOGIC/);await assert.rejects(d.edit({action:'create',file:'00-default.md',text:'BAD'}),{code:'EEXIST'});
 assert.equal(await f.read('00-default.md'),'NEW_BASE_LOGIC')
})
test('unchanged tracked old seed is NOT overwritten; exact seed baseline is available',async t=>{
 const f=await fixture(t);await f.write('00-default.md','OLD_BASE');await f.write('.kujira-state.json',JSON.stringify({files:{'00-default.md':{hash:hash('OLD_BASE'),source:'seed'}}}));const d=f.open();await d.compose();assert.equal(await f.read('00-default.md'),'OLD_BASE');assert.equal((await d.read(PACK+'/旧版/00-default.md')).text,'OLD_BASE');assert.match((await d.read(PACK+'/清单.md')).text,/匹配 seed SHA256/)
})
test('heavy custom RP retained; missing reliable baseline explicitly unknown, no invented old body',async t=>{
 const f=await fixture(t);await f.write('00-default.md','HEAVY_RP_USER_CONTENT');await f.write('95-custom.md','USER_OTHER');await f.write('90-记忆.md','PRIVATE_MEMORY');const d=f.open();await d.compose();assert.equal(await f.read('00-default.md'),'HEAVY_RP_USER_CONTENT');assert.equal(await f.read('95-custom.md'),'USER_OTHER');assert.equal(await f.read('90-记忆.md'),'PRIVATE_MEMORY');assert.match((await d.read(PACK+'/清单.md')).text,/旧基础不可可靠恢复/);assert.doesNotMatch((await d.read(PACK+'/清单.md')).text,/HEAVY_RP_USER_CONTENT/);assert.match(await f.read(NOTICE),/以用户现有档案为主体/);assert.match(await f.read(NOTICE),/矛盾时以自定义为主/);assert.ok(!(await d.edit({action:'list',file:PACK})).files.some(x=>x.file.includes('90-记忆')))
})
test('matching previous seed backup gives reliable baseline without changing mixed active body',async t=>{
 const f=await fixture(t);await f.write('00-default.md','OLD_BASE plus CUSTOM');await f.write('.kujira-state.json',JSON.stringify({files:{'00-default.md':{hash:hash('OLD_BASE'),source:'seed'}}}));await mkdir(join(f.config.personaDir,'.kujira-backup'));await f.write('.kujira-backup/00-default.md.'+hash('OLD_BASE').slice(0,16)+'.bak','OLD_BASE');const d=f.open();await d.compose();assert.equal((await d.read(PACK+'/旧版/00-default.md')).text,'OLD_BASE');assert.equal(await f.read('00-default.md'),'OLD_BASE plus CUSTOM')
})
test('pending restart and sync preserve package, interrupted progress and active bytes',async t=>{
 const f=await fixture(t);await f.write('00-default.md','OLD CUSTOM');const d=f.open();await d.compose();const original=await f.read(PACK+'/新版/00-default.md');await d.edit({action:'append',file:NOTICE,text:'migration partly done'});await f.open().sync();assert.equal(await f.read(PACK+'/新版/00-default.md'),original);assert.match(await f.read(NOTICE),/partly done/);assert.equal(await f.read('00-default.md'),'OLD CUSTOM');assert.equal((await f.state()).upgradeNotices[UPGRADE].status,'pending')
})
test('complete migration reread, exact package cleanup then notification delete does not resurrect',async t=>{
 const f=await fixture(t);await f.write('00-default.md','OLD CUSTOM');const d=f.open();await d.compose();await mkdir(join(f.config.personaDir,'更新','defaults-other'));await f.write('更新/defaults-other/other.md','OTHER');await d.edit({action:'replace',file:'00-default.md',oldText:'OLD',newText:'NEW'});assert.equal((await d.read('00-default.md')).text,'NEW CUSTOM');assert.equal((await d.edit({action:'delete_update',file:PACK})).removed,true);await d.edit({action:'delete',file:NOTICE});await f.open().sync();assert.equal((await f.state()).upgradeNotices[UPGRADE].status,'completed');await assert.rejects(f.read(PACK+'/清单.md'),{code:'ENOENT'});await assert.rejects(f.read(NOTICE),{code:'ENOENT'});assert.equal(await f.read('更新/defaults-other/other.md'),'OTHER');assert.equal(await f.read('00-default.md'),'NEW CUSTOM')
})
test('cleanup keeps unknown content and never accepts whole update folder or other package',async t=>{
 const f=await fixture(t),d=f.open();await d.compose();await f.write(PACK+'/user-note.md','USER NOTE');assert.equal((await d.edit({action:'delete_update',file:PACK})).removed,false);assert.equal(await f.read(PACK+'/user-note.md'),'USER NOTE');await assert.rejects(d.edit({action:'delete_update',file:'更新'}));await assert.rejects(d.edit({action:'delete_update',file:'更新/defaults-other'}));await f.open().compose();assert.equal(await f.read(PACK+'/user-note.md'),'USER NOTE')
})
test('published package recovers notice/state interruption without replacing stored references',async t=>{
 const f=await fixture(t),d=f.open();await d.compose();const old=await f.read(PACK+'/新版/00-default.md');const s=await f.state();delete s.upgradeNotices;await f.write('.kujira-state.json',JSON.stringify(s));await rm(join(f.config.personaDir,NOTICE));await writeFile(join(f.config.packagedDir,'00-default.md'),'LATER_BUNDLE');await f.open().compose();assert.equal(await f.read(PACK+'/新版/00-default.md'),old);assert.match(await f.read(NOTICE),/更新/);assert.equal((await f.state()).upgradeNotices[UPGRADE].status,'pending')
})
test('personas and world isolated; no reference text enters active prompt',async t=>{
 const f=await fixture(t);await f.write('00-default.md','GPT_ONLY');await f.open().compose();const dir=join(f.root,'world');await mkdir(dir);await writeFile(join(dir,'00-default.md'),'WORLD_ONLY');const w=f.open({personaDir:dir,id:'world',kind:'world'});const text=(await w.compose()).text;assert.match(text,/WORLD_ONLY/);assert.match(text,/scope=world/);assert.doesNotMatch(text,/GPT_ONLY|NEW_BASE_LOGIC/);assert.equal((await w.read(PACK+'/新版/00-default.md')).text,'NEW_BASE_LOGIC')
})
test('update traversal and symlink escape rejected; dangling notice target preserved',async t=>{
 const f=await fixture(t),d=f.open();await d.compose();await assert.rejects(d.read('更新/../00-default.md'));await rm(join(f.config.personaDir,PACK,'新版','00-default.md'));await symlink(join(f.root,'bundle','00-default.md'),join(f.config.personaDir,PACK,'新版','00-default.md'));await assert.rejects(d.read(PACK+'/新版/00-default.md'));await assert.rejects(d.edit({action:'delete_update',file:PACK}));const g=await fixture(t);await symlink('missing.md',join(g.config.personaDir,NOTICE));const warnings=[];await g.open({onWarning:x=>warnings.push(x)}).compose();assert.ok((await lstat(join(g.config.personaDir,NOTICE))).isSymbolicLink());assert.ok(warnings.length)
})
test('notification failure logs and keeps original prompt; restart recovers complete package',async t=>{
 const {default:fs}=await import('node:fs'),{syncBuiltinESMExports}=await import('node:module');const f=await fixture(t);await f.write('00-default.md','KEEP_RP');const original=fs.promises.writeFile,warnings=[];fs.promises.writeFile=async(path,data,options)=>{if(String(path).includes(NOTICE+'.')&&String(path).endsWith('.tmp')){await original(path,String(data).slice(0,5),options);const e=new Error('synthetic');e.code='ENOSPC';throw e}return original(path,data,options)};syncBuiltinESMExports();try{assert.match((await f.open({onWarning:x=>warnings.push(x)}).compose()).text,/KEEP_RP/);assert.equal((await f.state()).upgradeNotices?.[UPGRADE],undefined)}finally{fs.promises.writeFile=original;syncBuiltinESMExports()};assert.match(warnings.join(' '),/ENOSPC/);await f.open().compose();assert.match(await f.read(NOTICE),/以用户现有档案为主体/);assert.equal(await f.read('00-default.md'),'KEEP_RP')
})
test('sync disabled stages nothing and does not rewrite current defaults',async t=>{const f=await fixture(t);await f.write('00-default.md','CUSTOM');await f.open({sync:false}).compose();assert.equal(await f.read('00-default.md'),'CUSTOM');assert.ok(!(await readdir(f.config.personaDir)).includes('更新'))})

test('cleanup interrupted after manifest removal resumes empty package only',async t=>{
 const f=await fixture(t),d=f.open();await d.compose();const files=await d.edit({action:'list',file:PACK});for(const {file} of files.files)await rm(join(f.config.personaDir,file));await rm(join(f.config.personaDir,PACK,'新版'),{recursive:true});await rm(join(f.config.personaDir,PACK,'旧版'),{recursive:true});await rm(join(f.config.personaDir,PACK,'.manifest.json'));
 assert.equal((await d.edit({action:'delete_update',file:PACK})).removed,true);await d.edit({action:'delete',file:NOTICE});await f.open().compose();assert.equal((await f.state()).upgradeNotices[UPGRADE].status,'completed')
})
test('partial package write is never published or injected and retries with original RP intact',async t=>{
 const {default:fs}=await import('node:fs'),{syncBuiltinESMExports}=await import('node:module');const f=await fixture(t);await f.write('00-default.md','PRIVATE_RP');const original=fs.promises.writeFile,warnings=[];fs.promises.writeFile=async(path,data,options)=>{if(String(path).includes('/新版/')){await original(path,String(data).slice(0,3),options);const e=new Error('synthetic');e.code='ENOSPC';throw e}return original(path,data,options)};syncBuiltinESMExports();try{const a=await f.open({onWarning:x=>warnings.push(x)}).compose();assert.match(a.text,/PRIVATE_RP/);assert.doesNotMatch(a.text,/NEW_BASE_LOGIC/);assert.equal((await f.state()).upgradeNotices?.[UPGRADE],undefined)}finally{fs.promises.writeFile=original;syncBuiltinESMExports()};await assert.rejects(f.read(PACK+'/清单.md'),{code:'ENOENT'});assert.match(warnings.join(' '),/ENOSPC/);await f.open().compose();assert.equal(await f.read(PACK+'/新版/00-default.md'),'NEW_BASE_LOGIC');assert.equal(await f.read('00-default.md'),'PRIVATE_RP')
})
test('existing update root symlink is not followed or overwritten',async t=>{
 const f=await fixture(t);await f.write('00-default.md','RP');const outside=join(f.root,'outside');await mkdir(outside);await symlink(outside,join(f.config.personaDir,'更新'));const warnings=[];assert.match((await f.open({onWarning:x=>warnings.push(x)}).compose()).text,/RP/);assert.deepEqual(await readdir(outside),[]);assert.ok((await lstat(join(f.config.personaDir,'更新'))).isSymbolicLink());assert.ok(warnings.length)
})
