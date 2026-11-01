/** One-time, non-destructive import of DeepSeek's legacy persona directory.
 * Existing unified files and deletion markers take precedence. The old directory
 * is retained; no filesystem watcher or periodic migration is installed.
 */
import {copyFile, mkdir, readdir, lstat, readFile, writeFile, rename, rm, constants} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'

const STATE='.kujira-state.json'
const MARKER='.kujira-legacy-migration.json'
const missing=e=>e?.code==='ENOENT'||e?.code==='ENOTDIR'
async function exists(path){try{await lstat(path);return true}catch(e){if(missing(e))return false;throw e}}
async function atomic(path,text){
  const tmp=path+'.'+randomUUID()+'.tmp'
  try{await writeFile(tmp,text,{encoding:'utf8',flag:'wx'});await rename(tmp,path)}
  finally{await rm(tmp,{force:true})}
}
async function stateAt(dir,preserveInvalid=true){
  const path=join(dir,STATE);let raw
  try{raw=await readFile(path,'utf8')}catch(e){if(missing(e))return{files:{}};throw e}
  try{const value=JSON.parse(raw);if(value&&typeof value==='object'&&!Array.isArray(value)&&value.files&&typeof value.files==='object'&&!Array.isArray(value.files))return value}catch{}
  // The legacy source is never replaced; reading it must not require write access.
  if(preserveInvalid)throw new Error('目标档案状态损坏；请修复原状态文件后继续迁移')
  return{files:{}}
}
async function copyOnce(src,dest){
  try{
    if(!(await lstat(src)).isFile())return false
    await mkdir(dirname(dest),{recursive:true})
    await copyFile(src,dest,constants.COPYFILE_EXCL)
    return true
  }catch(e){if(missing(e)||e?.code==='EEXIST')return false;throw e}
}
export async function migrateDeepSeek({legacyDir,targetDir,legacyMemoryFile}){
  const old=resolve(legacyDir),target=resolve(targetDir)
  if(old===target)return {target,migrated:false,reason:'same-folder'}
  const marker=join(target,MARKER)
  if(await exists(marker)){
    const raw=await readFile(marker,'utf8');let value
    try{value=JSON.parse(raw)}catch{}
    if(value?.completed===true)return {target,migrated:false,reason:'previously-imported'}
    if(!value || value.completed!==false)throw new Error('迁移记录损坏；保留原文件，未完成迁移')
  }
  let entries=[]
  try{entries=await readdir(old,{withFileTypes:true})}catch(e){if(!missing(e))throw e}
  const externalMemory=legacyMemoryFile?resolve(legacyMemoryFile):null
  const hasExternal=!!(externalMemory&&await exists(externalMemory))
  if(!entries.length&&!hasExternal)return {target,migrated:false,reason:'no-legacy-data'}
  await mkdir(target,{recursive:true})
  const oldRecord=await stateAt(old,false),targetRecord=await stateAt(target)
  const oldState=oldRecord.files,targetState=targetRecord.files
  const deleted=new Set(Object.entries(targetState).filter(([,v])=>v?.source==='deleted').map(([name])=>name))
  const oldDeleted=new Set(Object.entries(oldState).filter(([,v])=>v?.source==='deleted').map(([name])=>name))
  const imported=[]
  // Default references are merge evidence, not user-file backups. Transfer only
  // verified seed bytes before leaving the old backup directory in place.
  const baselines={...targetRecord.defaultBaselines}
  const hash=text=>createHash('sha256').update(text).digest('hex')
  for(const [name,record] of Object.entries(oldState)){
    if(!/^[^/\\]+\.md$/.test(name)||name.startsWith('.')||baselines[name])continue
    const known=oldRecord.defaultBaselines?.[name]
    if(known&&typeof known.text==='string'&&hash(known.text)===known.hash){baselines[name]=known;continue}
    if(record?.source!=='seed'||!(/^[a-f0-9]{64}$/.test(record.hash??'')))continue
    for(const path of [join(old,name),join(old,'.kujira-backup',name+'.'+record.hash.slice(0,16)+'.bak')]){
      try{const text=await readFile(path,'utf8');if(hash(text)===record.hash){baselines[name]={hash:record.hash,text};break}}
      catch(e){if(!missing(e))throw e}
    }
  }
  // Explicit memory configuration wins over the legacy default; existing target data still wins.
  if(externalMemory&&!deleted.has('90-记忆.md')&&!oldDeleted.has('90-记忆.md')&&await copyOnce(externalMemory,join(target,'90-记忆.md'))){
    imported.push('90-记忆.md')
  }
  for(const item of entries){
    const src=join(old,item.name),dst=join(target,item.name)
    if(item.isFile()&&item.name.endsWith('.md')&&!item.name.startsWith('.')&&!deleted.has(item.name)&&!oldDeleted.has(item.name)){
      if(await copyOnce(src,dst))imported.push(item.name)
    }
  }
  // Target ownership state wins; import only missing ownership entries.
  const merged={...oldState,...targetState}
  if(Object.keys(merged).length){
    const statePath=join(target,STATE)
    const next={...targetRecord,files:merged,...Object.keys(baselines).length?{defaultBaselines:baselines}:{}}
    await atomic(statePath,JSON.stringify(next,null,2)+'\n')
  }
  await atomic(marker,JSON.stringify({schema:1,completed:true,importedFiles:imported.length})+'\n')
  return {target,migrated:true,importedFiles:imported}
}
