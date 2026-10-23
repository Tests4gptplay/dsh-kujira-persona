/** Lazy Markdown snapshots. Writes update the affected snapshot; no polling. */
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, dirname, join, resolve, sep } from 'node:path'

const MAX_SOURCE_BYTES = 256 * 1024
const MAX_TEXT_CHARS = 64000
const MAX_APPEND_CHARS = 4000
const STATE_FILE = '.kujira-state.json'
const TARGETS = {
  memory: ['90-记忆.md', '记忆'],
  character: ['95-自补-人设.md', '人设（AI 补充）'],
  world: ['96-自补-世界观.md', '世界观（AI 补充）'],
  meme: ['97-自补-梗.md', '梗（AI 补充）'],
}
const digest = text => createHash('sha256').update(text).digest('hex')
const emptyStats = () => ({ added: 0, updated: 0, kept: 0, upToDate: 0 })

async function readSource(path) {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size > MAX_SOURCE_BYTES) return null
    return { path: resolve(path), text: await readFile(path, 'utf8') }
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

async function readState(dir) {
  try {
    const state = JSON.parse(await readFile(join(dir, STATE_FILE), 'utf8'))
    if (state && state.files && typeof state.files === 'object') return state
  } catch { /* Preserve the legacy ownership format. */ }
  return { files: {} }
}
async function writeState(dir, state) {
  await writeFile(join(dir, STATE_FILE), JSON.stringify(state, null, 2), 'utf8')
}
async function backup(config, name, text) {
  try {
    const dir = join(config.personaDir, '.kujira-backup')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, name), text, 'utf8')
  } catch { /* Existing single-file backup remains best effort. */ }
}

/** Only on first use or explicit sync, never on a warm prompt request. */
async function syncDirectory(config) {
  const stats = emptyStats()
  if (!config.packagedDir || (config.seed === false && config.sync === false)) return stats
  let names
  try { names = (await readdir(config.packagedDir)).filter(n => n.endsWith('.md')) }
  catch (error) { if (error.code === 'ENOENT') return stats; throw error }
  await mkdir(config.personaDir, { recursive: true })
  const state = await readState(config.personaDir)
  for (const name of names) {
    const bundleText = await readFile(join(config.packagedDir, name), 'utf8')
    const bundleHash = digest(bundleText), path = join(config.personaDir, name)
    let userText
    try { userText = await readFile(path, 'utf8') }
    catch (error) { if (error.code !== 'ENOENT') throw error; userText = null }
    const record = state.files[name]
    if (userText === null) {
      if (config.seed === false || record?.source === 'deleted') continue
      await writeFile(path, bundleText, 'utf8')
      state.files[name] = { hash: bundleHash, source: 'seed' }
      stats.added++
      continue
    }
    const userHash = digest(userText)
    const previous = typeof record === 'string'
      ? { hash: record, source: record === bundleHash ? 'seed' : 'user' } : record
    if (userHash === bundleHash) {
      state.files[name] = { hash: bundleHash, source: 'seed' }
      stats.upToDate++
    } else if (config.sync !== false && previous?.source === 'seed' && previous.hash === userHash) {
      await backup(config, name, userText)
      await writeFile(path, bundleText, 'utf8')
      state.files[name] = { hash: bundleHash, source: 'seed' }
      stats.updated++
    } else {
      state.files[name] = { hash: userHash, source: 'user' }
      stats.kept++
    }
  }
  await writeState(config.personaDir, state)
  return stats
}

function editableTarget(config, file) {
  const name = typeof file === 'string' ? file.trim() : ''
  if (!/^(?!_|\.)[^\\/]+\.md$/.test(name)) throw new Error('file 必须是目录内 .md 文件名，不能带路径或以 _、. 开头')
  const path = resolve(config.personaDir, name)
  if (!path.startsWith(`${resolve(config.personaDir)}${sep}`)) throw new Error('目标不在档案目录里')
  return { name, path }
}
function today() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}
function frameText(config) {
  if (config.kind === 'shared') return '## 用户显式共享的偏好（不是角色身份）'
  if (config.kind === 'world') return [
    '## 全局世界观与角色名录',
    '本节是大家共同知道的背景与公开人物资料，不表示你同时扮演这些角色。自己的身份只由当前角色段决定。',
    `全局世界观目录：${config.personaDir}`,
  ].join('\n')
  return [
    `## 当前角色：${config.label}`,
    '本段是你自己的设定与个人记忆；全局名录中的其他人不是你。',
    '非官方同人交流人设，不替换宿主的真实模型身份、工具或权限。按用户要求完成任务与文体。',
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
    const parts = [frameText(config), ...sources.map(s => s.text.trim())]
    if (config.extraText?.trim()) parts.push(config.extraText.trim())
    const joined = parts.join('\n\n')
    const text = joined.length > MAX_TEXT_CHARS ? `${joined.slice(0, MAX_TEXT_CHARS)}\n\n（内容过长，已截断）` : joined
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
    return initialization ??= enqueue(async () => { stats = await syncDirectory(config); await scan() })
  }
  function replaceSource(path, text) {
    path = resolve(path)
    const sources = snapshot.sources.filter(s => s.path !== path)
    if (text?.trim() && Buffer.byteLength(text, 'utf8') <= MAX_SOURCE_BYTES) sources.push({ path, text })
    snapshot = build(sources)
  }
  function refresh(sync) {
    const work = enqueue(async () => {
      if (sync) stats = await syncDirectory(config)
      await scan()
      return sync ? stats : snapshot
    })
    initialization = work.then(() => undefined)
    initialization.catch(() => {})
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
    async edit(args) {
      await ready()
      return enqueue(async () => {
        const input = args && typeof args === 'object' ? args : {}
        const action = typeof input.action === 'string' ? input.action : 'append'
        if (action === 'list') return { action, persona: config.id, files: snapshot.sources.map(s => ({ file: basename(s.path), chars: s.text.length })) }
        const oldText = typeof input.oldText === 'string' ? input.oldText : ''
        if (action === 'replace' || action === 'delete') {
          const { name, path } = editableTarget(config, input.file)
          const text = await readFile(path, 'utf8')
          if (action === 'delete' && !oldText) {
            await backup(config, name, text)
            await rm(path)
            replaceSource(path, null)
            const state = await readState(config.personaDir)
            state.files[name] = { source: 'deleted' }
            await writeState(config.personaDir, state)
          } else {
            if (!oldText) throw new Error('replace 需要 oldText')
            const hits = text.split(oldText).length - 1
            if (hits !== 1) throw new Error(`oldText 在 ${name} 中匹配 ${hits} 次，需要唯一匹配`)
            await backup(config, name, text)
            const replacement = action === 'delete' ? '' : typeof input.newText === 'string' ? input.newText : ''
            const updated = text.replace(oldText, () => replacement)
            await writeFile(path, updated, 'utf8')
            replaceSource(path, updated)
          }
          return { action, persona: config.id, file: name, path, cache_updated: true, note: `已${action === 'delete' ? '删除' : '替换'} ${name}；对应缓存已更新。` }
        }
        if (action !== 'append') throw new Error(`未知 action：${action}`)
        const text = typeof input.text === 'string' ? input.text.trim() : ''
        if (!text) throw new Error('append 需要 text')
        if (text.length > MAX_APPEND_CHARS) throw new Error(`单条最多 ${MAX_APPEND_CHARS} 字，长文请拆条`)
        const source = typeof input.source === 'string' ? input.source.trim() : ''
        const target = TARGETS[input.category] ?? TARGETS.character
        const explicit = typeof input.file === 'string' && input.file.trim()
        const { name, path } = explicit ? editableTarget(config, input.file)
          : { name: target[0], path: input.category === 'memory' && config.memoryFile ? config.memoryFile : join(config.personaDir, target[0]) }
        await mkdir(dirname(path), { recursive: true })
        let existing
        try { existing = await readFile(path, 'utf8') }
        catch (error) { if (error.code !== 'ENOENT') throw error; existing = `# ${explicit ? name : target[1]}\n\n` }
        const line = `- ${today()} · ${text}${source ? ` · 来源：${source}` : ''}`
        const updated = `${existing}${existing.endsWith('\n') ? '' : '\n'}${line}\n`
        await writeFile(path, updated, 'utf8')
        replaceSource(path, updated)
        return { action, persona: config.id, path, file: name, cache_updated: true, note: `${line}\n对应缓存已更新。` }
      })
    },
  }
  return api
}
