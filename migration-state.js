/** Atomic current metadata; never writes previous versions or history copies. */
import {readFile,writeFile,rename,rm,lstat} from 'node:fs/promises'
import {randomUUID,createHash} from 'node:crypto'
export const hash=text=>createHash('sha256').update(text).digest('hex')
export const missing=e=>e?.code==='ENOENT'
export async function regular(path){try{const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error('迁移文件不能使用链接或特殊文件：'+path);return true}catch(e){if(missing(e))return false;throw e}}
export async function readJSON(path,fallback){if(!await regular(path))return structuredClone(fallback);return JSON.parse(await readFile(path,'utf8'))}
export async function atomicJSON(path,value){await regular(path);const text=JSON.stringify(value,null,2)+'\n';if(await regular(path)&&await readFile(path,'utf8')===text)return;const tmp=path+'.'+randomUUID()+'.tmp';try{await writeFile(tmp,text,{flag:'wx',mode:0o600});await rename(tmp,path)}finally{await rm(tmp,{force:true})}}
