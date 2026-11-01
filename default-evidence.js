/** Retain verified default bytes independently of user edit backups. One baseline per file. */
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {hash,readJSON,atomicJSON,regular} from './migration-state.js'
const valid=e=>e&&typeof e.text==='string'&&hash(e.text)===e.hash
export async function defaultEvidence(config,name,previous,known){
 if(valid(known))return known
 const saved=await readJSON(join(config.personaDir,'.kujira-defaults.json'),{files:{}})
 if(valid(saved.files?.[name]))return saved.files[name]
 if(previous?.source!=='seed'||!(/^[a-f0-9]{64}$/.test(previous.hash??'')))return null
 for(const file of [join(config.personaDir,name),join(config.personaDir,'.kujira-backup',`${name}.${previous.hash.slice(0,16)}.bak`)]){
  if(await regular(file)){const text=await readFile(file,'utf8');if(hash(text)===previous.hash)return{hash:previous.hash,text}}
 }
 return null
}
export async function retainDefaultEvidence(config){
 const state=await readJSON(join(config.personaDir,'.kujira-state.json'),{files:{}}),file=join(config.personaDir,'.kujira-defaults.json'),saved=await readJSON(file,{files:{}}),unavailable=[]
 if(!state.files||typeof state.files!=='object'||Array.isArray(state.files)||!saved.files||typeof saved.files!=='object')throw Error('默认基线状态损坏；清理暂停')
 for(const name of new Set([...Object.keys(state.files),...Object.keys(state.defaultBaselines??{})])){
  if(!/^[^/\\]+\.md$/.test(name)||name.startsWith('.'))continue
  const record=state.files[name],e=await defaultEvidence(config,name,record,state.defaultBaselines?.[name])
  if(e)saved.files[name]=e
  else if(record?.source==='seed')unavailable.push(name)
 }
 if(Object.keys(saved.files).length)await atomicJSON(file,saved)
 return{unavailable}
}
