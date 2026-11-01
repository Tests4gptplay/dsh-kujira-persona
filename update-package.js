/** Non-active, per-dossier default updates. No timers or recursive prompt scan. */
import {mkdir,readFile,readdir,writeFile,rename,rm,rmdir,lstat,realpath} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
export const UPGRADE='defaults-20261030-v2'
export const NOTICE='98-升级迁移通知-20261030-v2.md'
const HEADER='# 基础设定更新包通知（defaults-20261030-v2）'
const hash=text=>createHash('sha256').update(text).digest('hex')
const exists=async path=>{try{await lstat(path);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
async function safeDir(config,parts,create=false){
 let path=await realpath(config.personaDir)
 for(const part of parts){
  path=join(path,part)
  if(create)await mkdir(path).catch(e=>{if(e.code!=='EEXIST')throw e})
  const st=await lstat(path)
  if(!st.isDirectory()||st.isSymbolicLink())throw new Error('更新目录必须是当前档案内的真实目录，不能经链接转向其他位置')
 }
 return path
}
function packageId(file){
 const parts=String(file??'').split('/')
 if(parts[0]!=='更新'||!/^defaults-[a-zA-Z0-9-]+$/.test(parts[1]??''))throw new Error('只允许更新目录内的明确基础更新包')
 return parts
}
export async function manifestAt(config,id){
 const dir=await safeDir(config,['更新',id]);const path=join(dir,'.manifest.json')
 if((await lstat(path)).isSymbolicLink())throw new Error('更新清单不能是链接')
 const m=JSON.parse(await readFile(path,'utf8'))
 if(m.id!==id||!Array.isArray(m.files)||m.files.some(f=>typeof f!=='string'||!(/^(清单\.md|(?:新版|旧版)\/[^/\\]+\.md)$/.test(f))))throw new Error('无效的基础更新包清单')
 return {dir,m}
}
export async function listUpdate(config,file='更新'){
 if(file==='更新'){
  let dir;try{dir=await safeDir(config,['更新'])}catch(e){if(e.code==='ENOENT')return[];throw e}
  return (await readdir(dir,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^defaults-[a-zA-Z0-9-]+$/.test(e.name)).map(e=>({file:`更新/${e.name}`,kind:'update-package'}))
 }
 const parts=packageId(file);if(parts.length!==2)throw new Error('list 使用更新包目录')
 const {dir,m}=await manifestAt(config,parts[1]);const files=[]
 for(const name of m.files)if(await exists(join(dir,name)))files.push({file:`${file}/${name}`,kind:'update-reference'})
 return files
}
export async function readUpdate(config,file){
 const parts=packageId(file),id=parts[1],name=parts.slice(2).join('/')
 const {dir,m}=await manifestAt(config,id);if(!m.files.includes(name))throw new Error('文件不在此更新包清单内')
 const folders=parts.slice(2,-1);await safeDir(config,['更新',id,...folders])
 const path=join(dir,name);if(!(await lstat(path)).isFile()||(await lstat(path)).isSymbolicLink())throw new Error('更新参照必须是普通文件')
 return {path,realPath:await realpath(path),text:await readFile(path,'utf8')}
}
export async function deleteUpdate(config,file){
 const parts=packageId(file);if(parts.length!==2)throw new Error('只能精确清理本次基础更新包，不删除整个更新目录或其他更新包')
 let loaded
 try { loaded=await manifestAt(config,parts[1]) }
 catch(error){
  if(error.code!=='ENOENT')throw error
  if(parts[1]!==UPGRADE&&!config.verifiedUpdateIds?.includes(parts[1]))throw new Error('未知更新包，不能猜测删除范围')
  // Resume cleanup interrupted after the manifest removal. An empty known
  // package directory (or one already absent) needs no recursive deletion.
  let dir
  try{dir=await safeDir(config,['更新',parts[1]])}catch(e){if(e.code==='ENOENT')return {removed:true,note:'本次更新包已不存在；其他内容未改动。'};throw e}
  if((await readdir(dir)).length)throw new Error('更新包缺少清单但仍有内容；已保留，不能猜测删除范围')
  await rmdir(dir);return {removed:true,note:'已完成中断后的空包目录清理；其他更新包保留。'}
 }
 const {dir,m}=loaded
 // Validate all paths before the first deletion. Never follow nested links.
 for(const name of m.files){
  try{await readUpdate(config,`${file}/${name}`)}catch(e){if(e.code!=='ENOENT')throw e}
 }
 for(const name of m.files)await rm(join(dir,name),{force:true})
 for(const sub of ['新版','旧版'])await rmdir(join(dir,sub)).catch(e=>{if(!['ENOENT','ENOTEMPTY'].includes(e.code))throw e})
 // Preserve unknown/user-added content; do not recursively remove the package.
 const remaining=(await readdir(dir)).filter(n=>n!=='.manifest.json')
 if(remaining.length)return {removed:false,note:'本次清单内更新文件已删除；包内另有未列入清单的内容，已保留，请确认后再处理。'}
 await rm(join(dir,'.manifest.json'));await rmdir(dir)
 return {removed:true,note:'本次基础更新包已精确清理；其他更新包与更新目录保留。请确认迁移已保存，再仅删除本条升级通知。'}
}
async function publishText(path,text){
 const tmp=`${path}.${randomUUID()}.tmp`
 try{await writeFile(tmp,text,{encoding:'utf8',flag:'wx'});if(await exists(path))return false;await rename(tmp,path);return true}
 finally{await rm(tmp,{force:true}).catch(()=>{})}
}
export async function prepareUpdate(config,state,references){
 if(config.sync===false||state.recoveryUnsaved)return
 const notices=state.upgradeNotices??={},record=notices[UPGRADE],noticePath=join(config.personaDir,NOTICE)
 if(record){
  return
 }
 // No differences means no package. First install also supplies references,
 // so empty active files are initialized by the same explicit AI workflow.
 if(!references.length)return
 const root=await safeDir(config,['更新'],true),dest=join(root,UPGRADE)
 let manifest
 if(await exists(dest)){
  const loaded=await manifestAt(config,UPGRADE);manifest=loaded.m
 }else{
  const temp=join(root,`.${UPGRADE}.${randomUUID()}.tmp`);await mkdir(temp)
  try{
   await mkdir(join(temp,'新版'));await mkdir(join(temp,'旧版'))
   const files=['清单.md'],entries=[]
   for(const r of references){
    const fresh=`新版/${r.name}`;files.push(fresh);await writeFile(join(temp,fresh),r.text,'utf8')
    let baseline=null
    if(r.baseline!==null){baseline=`旧版/${r.name}`;files.push(baseline);await writeFile(join(temp,baseline),r.baseline,'utf8')}
    entries.push({file:r.name,new:fresh,newHash:hash(r.text),baseline,baselineHash:baseline?hash(r.baseline):null,baselineSource:r.baselineSource??'unavailable'})
   }
   manifest={schema:1,id:UPGRADE,files,entries}
   const guide=['# 本次基础更新包',
    '这里只是未激活的基础更新参照，不是活动人设。以现有档案为主体，逐文件比较当前原文、可靠旧基础（如有）与新版。把新版基础小增量合并进现有档案，只替换对应旧默认片段，不另起新档案搬回用户积累；不要修改用户自定义，矛盾以自定义为主。不能确定是否为自定义的内容优先保留，不要凭混合正文猜旧基础。',
    ...entries.map(e=>`- 原文件：${e.file}；新版：${e.new}；${e.baseline?`可靠旧基础：${e.baseline}；来源：${e.baselineSource}；SHA256：${e.baselineHash}`:'旧基础不可可靠恢复：保留不确定的自定义内容，使用新版作补充参照，不强行覆盖。'}`),
    '全部修改保存并重新读取确认后，精确删除本更新包和本条通知；未完成时保留以便接续。'].join('\n\n')+'\n'
   await writeFile(join(temp,'清单.md'),guide,'utf8');await writeFile(join(temp,'.manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8')
   if(await exists(dest))throw new Error('更新包目标已存在，保留已有内容并待下次重试')
   await rename(temp,dest)
  }finally{await rm(temp,{recursive:true,force:true}).catch(()=>{})}
 }
 // Existing published package is the recovery source after interruption;
 // never reconstruct/overwrite it from a later mixed active document.
 const scope=config.kind==='world'?'world':'persona'
 const text=[HEADER,
 '请读取更新文件夹中的本次基础更新包。以用户现有档案为主体，把新版基础内容小增量合并进去，只替换对应旧默认片段；不要把用户所有自定义迁移到另起的新档案。不要修改用户自定义设定；与自定义人设矛盾时以自定义为主。无法确认是否属于自定义的内容优先保留，不猜测旧基础。',
 `范围仅限当前档案 ${config.personaDir}。persona_edit 使用 scope=${scope}${scope==='persona'?`、persona=${config.id}`:''}；action=list、file=更新/${UPGRADE} 列出参照；action=read、file=更新/${UPGRADE}/清单.md 读取来源与对应文件。新版不会自动注入活动人设。`,
 '首次安装且档案为空时，将包内基础内容创建到对应原文件位置即可；若已有同名内容先读取，不能按空目录处理。已有档案始终保留为主体。',
 '使用原有原文件的 read/replace/append（缺失新文件可用 create）逐项迁移；先保存并重新读取确认。只阅读过、迁移中断或仍有未完成项时，不删除更新包和通知。',
 `全部完成后，action=delete_update、file=更新/${UPGRADE} 只清理本次包；再 action=delete、file=${NOTICE} 仅删除本条通知，不删除整个更新目录或其他包。`,
 '若 AI 编辑权限关闭或无编辑工具，保留待处理并告知用户，不绕过权限。'].join('\n\n')+'\n'
 if(await exists(noticePath)){
  const info=await lstat(noticePath);if(!info.isFile()||info.isSymbolicLink()||!(await readFile(noticePath,'utf8')).startsWith(HEADER+'\n'))throw new Error('升级通知同名目标已存在，保留原文件')
 }else if(!await publishText(noticePath,text))throw new Error('升级通知目标已存在，待下次同步检查')
 notices[UPGRADE]={status:'pending',file:NOTICE,package:`更新/${UPGRADE}`}
}

/** Explicit audit recovery when an older notice/record survives but its package is gone.
 * This is a new comparison against installed defaults, never a claim to recover
 * missing old bytes or to prove a previously completed merge.
 */
export async function rebuildMissingUpdate(config,id){
 if(!/^defaults-[a-zA-Z0-9-]+$/.test(id)||!config.packagedDir)throw Error('没有可信的随包默认来源')
 const {readJSON}=await import('./migration-state.js'),{defaultEvidence}=await import('./default-evidence.js')
 const state=await readJSON(join(config.personaDir,'.kujira-state.json'),{files:{}}),root=await safeDir(config,['更新'],true),dest=join(root,id)
 if(await exists(dest))throw Error('已有完整或半成更新包，保留原证据；不能覆盖重建')
 const temp=join(root,`.${id}.${randomUUID()}.tmp`);await mkdir(temp)
 try{
  await mkdir(join(temp,'新版'));await mkdir(join(temp,'旧版'));const files=['清单.md'],entries=[]
  for(const name of (await readdir(config.packagedDir)).filter(n=>n.endsWith('.md')&&!n.startsWith('.')).sort()){
   const text=await readFile(join(config.packagedDir,name),'utf8'),baseline=await defaultEvidence(config,name,state.files?.[name],state.defaultBaselines?.[name]),fresh='新版/'+name,old=baseline?'旧版/'+name:null
   await writeFile(join(temp,fresh),text);files.push(fresh);if(old){await writeFile(join(temp,old),baseline.text);files.push(old)}
   entries.push({file:name,new:fresh,newHash:hash(text),baseline:old,baselineHash:baseline?.hash??null,baselineSource:baseline?'独立验证的默认依据':'原更新包缺失，旧基础不可可靠恢复'})
  }
  if(!entries.length)throw Error('随包默认来源为空，不能重建比较')
  await writeFile(join(temp,'清单.md'),'# 缺失更新证据的重新核对\n原更新包已缺失，不能证明旧迁移完成。以下新版来自当前安装包；不是丢失旧包的复原。逐文件读取当前档案与这里的比较依据，保留自定义；无可靠旧基础时不得猜测覆盖。\n')
  await writeFile(join(temp,'.manifest.json'),JSON.stringify({schema:1,id,files,entries,reconstructedAudit:true})+'\n');if(await exists(dest))throw Error('目标已存在');await rename(temp,dest)
 }finally{await rm(temp,{recursive:true,force:true})}
 return{rebuilt:true,note:'已创建当前默认版本的重新核对参照；未恢复未知旧版，也未标记迁移完成。'}
}
