import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
import {openDossier} from '../../../../dossier.js';import {openCatalog,BUILTINS} from '../../../../catalog.js';import {migrateDeepSeek} from '../../../../persona-migration.js';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const base=await mkdtemp(join(tmpdir(),'kujira-synthetic-'));
const text=p=>readFile(p,'utf8');const hash=s=>createHash('sha256').update(s).digest('hex');
const config=(id,dir,packagedDir)=>({id,label:id,personaDir:dir,memoryFile:join(dir,'90-记忆.md'),packagedDir,seed:true,sync:true,extraText:''});
test('all 15 real packaged presets: seed, user edit, delete tombstone, restart, sync retain bytes',async t=>{
 for(const {id} of BUILTINS)await t.test(id,async()=>{
  const dir=join(base,'presets',id),pack=join(root,id==='deepseek'?'persona':'personas/'+id),c=config(id,dir,pack),d=openDossier(c);await d.compose();
  const names=(await readdir(pack)).filter(n=>n.endsWith('.md'));for(const n of names)assert.equal(await text(join(dir,n)),await text(join(pack,n)));
  const identity=names.find(n=>n.startsWith('00-')),deleted=identity;
  const user='SYNTH_USER_OVERRIDE_'+id+'\n';await writeFile(join(dir,identity),user);await d.reload();assert.match((await d.compose()).text,new RegExp('SYNTH_USER_OVERRIDE_'+id));
  await d.edit({action:'append',category:'memory',text:'SYNTH_MEMORY_'+id});const memory=await text(join(dir,'90-记忆.md'));
  const preserved=openDossier(c);await preserved.compose();await preserved.sync();assert.equal(await text(join(dir,identity)),user);assert.equal(await text(join(dir,'90-记忆.md')),memory);await preserved.edit({action:'delete',file:deleted});const restarted=openDossier(c);await restarted.compose();await restarted.sync();await assert.rejects(text(join(dir,deleted)),{code:'ENOENT'});
  assert.equal(JSON.parse(await text(join(dir,'.kujira-state.json'))).files[deleted].source,'deleted');
 });
});
test('preset version update changes only tracked untouched seed and archives exact prior bytes',async()=>{
 const pack=join(base,'version-pack'),dir=join(base,'version-target');await mkdir(pack);await writeFile(join(pack,'00-test.md'),'V1');const c=config('version',dir,pack);await openDossier(c).compose();await writeFile(join(pack,'00-test.md'),'V2');const d=openDossier(c);await d.compose();assert.equal(await text(join(dir,'00-test.md')),'V2');assert.equal(await text(join(dir,'.kujira-backup','00-test.md.'+hash('V1').slice(0,16)+'.bak')),'V1');await writeFile(join(dir,'00-test.md'),'USER');await writeFile(join(pack,'00-test.md'),'V3');await openDossier(c).compose();assert.equal(await text(join(dir,'00-test.md')),'USER');
});
test('real custom import/create retries preserve orphan files, bindings and memory across restart/unbind',async()=>{
 const dir=join(base,'custom'),c={personasDir:dir,mode:'auto',modelRules:[]};const cat=openCatalog(c);await mkdir(join(dir,'synthetic'),{recursive:true});await writeFile(join(dir,'synthetic','00-用户设定.md'),'EXISTING_ORPHAN');await writeFile(join(dir,'synthetic','90-记忆.md'),'EXISTING_MEMORY');await cat.change({action:'create',persona:'synthetic',name:'Fictional',text:'MUST_NOT_OVERWRITE',model:'fiction-*'},{});assert.equal(await text(join(dir,'synthetic','00-用户设定.md')),'EXISTING_ORPHAN');assert.equal(await text(join(dir,'synthetic','90-记忆.md')),'EXISTING_MEMORY');assert.equal((await openCatalog(c).resolve({model:'fiction-v2'})).id,'synthetic');await assert.rejects(cat.change({action:'create',persona:'synthetic',text:'NO'},{}),/已存在/);await cat.change({action:'unbind',model:'fiction-*'},{});assert.equal(await text(join(dir,'synthetic','90-记忆.md')),'EXISTING_MEMORY');assert.equal((await openCatalog(c).resolve({model:'fiction-v2'})).id,'stella');
});
test('real persona writes: immediate cache, parallel append, unique replacement, backup and external reload',async()=>{
 const dir=join(base,'writes'),d=openDossier(config('synthetic',dir,null));await d.edit({action:'append',file:'00-user.md',text:'UNIQUE_A'});await Promise.all(Array.from({length:20},(_,i)=>d.edit({action:'append',category:'memory',text:'PARALLEL_'+i+'!'})));const r=await d.compose();for(let i=0;i<20;i++)assert.ok(r.text.includes('PARALLEL_'+i+'!'));await d.edit({action:'replace',file:'00-user.md',oldText:'UNIQUE_A',newText:'UNIQUE_B'});assert.match((await d.compose()).text,/UNIQUE_B/);await assert.rejects(d.edit({action:'replace',file:'00-user.md',oldText:'NOT_FOUND',newText:'BAD'}),/匹配 0 次/);await writeFile(join(dir,'00-user.md'),'EXTERNAL');assert.doesNotMatch((await d.compose()).text,/EXTERNAL/);await d.reload();assert.match((await d.compose()).text,/EXTERNAL/);
});
test('legacy migration preserves source hashes, target conflicts, deleted files, nested backups and marker on repeat',async()=>{
 const old=join(base,'legacy'),dir=join(base,'migrated');await mkdir(join(old,'.kujira-backup','nested'),{recursive:true});await mkdir(dir);const originals={'00-身份.md':'LEGACY_ID','90-记忆.md':'LEGACY_MEMORY','20-性格.md':'LEGACY_DELETED'};for(const[n,s]of Object.entries(originals))await writeFile(join(old,n),s);await writeFile(join(old,'.kujira-backup','nested','old.bak'),'BACKUP');await writeFile(join(dir,'00-身份.md'),'TARGET_WINS');await writeFile(join(dir,'.kujira-state.json'),JSON.stringify({custom_field:'KEPT',files:{'20-性格.md':{source:'deleted'}}}));const external=join(base,'external-memory.md');await writeFile(external,'EXTERNAL_WINS');await migrateDeepSeek({legacyDir:old,targetDir:dir,legacyMemoryFile:external});for(const[n,s]of Object.entries(originals))assert.equal(hash(await text(join(old,n))),hash(s));assert.equal(await text(join(dir,'00-身份.md')),'TARGET_WINS');assert.equal(await text(join(dir,'90-记忆.md')),'EXTERNAL_WINS');await assert.rejects(text(join(dir,'20-性格.md')),{code:'ENOENT'});assert.equal(await text(join(dir,'.kujira-backup','nested','old.bak')),'BACKUP');assert.equal(JSON.parse(await text(join(dir,'.kujira-state.json'))).custom_field,'KEPT');assert.equal((await migrateDeepSeek({legacyDir:old,targetDir:dir})).reason,'previously-imported');
});
console.log('SYNTHETIC_DATA_ROOT='+base);
