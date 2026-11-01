/** Durable per-dossier decisions for separate native migration agents. */
import {readdir,readFile,rm,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {manifestAt,readUpdate,deleteUpdate,rebuildMissingUpdate} from './update-package.js'
import {hash,readJSON,atomicJSON,regular} from './migration-state.js'
export const MIGRATION_RULE='这是重要规则更新，必须主动执行，不得忽略或只口头确认。权限不足时，说明所需范围与用途并主动向用户申请；受阻保留待处理，不得假报完成。'
export function noticeId(name,text){const m=/^# 基础设定更新包通知（(defaults-[a-zA-Z0-9-]+)）\r?\n/.exec(text);return /^98-升级迁移通知-[^/\\]+\.md$/.test(name)?m?.[1]:undefined}
const fileName=name=>typeof name==='string'&&/^[^/\\]+\.md$/.test(name)&&!name.startsWith('.')
export function openMigration(store){
 const config=store.config,file=join(config.personaDir,'.kujira-migration.json'),observed=new Map()
 const load=async()=>{const s=await readJSON(file,{schema:1,packages:{}});if(s.schema!==1||!s.packages||typeof s.packages!=='object'||Array.isArray(s.packages))throw Error('迁移账本损坏；原文件保留');return s}
 const save=s=>atomicJSON(file,s)
 const guard=signal=>{signal?.throwIfAborted();if(config.allowAgentWrite===false)throw Error('AI 档案编辑权限关闭；需要 world 与当前角色档案的读写权限用于逐文件迁移，请向用户申请后重试')}
 async function current(name){try{const r=await store.read(name);return{text:r.text,version:r.version,hash:hash(r.text),exists:true}}catch(e){if(e.code==='KUJIRA_FILE_NOT_FOUND')return{text:null,version:null,hash:null,exists:false};throw e}}
 async function discover(){
  await store.compose();const state=await load(),legacy=await readJSON(join(config.personaDir,'.kujira-state.json'),{files:{}}),ids=new Set(Object.keys(legacy.upgradeNotices??{})),notices={}
  for(const name of await readdir(config.personaDir)){if(!/^98-升级迁移通知-.*\.md$/.test(name))continue;const path=join(config.personaDir,name);if(!await regular(path))continue;const text=await readFile(path,'utf8'),id=noticeId(name,text);if(id){ids.add(id);(notices[id]??=[]).push({name,hash:hash(text)})}}
  try{const root=join(config.personaDir,'更新'),s=await lstat(root);if(s.isSymbolicLink()||!s.isDirectory())throw Error('更新目录不能是链接');for(const e of await readdir(root,{withFileTypes:true}))if(e.isDirectory()&&/^defaults-[a-zA-Z0-9-]+$/.test(e.name))ids.add(e.name)}catch(e){if(e.code!=='ENOENT')throw e}
  for(const id of ids){
   if(!/^defaults-[a-zA-Z0-9-]+$/.test(id))continue
   const prior=state.packages[id];if(prior?.status==='completed')continue
   if(prior?.status==='verified'||prior?.status==='cleanup_pending'){prior.notices=notices[id]??prior.notices;continue}
   try{
    const {m}=await manifestAt(config,id)
    if(!Array.isArray(m.entries)||!m.entries.length||new Set(m.entries.map(e=>e.file)).size!==m.entries.length||m.entries.some(e=>!fileName(e.file)||e.new!==`新版/${e.file}`||!m.files.includes(e.new)||!/^[a-f0-9]{64}$/.test(e.newHash??'')||(e.baseline!==null&&(e.baseline!==`旧版/${e.file}`||!m.files.includes(e.baseline)||!/^[a-f0-9]{64}$/.test(e.baselineHash??'')))))throw Error('更新包缺少可靠的逐文件清单')
    const digest=hash(JSON.stringify(m));state.packages[id]={status:'pending',manifestHash:digest,entries:m.entries,files:m.files,decisions:prior?.manifestHash===digest?prior.decisions??{}:{},notices:notices[id]??[],problem:null}
   }catch(e){state.packages[id]={...prior,status:'needs_review',notices:notices[id]??[],problem:'更新证据缺失或损坏；通知/包消失不能证明已合并：'+e.message}}
  }
  if(ids.size)await save(state)
  return Object.entries(state.packages).filter(([,p])=>p.status!=='completed').map(([id,p])=>({id,status:p.status,files:p.entries?.map(e=>e.file)??[],decisions:p.decisions??{},problem:p.problem??null}))
 }
 async function inspect(id,name){
  const s=await load(),p=s.packages[id],e=p?.entries?.find(e=>e.file===name);if(!e||p.status==='needs_review')throw Error('文件不在可处理更新清单中')
  const now=await current(name),fresh=(await readUpdate(config,`更新/${id}/${e.new}`)).text,old=e.baseline?(await readUpdate(config,`更新/${id}/${e.baseline}`)).text:null
  if(hash(fresh)!==e.newHash||(old!==null&&hash(old)!==e.baselineHash))throw Error('更新参照已改变，保留待处理')
  observed.set(id+'\0'+name,now)
  return{file:name,current:now.text,new_default:fresh,old_default:old,baseline:old===null?'unavailable: 无可靠旧基础，保留不确定的自定义，不猜测替换':'verified',prior_decision:p.decisions[name]??null}
 }
 async function edit(id,args,signal){guard(signal);const key=id+'\0'+args.file,r=observed.get(key);if(!r)throw Error('先 inspect 当前文件及旧/新默认依据，再修改');if(!['replace','append','delete','create'].includes(args.action))throw Error('不支持的迁移写入');await store.edit(args,{expectedHash:r.version,signal,guard:()=>config.allowAgentWrite!==false});observed.delete(key);return{saved:true,next:'必须重新 inspect 回读，再 record 决策'} }
 async function record(id,name,decision,reason,signal){
  guard(signal);if(!['merged','already_satisfied','preserve_custom_conflict'].includes(decision)||typeof reason!=='string'||!reason.trim())throw Error('需要合法逐文件决策与具体理由')
  const seen=observed.get(id+'\0'+name);if(!seen)throw Error('先 inspect 回读当前文件与默认差异')
  const s=await load(),p=s.packages[id];if(!p?.entries?.some(e=>e.file===name))throw Error('未知更新文件')
  const now=await current(name);if(now.version!==seen.version)throw Error('档案在回读后改变，请重新 inspect')
  p.decisions[name]={decision,reason,hash:now.hash};p.status='pending';await save(s);return{recorded:true}
 }
 async function finish(id,signal){
  guard(signal);const s=await load(),p=s.packages[id];if(p?.status==='completed')return{completed:true};if(!p?.entries?.length||p.status==='needs_review')throw Error('证据不足，不能完成迁移')
  for(const e of p.entries){const d=p.decisions?.[e.file];if(!d||!['merged','already_satisfied','preserve_custom_conflict'].includes(d.decision)||(await current(e.file)).hash!==d.hash)throw Error('存在未决或回读后改变的档案：'+e.file)}
  const resuming=['verified','cleanup_pending'].includes(p.status)
  try{const {m}=await manifestAt(config,id);if(hash(JSON.stringify(m))!==p.manifestHash)throw Error('更新包清单在决策后改变；不能清理')}catch(e){if(!resuming||e.code!=='ENOENT')throw e}
  if(!resuming){
   for(const e of p.entries){if(hash((await readUpdate(config,`更新/${id}/${e.new}`)).text)!==e.newHash)throw Error('新版参照已改变');if(e.baseline&&hash((await readUpdate(config,`更新/${id}/${e.baseline}`)).text)!==e.baselineHash)throw Error('旧版参照已改变')}
  }
  p.status='verified';await save(s);guard(signal)
  const result=await deleteUpdate({...config,verifiedUpdateIds:[id]},`更新/${id}`)
  if(!result.removed){p.status='cleanup_pending';await save(s);return{completed:false,note:result.note}}
  for(const n of p.notices??[]){guard(signal);const path=join(config.personaDir,n.name);if(!await regular(path))continue;const text=await readFile(path,'utf8');if(hash(text)!==n.hash||noticeId(n.name,text)!==id){p.status='cleanup_pending';await save(s);return{completed:false,note:'通知已被修改，保留待核对'}}await rm(path)}
  guard(signal);p.status='completed';await save(s);await store.reload();return{completed:true,decisions:p.decisions}
 }
 async function rebuild(id,signal){guard(signal);const s=await load();if(s.packages[id]?.status!=='needs_review')throw Error('仅对账本中证据缺失的既有更新进行重新核对');const result=await rebuildMissingUpdate(config,id);await discover();return result}
 return{discover,inspect,edit,record,finish,rebuild}
}
