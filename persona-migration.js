/** Non-destructive one-time import of the legacy DeepSeek directory.
 * Copies existing files before seeding the unified personas/deepseek directory.
 * Already-present files, user edits and deletion markers always win.
 */
import { copyFile, mkdir, readdir, lstat, constants } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

const missing=e=>e?.code==='ENOENT'||e?.code==='ENOTDIR'
async function copyOnce(from,to){
  try {
    const info=await lstat(from)
    if(!info.isFile())return
    await mkdir(dirname(to),{recursive:true})
    await copyFile(from,to,constants.COPYFILE_EXCL)
  }catch(e){if(!missing(e)&&e.code!=='EEXIST')throw e}
}
async function copyBackupFolder(from,to){
  let entries
  try{entries=await readdir(from,{withFileTypes:true})}catch(e){if(missing(e))return;throw e}
  for(const entry of entries){
    if(entry.isDirectory())await copyBackupFolder(join(from,entry.name),join(to,entry.name))
    else if(entry.isFile())await copyOnce(join(from,entry.name),join(to,entry.name))
  }
}
export async function migrateDeepSeek({legacyDir,targetDir,legacyMemoryFile}){
  const old=resolve(legacyDir),target=resolve(targetDir)
  if(old===target)return {target,migrated:false}
  await mkdir(target,{recursive:true})
  let entries
  try{entries=await readdir(old,{withFileTypes:true})}catch(e){if(missing(e))entries=[];else throw e}
  for(const entry of entries){
    const src=join(old,entry.name),dest=join(target,entry.name)
    if(entry.isDirectory()&&entry.name==='.kujira-backup'){
      await copyBackupFolder(src,dest)
    }else if(entry.isFile()&&(entry.name.endsWith('.md')||entry.name==='.kujira-state.json')){
      await copyOnce(src,dest)
    }
  }
  if(legacyMemoryFile){
    const source=resolve(legacyMemoryFile)
    if(source!==join(target,'90-记忆.md')&&(source===old||source.startsWith(old+sep)||source!==join(old,'90-记忆.md')))
      await copyOnce(source,join(target,'90-记忆.md'))
  }
  return {target,migrated:true}
}
