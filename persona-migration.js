/** One-time, non-destructive import of DeepSeek's legacy persona directory.
 * Existing unified files and deletion markers take precedence. The old directory
 * is retained; no filesystem watcher or periodic migration is installed.
 */
import {copyFile, mkdir, readdir, lstat, readFile, writeFile, rename, constants} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'

const STATE='.kujira-state.json'
const MARKER='.kujira-legacy-migration.json'
const missing=e=>e?.code==='ENOENT'||e?.code==='ENOTDIR'
async function exists(path){try{await lstat(path);return true}catch(e){if(missing(e))return false;throw e}}
async function ownership(dir){try{return JSON.parse(await readFile(join(dir,STATE),'utf8'))?.files??{}}catch(e){if(missing(e)||e instanceof SyntaxError)return {};throw e}}
async function copyOnce(src,dest){
  try{
    if(!(await lstat(src)).isFile())return false
    await mkdir(dirname(dest),{recursive:true})
    await copyFile(src,dest,constants.COPYFILE_EXCL)
    return true
  }catch(e){if(missing(e)||e?.code==='EEXIST')return false;throw e}
}
async function copyBackups(src,dest){
  let entries
  try{entries=await readdir(src,{withFileTypes:true})}catch(e){if(missing(e))return;throw e}
  for(const item of entries){
    if(item.isDirectory())await copyBackups(join(src,item.name),join(dest,item.name))
    else if(item.isFile())await copyOnce(join(src,item.name),join(dest,item.name))
  }
}
export async function migrateDeepSeek({legacyDir,targetDir,legacyMemoryFile}){
  const old=resolve(legacyDir),target=resolve(targetDir)
  if(old===target)return {target,migrated:false,reason:'same-folder'}
  if(await exists(join(target,MARKER)))return {target,migrated:false,reason:'previously-imported'}
  let entries=[]
  try{entries=await readdir(old,{withFileTypes:true})}catch(e){if(!missing(e))throw e}
  const externalMemory=legacyMemoryFile?resolve(legacyMemoryFile):null
  const hasExternal=!!(externalMemory&&await exists(externalMemory))
  if(!entries.length&&!hasExternal)return {target,migrated:false,reason:'no-legacy-data'}
  await mkdir(target,{recursive:true})
  const oldState=await ownership(old),targetState=await ownership(target)
  const deleted=new Set(Object.entries(targetState).filter(([,v])=>v?.source==='deleted').map(([name])=>name))
  const oldDeleted=new Set(Object.entries(oldState).filter(([,v])=>v?.source==='deleted').map(([name])=>name))
  const imported=[]
  for(const item of entries){
    const src=join(old,item.name),dst=join(target,item.name)
    if(item.isDirectory()&&item.name==='.kujira-backup')await copyBackups(src,dst)
    else if(item.isFile()&&item.name.endsWith('.md')&&!item.name.startsWith('.')&&!deleted.has(item.name)&&!oldDeleted.has(item.name)){
      if(await copyOnce(src,dst))imported.push(item.name)
    }
  }
  if(externalMemory&&!deleted.has('90-记忆.md')&&!oldDeleted.has('90-记忆.md')&&await copyOnce(externalMemory,join(target,'90-记忆.md'))){
    imported.push('90-记忆.md')
  }
  // Target ownership state wins; import only missing ownership entries.
  const merged={...oldState,...targetState}
  if(Object.keys(merged).length){
    const statePath=join(target,STATE)
    const original=await exists(statePath)?JSON.parse(await readFile(statePath,'utf8')):{files:{}}
    const next={...original,files:merged}
    const tmp=statePath+'.migration-'+process.pid+'.tmp'
    await writeFile(tmp,JSON.stringify(next,null,2)+'\n','utf8')
    await rename(tmp,statePath)
  }
  const marker=join(target,MARKER),tmp=marker+'.'+process.pid+'.tmp'
  await writeFile(tmp,JSON.stringify({schema:1,completed:true,importedFiles:imported.length})+'\n','utf8')
  await rename(tmp,marker)
  return {target,migrated:true,importedFiles:imported}
}
