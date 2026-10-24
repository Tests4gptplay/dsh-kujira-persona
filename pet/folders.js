/** On-demand local persona folder browser. No watchers or background traversal. */
import { mkdir, readdir, lstat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { BUILTINS } from '../catalog.js'

const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(id)
const inside=(path,parent)=>path===parent||path.startsWith(parent+sep)
const existsError=e=>e?.code==='ENOENT'||e?.code==='ENOTDIR'

/** Counts regular file sizes without following symlinks (including backups and metadata). */
export async function directoryBytes(directory){
  if(!directory)return 0
  let sum=0
  const pending=[directory]
  while(pending.length){
    const path=pending.pop()
    let entries
    try{entries=await readdir(path,{withFileTypes:true})}catch(e){if(existsError(e))continue;throw e}
    for(const entry of entries){
      const file=join(path,entry.name)
      if(entry.isDirectory()){pending.push(file);continue}
      if(!entry.isFile())continue // Links and special files are outside persona storage totals.
      try{const st=await lstat(file);sum+=st.size}catch(e){if(!existsError(e))throw e}
    }
  }
  return sum
}

function openInFileManager(path,{platform=process.platform,launch=spawn}={}){
  const command=platform==='win32'?'explorer.exe':platform==='darwin'?'open':'xdg-open'
  if(!['win32','darwin','linux'].includes(platform))throw new Error('当前系统暂无文件夹打开方式，可复制路径后打开。')
  if(platform==='linux'&&!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY)throw new Error('当前宿主没有图形桌面；请在运行 DSH 的电脑上查看此路径。')
  return new Promise((resolve,reject)=>{
    let child
    try{child=launch(command,[path],{detached:true,stdio:'ignore',windowsHide:false})}catch(e){reject(e);return}
    child.once('error',reject)
    child.once('spawn',()=>{child.unref?.();resolve()})
  })
}

export function createFolderBrowser({worldDir,personasDir,sharedDir='',catalog,ensureFolder,ensureSeeded,platform,launch}){
  const roots={world:resolve(worldDir),personas:resolve(personasDir),...(sharedDir?{shared:resolve(sharedDir)}:{})}
  const resolveFolder=id=>{
    if(id==='persona')return resolve(roots.personas,'deepseek') // legacy settings action alias
    if(Object.hasOwn(roots,id))return roots[id]
    if(typeof id==='string'&&id.startsWith('role:')&&validId(id.slice(5))){
      const target=resolve(roots.personas,id.slice(5))
      if(inside(target,roots.personas))return target
    }
    return null
  }
  async function characterRows(){
    const listed=(await catalog.list()).personas
    const roles=new Map([...BUILTINS,...listed].map(p=>[p.id,{id:p.id,label:p.label}]))
    const order=[...BUILTINS.map(x=>x.id),...listed.map(x=>x.id)]
    return [...new Set(order)].filter(validId).map(id=>({id:'role:'+id,label:roles.get(id)?.label??id,path:resolveFolder('role:'+id)}))
  }
  async function list(){
    await ensureSeeded?.()
    const rows=await characterRows()
    const values=await Promise.all([
      directoryBytes(roots.world),directoryBytes(roots.personas),
      ...(roots.shared?[directoryBytes(roots.shared)]:[]),
      ...rows.map(row=>directoryBytes(row.path)),
    ])
    const [world,personas]=values
    const shared=roots.shared?values[2]:0
    const base=roots.shared?3:2
    const unique=Object.values(roots).filter((folder,i,all)=>!all.some((other,j)=>j!==i&&inside(folder,other)&&(folder!==other||j<i)))
    const overlap=unique.length!==Object.values(roots).length
    const total=overlap?await Promise.all(unique.map(directoryBytes)).then(x=>x.reduce((a,b)=>a+b,0)):world+personas+shared
    return {
      groups:[
        {id:'world',label:'共同世界观',path:roots.world,bytes:world},
        {id:'personas',label:'全部人物档案',path:roots.personas,bytes:personas},
        ...(roots.shared?[{id:'shared',label:'共享偏好',path:roots.shared,bytes:shared}]:[]),
      ],
      characters:rows.map((row,i)=>({...row,bytes:values[base+i]})),
      totalBytes:total,
    }
  }
  async function open(id){
    await ensureSeeded?.()
    const destination=resolveFolder(id)
    if(!destination)throw new Error('无效的文件夹入口')
    if(id.startsWith('role:')){
      const role=id.slice(5)
      const listed=await characterRows()
      if(!listed.some(r=>r.id===id))throw new Error('当前角色不在角色目录中')
      await ensureFolder?.(role)
    }else if(id==='world'||id==='persona')await ensureFolder?.(id)
    await mkdir(destination,{recursive:true})
    await openInFileManager(destination,{platform,launch})
    return {path:destination,opened:true}
  }
  return {list,open}
}
