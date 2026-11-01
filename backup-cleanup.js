/** One-time exact-inventory cleanup. No automatic deletion or retention policy. */
import {readFile,readdir,lstat,rm,realpath} from 'node:fs/promises'
import {join,resolve,dirname,basename} from 'node:path'
import {hash,readJSON,atomicJSON,regular} from './migration-state.js'
import {parseCatalog} from './catalog.js'
import {retainDefaultEvidence} from './default-evidence.js'
const RECOVERED=/^(\.kujira-(?:state|catalog|legacy-migration)\.json|kujira-diary(?:-sleep)?\.json|receipts\.json|receipt-[a-f0-9]{64}\.json|\d{4}-\d{2}-\d{2}(?:\.pending(?:-[a-f0-9]{64})?)?\.(?:json|md))\.recovered-([a-f0-9]{12}|[a-f0-9]{16}|[a-f0-9-]{36})\.bak$/
export function openBackupCleanup({home,configs,diaryDirectory}){
 const ledger=join(home,'.kujira-backup-cleanup.json')
 async function inventory(){
  const saved=await readJSON(ledger,{status:'pending'});if(saved.status==='completed')return{completed:true,files:[],unresolved:[]}
  const files=[],unresolved=[],baselines=[];const roots=new Set([resolve(home)])
  async function folder(path){try{const s=await lstat(path);if(s.isSymbolicLink()||!s.isDirectory())throw Error('清理范围目录不能是链接：'+path);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
  async function add(path,producer){if(!await regular(path))return;const text=await readFile(path,'utf8');files.push({path,hash:hash(text),bytes:Buffer.byteLength(text),producer})}
  for(const c of configs){if(!await folder(c.personaDir))continue;const result=await retainDefaultEvidence(c);baselines.push({directory:c.personaDir,...result});roots.add(resolve(c.personaDir));const dir=join(c.personaDir,'.kujira-backup');if(!await folder(dir))continue
   const names=await readdir(dir),pairs=new Set()
   for(const name of names){const m=/^([^/\\]+\.md)\.([a-f0-9]{16})\.bak$/.exec(name),p=join(dir,name);if(!m){continue}if(!await regular(p))continue;const raw=await readFile(p,'utf8');if(hash(raw).startsWith(m[2])){await add(p,'dossier hash backup');pairs.add(m[1])}else unresolved.push({path:p,reason:'历史备份名称与内容校验不符，需确认生成来源',reviewable:true})}
   for(const name of names){if(/^.+\.md\.[a-f0-9]{16}\.bak$/.test(name))continue;const p=join(dir,name);if(pairs.has(name)&&await regular(p)){const body=await readFile(p,'utf8');if(files.some(f=>dirname(f.path)===dir&&f.path.startsWith(join(dir,name)+'.')&&f.hash===hash(body))){await add(p,'paired dossier fixed copy');continue}}unresolved.push({path:p,reason:'不能凭名称证明是插件生成的副本；未纳入删除',reviewable:/^[^.][^/\\]*\.md$/.test(name)})}
  }
  if(diaryDirectory&&await folder(diaryDirectory))for(const e of await readdir(diaryDirectory,{withFileTypes:true})){if(!e.isDirectory()||!(/^[a-z][a-z0-9-]*$/.test(e.name)))continue;const dir=join(diaryDirectory,e.name);roots.add(dir);for(const sub of ['index','short','sleep'])if(await folder(join(dir,sub)))roots.add(join(dir,sub))}
  for(const root of roots){if(!await folder(root))continue;for(const name of await readdir(root)){
   const path=join(root,name),match=RECOVERED.exec(name)
   if(match){if(!await regular(path))continue;const raw=await readFile(path,'utf8');if(match[2].length!==36&&hash(raw).startsWith(match[2]))await add(path,'content-verified recovered metadata');else unresolved.push({path,reason:'旧 UUID 或校验不符副本缺少可核验来源，需用户确认其确为插件生成备份',reviewable:true})}
   if(name==='.kujira-catalog.json.last-good.json'){
    // The old producer emitted only the validated catalog schema here.
    const value=await readJSON(path,null);const current=await readJSON(join(root,'.kujira-catalog.json'),null).catch(()=>null);if(value&&current&&parseCatalog(JSON.stringify(value)).valid&&parseCatalog(JSON.stringify(current)).valid)await add(path,'legacy catalog last-good');else unresolved.push({path,reason:'原绑定文件尚未修复，或旧副本结构不符；不能删除仍用于恢复的依据'})
   }
   if(name==='diary.legacy.md'){
    const current=join(root,'Diary.md');if(await regular(current)&&await regular(path)){
     const old=await readFile(path,'utf8'),body=await readFile(current,'utf8');if(old&&body.startsWith(old)&&body!==old){await add(path,'legacy diary prefix retained in canonical diary');continue}
    }
    unresolved.push({path,reason:'可能是唯一正式旧日记，不能当作可删除备份'})
   }
  }}
  // An interrupted approved pass retains exact provenance for its remaining files.
  if(saved.status==='deleting'&&Array.isArray(saved.files))for(const item of saved.files){
   if(typeof item.path!=='string'||!roots.has(dirname(item.path))&&!configs.some(c=>dirname(item.path)===join(c.personaDir,'.kujira-backup')))continue
   const name=basename(item.path);if(!RECOVERED.test(name)&&!(basename(dirname(item.path))==='.kujira-backup'&&/^[^.][^/\\]*\.md(?:\.[a-f0-9]{16}\.bak)?$/.test(name)))continue
   if(await regular(item.path)&&hash(await readFile(item.path,'utf8'))===item.hash){await add(item.path,'interrupted exact inventory');const index=unresolved.findIndex(x=>x.path===item.path);if(index>=0)unresolved.splice(index,1)}
  }
  files.sort((a,b)=>a.path.localeCompare(b.path));const unique=[...new Map(files.map(f=>[f.path,f])).values()]
  for(const item of unresolved)if(item.reviewable){if(await regular(item.path)){const text=await readFile(item.path,'utf8');item.hash=hash(text);item.bytes=Buffer.byteLength(text)}else item.reviewable=false}
  const fingerprint=hash(JSON.stringify([unique,unresolved]))
  return{completed:false,paused:saved.status==='paused'&&(unique.length>0||unresolved.length>0)&&(!saved.fingerprint||saved.fingerprint===fingerprint),files:unique,unresolved,baselines,fingerprint}
 }
 async function cleanup(expected,approve,signal,reviewed=[],retry=false){
  signal?.throwIfAborted();const found=await inventory();if(found.completed)return found
  if(found.paused&&!retry)return{completed:false,status:'paused',note:'这份清单的删除已被拒绝；范围变化或用户明确重新请求后再申请'}
  if(found.fingerprint!==expected)throw Error('备份清单已变化，请重新列出确切范围并确认')
  if(!Array.isArray(reviewed)||reviewed.some(path=>!found.unresolved.some(f=>f.path===path&&f.reviewable)))throw Error('仅允许确认清单中待核验的旧备份来源，不接受其他路径')
  const selected=[...found.files,...found.unresolved.filter(f=>reviewed.includes(f.path)).map(f=>({path:f.path,hash:f.hash,bytes:f.bytes,producer:'user must attest plugin-generated backup'}))]
  if(selected.length){const result=await approve({...found,files:selected,ownershipConfirmation:reviewed});signal?.throwIfAborted();if(result!=='allowed-once'){await atomicJSON(ledger,{status:result==='rejected'?'paused':'pending',outcome:result,fingerprint:found.fingerprint});return{completed:false,status:result,files:found.files,unresolved:found.unresolved}}
   // Revalidate the approved list and baseline extraction after the approval wait.
   const check=await inventory();if(check.fingerprint!==found.fingerprint)throw Error('确认后备份内容或范围改变；本次不删除')
   await atomicJSON(ledger,{status:'deleting',files:selected})
   for(const f of selected){signal?.throwIfAborted();const parent=await realpath(dirname(f.path));if(parent!==resolve(dirname(f.path)))throw Error('清理路径已改变');if(!await regular(f.path)||hash(await readFile(f.path,'utf8'))!==f.hash)throw Error('备份在删除前改变；保留待处理');await rm(f.path)}
  }
  const remaining=await inventory(),completed=!remaining.files.length&&!remaining.unresolved.length
  await atomicJSON(ledger,{status:completed?'completed':'needs_review',unresolved:remaining.unresolved})
  return{completed,status:completed?'completed':'needs_review',removed:selected.map(f=>f.path),unresolved:remaining.unresolved}
 }
 return{inventory,cleanup}
}
