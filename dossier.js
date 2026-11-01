/** Lazy Markdown snapshots. Writes update the affected snapshot; no polling. */
import { mkdir, readFile, readdir, rm, stat, writeFile, rename, realpath, readlink, lstat, link } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { basename, dirname, join, resolve, sep } from 'node:path'

const STATE_FILE = '.kujira-state.json'
import {noticeId} from './migration-task.js'
import {defaultEvidence} from './default-evidence.js'
import {prepareUpdate, listUpdate, readUpdate} from './update-package.js'

const TARGETS = {
  memory: ['90-记忆.md', '记忆'],
  character: ['95-自补-人设.md', '人设（AI 补充）'],
  world: ['96-自补-世界观.md', '世界观（AI 补充）'],
  meme: ['97-自补-梗.md', '梗（AI 补充）'],
}
const digest = text => createHash('sha256').update(text).digest('hex')
const sourceVersion = (text, physicalPath) => digest(`${physicalPath}\0${text}`)
const emptyStats = () => ({ added: 0, updated: 0, kept: 0, upToDate: 0 })

async function readSource(path) {
  try {
    const info = await stat(path)
    if (!info.isFile()) return null
    return { path: resolve(path), realPath: await realpath(path), text: await readFile(path, 'utf8') }
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
    throw error
  }
}

async function loadDirectory(dir) {
  if (!dir) return []
  let names
  try { names = await readdir(dir) } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const sources = []
  for (const name of names.filter(n => n.endsWith('.md') && !n.startsWith('_') && !n.startsWith('.')).sort()) {
    const source = await readSource(join(dir, name))
    if (source?.text.trim()) sources.push(source)
  }
  return sources
}

async function readState(dir, onWarning) {
  const path = join(dir, STATE_FILE)
  let raw
  try { raw = await readFile(path, 'utf8') }
  catch (error) { if (error.code === 'ENOENT') return { files: {} }; throw error }
  try {
    const state = JSON.parse(raw)
    if (state && state.files && typeof state.files === 'object' && !Array.isArray(state.files)) return state
  } catch { /* Keep invalid state in place; ordinary reads never create recovery copies. */ }
  const recoveryUnsaved = true
  onWarning?.('档案状态损坏；保留原状态文件，不自动补回缺失默认内容。')
  const state = { files: {} }
  Object.defineProperty(state, 'recoveryInvalid', { value: true })
  Object.defineProperty(state, 'recoveryUnsaved', { value: recoveryUnsaved })
  return state
}
async function writeState(dir, state) {
  if (state.recoveryUnsaved) return
  const path = join(dir, STATE_FILE), temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(state, null, 2), 'utf8')
    await rename(temporary, path)
  } finally { await rm(temporary, { force: true }) }
}
/** Only on first use or explicit sync, never on a warm prompt request. */
async function syncDirectory(config) {
  const stats = emptyStats()
  if (!config.packagedDir || (config.seed === false && config.sync === false)) return stats
  let names
  try { names = (await readdir(config.packagedDir)).filter(n => n.endsWith('.md')) }
  catch (error) { if (error.code === 'ENOENT') return stats; throw error }
  await mkdir(config.personaDir, { recursive: true })
  const state = await readState(config.personaDir, config.onWarning)
  const baselines = state.defaultBaselines ??= {}
  const references = []
  const existing = await loadDirectory(config.personaDir)
  const fresh = existing.length === 0 && Object.keys(state.files).length === 0
  for (const name of names) {
    const text = await readFile(join(config.packagedDir, name), 'utf8'), bundleHash = digest(text)
    let userText
    try { userText = await readFile(join(config.personaDir, name), 'utf8') }
    catch (error) { if (error.code !== 'ENOENT') throw error; userText = null }
    const record = state.files[name]
    const previous = typeof record === 'string' ? {hash:record,source:'unknown'} : record
    try { await editableTarget(config,name,true) }
    catch (error) { if(error.code!=='KUJIRA_OUTSIDE_DOSSIER')throw error;stats.kept++;continue }
    if(userText === null && (record || state.recoveryInvalid)) {
      state.files[name] = {source:'deleted'}
      continue
    }
    // Existing memories are independent. Even unchanged old seeds are never
    // replaced by startup; first install also stages, rather than seeds roots.
    if(name.startsWith('90-') && !fresh){stats.kept++;continue}
    if(userText === null && config.seed === false)continue
    if(userText !== null && digest(userText) === bundleHash) {
      state.files[name] = {hash:bundleHash,source:'seed'}
      baselines[name] = {hash:bundleHash,text}
      stats.upToDate++
      continue
    }
    let baseline=null, baselineSource='unavailable'
    const known = await defaultEvidence(config,name,previous,baselines[name])
    if(known){baseline=known.text;baselineSource='验证的默认基线 SHA256 '+known.hash}
    if(baseline!==null)baselines[name]={hash:digest(baseline),text:baseline}
    if(userText!==null)state.files[name]=previous?.source==='seed'&&previous.hash===digest(userText)?previous:{hash:digest(userText),source:'user'}
    references.push({name,text,baseline,baselineSource})
    stats.kept++
  }
  try { await prepareUpdate(config,state,references) }
  catch(error){config.onWarning?.(`基础更新包暂未完整保存（${error.code??error.message}）；原档案保留，稍后同步重试。`)}
  await writeState(config.personaDir,state)
  return stats
}

async function editableTarget(config, file, forWrite = false) {
  const name = typeof file === 'string' ? file.trim() : ''
  if (!name.endsWith('.md') || /[\\/]/.test(name)) throw new Error('file 必须是目录内 .md 文件名，不能带路径')
  const path = resolve(config.personaDir, name)
  let physicalPath = path
  if (!path.startsWith(`${resolve(config.personaDir)}${sep}`)) throw new Error('目标不在档案目录里')
  // A configured root may itself be a symlink; only prevent a file from
  // redirecting an edit outside that root's actual directory.
  try {
    if (!forWrite) return { name, path }
    const root = await realpath(config.personaDir)
    let target
    try { target = await realpath(path) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      let link
      try { link = await readlink(path) } catch (error) { if (error.code === 'ENOENT' || error.code === 'EINVAL') return { name, path, physicalPath: join(root, name) }; throw error }
      const destination = resolve(dirname(path), link)
      const parent = await realpath(dirname(destination)).catch(error => { if (error.code === 'ENOENT') return dirname(destination); throw error })
      target = join(parent, basename(destination))
    }
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      const error = new Error('目标链接指向档案目录之外'); error.code = 'KUJIRA_OUTSIDE_DOSSIER'; throw error
    }
    physicalPath = target
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  return { name, path, physicalPath }
}
function today() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function frameText(config) {
  if (config.kind === 'shared') return '## 用户显式共享的偏好'
  if (config.kind === 'world') return [
    '## 共同世界观、协作共识与角色名录',
    '本节供所有角色共享：用户明确的共同习惯、要求、项目共识、经用户确认的通用协作经验，以及公共背景与人物资料。个人差异和针对性纠正保留在个人档案，不自行推广为共同规则。',
    '隐私与公开边界：私聊内容与私人上下文默认私密；任务执行授权不自动包含对外披露。未经明确公开授权，不把私聊指令、用户喜好、截图来源或交流过程（包括“用户要求／用户喜欢”等归因）写入公开仓库、文档、日志、提交信息或发布材料。公开内容只使用任务必要且已获授权公开的作品事实、来源与署名；披露范围不明确时先确认。处理泄露时如实区分当前版本修正与历史、副本残留，不把修改当前文件说成已彻底清除。',
    `全局世界观目录：${config.personaDir}`,
  ].join('\n')
  return [
    `## 当前角色：${config.label}`,
    '本段是你自己的性格、交流方式、个人偏好、针对你的行为纠正与个人记忆；与共同规则配合使用，不把个人差异当作所有角色的统一要求。',
    '按用户要求完成任务与文体。',
    `当前角色档案：${config.personaDir}`,
  ].join('\n')
}

export function openDossier(config) {
  let snapshot, initialization, stats = null
  let tail = Promise.resolve()
  // Async writes to this one dossier run in call order, without timers or a host lock.
  function enqueue(operation) {
    const result = tail.then(operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
  function build(sources) {
    sources.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    const parts = [frameText(config), ...sources.filter(s => !noticeId(basename(s.path),s.text)).map(s => s.text.trim())]
    if (config.extraText?.trim()) parts.push(config.extraText.trim())
    const joined = parts.join('\n\n')
    const text = joined
    return { text, sources, chars: text.length }
  }
  async function scan() {
    const sources = await loadDirectory(config.personaDir)
    if (config.memoryFile && !sources.some(s => s.path === resolve(config.memoryFile))) {
      const memory = await readSource(config.memoryFile)
      if (memory?.text.trim()) sources.push(memory)
    }
    snapshot = build(sources)
    return snapshot
  }
  function ready() {
    if (!initialization) {
      const work = enqueue(async () => { stats = await syncDirectory(config); await scan() })
      initialization = work
      work.catch(() => { if (initialization === work) initialization = undefined })
    }
    return initialization
  }
  async function replaceSource(path, text) {
    path = resolve(path)
    const physical = text?.trim() ? await realpath(path) : null
    const sources = snapshot.sources.filter(s => s.path !== path).map(s => physical && s.realPath === physical ? { ...s, text } : s)
    const name = basename(path), explicitMemory = config.memoryFile && path === resolve(config.memoryFile)
    if (text?.trim() && (explicitMemory || (!name.startsWith('_') && !name.startsWith('.')))) sources.push({ path, realPath: physical, text })
    snapshot = build(sources)
  }
  function refresh(sync) {
    const work = enqueue(async () => {
      if (sync) stats = await syncDirectory(config)
      await scan()
      return sync ? stats : snapshot
    })
    initialization = work
    work.catch(() => { if (initialization === work) initialization = undefined })
    return work
  }
  const api = {
    config,
    async compose() { await ready(); await tail; return snapshot },
    reload() { return refresh(false) },
    sync() { return refresh(true) },
    stats() { return stats },
    async files() {
      const value = await api.compose()
      return value.sources.map(s => ({ file: basename(s.path), chars: s.text.length }))
    },
    async read(file) {
      await ready(); await tail
      if (typeof file === 'string' && file.startsWith('更新/')) return readUpdate(config, file)
      const { path } = await editableTarget(config, file)
      const source = await readSource(path)
      if (!source) { const error = new Error('找不到该档案文件'); error.code = 'KUJIRA_FILE_NOT_FOUND'; throw error }
      return { ...source, version: sourceVersion(source.text, source.realPath) }
    },
    async edit(args, options = {}) {
      await ready()
      return enqueue(async () => {
        const conditional = Object.hasOwn(options, 'expectedHash')
        const guard = async () => {
          options.signal?.throwIfAborted()
          if (options.guard && !await options.guard()) throw new Error('当前整理已失效，请在下一次有效整理中重试')
          options.signal?.throwIfAborted()
        }
        let boundDestination
        const destination = async path => {
          let target
          try { target = (await editableTarget(config, basename(path), true)).physicalPath }
          catch (error) {
            if (boundDestination === undefined || error.code !== 'KUJIRA_OUTSIDE_DOSSIER') throw error
            const conflict = new Error('档案目标在读取后已改变；请重新读取，再按最新内容修改')
            conflict.code = 'KUJIRA_EDIT_CONFLICT'; throw conflict
          }
          if (boundDestination !== undefined && target !== boundDestination) {
            const error = new Error('档案目标在读取后已改变；请重新读取，再按最新内容修改')
            error.code = 'KUJIRA_EDIT_CONFLICT'; throw error
          }
          boundDestination = target
          return target
        }
        const verify = async path => {
          if (!conditional) return
          await destination(path)
          let current
          try { current = await readFile(path, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error; current = null }
          if ((current === null ? null : sourceVersion(current, boundDestination)) !== options.expectedHash) {
            const error = new Error('档案在读取后已改变；请重新读取，再按最新内容修改')
            error.code = 'KUJIRA_EDIT_CONFLICT'; throw error
          }
        }
        const save = async (path, updated) => {
          const target = conditional ? await destination(path) : (resolve(dirname(path)) === resolve(config.personaDir) ? (await editableTarget(config, basename(path), true)).physicalPath : path)
          try { if (await readFile(target, 'utf8') === updated) return } catch (error) { if (error.code !== 'ENOENT') throw error }
          const temporary = `${target}.${randomUUID()}.tmp`
          try {
            await writeFile(temporary, updated, { encoding: 'utf8', flag: 'wx' })
            await guard(); await verify(path); if (conditional) await destination(path); options.signal?.throwIfAborted()
            await rename(temporary, target)
          } finally { await rm(temporary, { force: true }) }
        }
        await guard()
        const input = args && typeof args === 'object' ? args : {}
        const action = typeof input.action === 'string' ? input.action : 'append'
        if (action === 'list') return { action, persona: config.id, files: input.file === '更新' || input.file?.startsWith('更新/')
          ? await listUpdate(config,input.file) : [...snapshot.sources.map(s => ({ file: basename(s.path), chars: s.text.length })), ...await listUpdate(config)] }
        if (action === 'delete_update') throw Error('先在独立迁移任务中逐文件记录决策并回读确认；更新包清理仅由该任务完成。用 /persona migrate 接续')
        if (action === 'create') {
          const {name,path}=await editableTarget(config,input.file,true)
          if(typeof input.text!=='string')throw new Error('create 需要完整 text')
          const temporary = `${path}.${randomUUID()}.tmp`
          try {
            await writeFile(temporary,input.text,{encoding:'utf8',flag:'wx'})
            await guard();await verify(path);options.signal?.throwIfAborted()
            // Publish complete bytes without replacing an existing file.
            await link(temporary,path)
          } finally { await rm(temporary,{force:true}) }
          await replaceSource(path,input.text)
          return {action,persona:config.id,file:name,path,cache_updated:true,note:'已创建缺失档案；原有文件不会被覆盖。请重新读取确认。'}
        }
        const oldText = typeof input.oldText === 'string' ? input.oldText : ''
        if (action === 'replace' || action === 'delete') {
          const { name, path } = await editableTarget(config, input.file, true)
          await verify(path)
          const text = await readFile(path, 'utf8')
          let version = null
          if (action === 'delete' && !oldText) {
            await guard(); await verify(path); options.signal?.throwIfAborted()
            await rm(path)
            await replaceSource(path, null)
            const state = await readState(config.personaDir, config.onWarning)
            state.files[name] = { source: 'deleted' }
            await writeState(config.personaDir, state)
          } else {
            if (!oldText) throw new Error('replace 需要 oldText')
            const hits = text.split(oldText).length - 1
            if (hits !== 1) throw new Error(`oldText 在 ${name} 中匹配 ${hits} 次，需要唯一匹配`)
            const replacement = action === 'delete' ? '' : typeof input.newText === 'string' ? input.newText : ''
            const updated = text.replace(oldText, () => replacement)
            await save(path, updated)
            version = conditional ? sourceVersion(updated, boundDestination) : null
            await replaceSource(path, updated)
          }
          return { action, persona: config.id, file: name, path, ...(conditional ? { version } : {}), cache_updated: true, note: `已${action === 'delete' ? '删除' : '替换'} ${name}；对应缓存已更新。` }
        }
        if (action !== 'append') throw new Error(`未知 action：${action}`)
        if (typeof input.text !== 'string') throw new Error('append 需要 text 字符串')
        const text = input.text
        const source = typeof input.source === 'string' ? input.source.trim() : ''
        const target = TARGETS[input.category] ?? TARGETS.character
        const explicit = typeof input.file === 'string' && input.file.trim()
        const { name, path } = explicit ? await editableTarget(config, input.file, true)
          : input.category === 'memory' && config.memoryFile && dirname(resolve(config.memoryFile)) !== resolve(config.personaDir)
            ? { name: target[0], path: config.memoryFile }
            : await editableTarget(config, input.category === 'memory' && config.memoryFile ? basename(config.memoryFile) : target[0], true)
        await mkdir(dirname(path), { recursive: true })
        await verify(path)
        let existing
        try { existing = await readFile(path, 'utf8') }
        catch (error) { if (error.code !== 'ENOENT') throw error; existing = `# ${explicit ? name : target[1]}\n\n` }
        const line = `- ${today()} · ${text}${source ? ` · 来源：${source}` : ''}`
        const updated = `${existing}${existing.endsWith('\n') ? '' : '\n'}${line}\n`
        await save(path, updated)
        await replaceSource(path, updated)
        return { action, persona: config.id, path, file: name, ...(conditional ? { version: sourceVersion(updated, boundDestination) } : {}), cache_updated: true, note: `${line}\n对应缓存已更新。` }
      })
    },
  }
  return api
}
