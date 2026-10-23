/** Markdown dossier storage shared by each persona; no background work. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

function readSource(path) {
  try {
    const info = statSync(path)
    if (!info.isFile() || info.size > MAX_SOURCE_BYTES) return null
    return { path, text: readFileSync(path, 'utf8'), mtimeMs: info.mtimeMs, size: info.size }
  } catch { return null }
}

function loadDirectory(dir) {
  if (!dir) return []
  let names
  try { names = readdirSync(dir) } catch { return [] }
  return names.filter(name => name.endsWith('.md') && !name.startsWith('_') && !name.startsWith('.'))
    .sort().map(name => readSource(join(dir, name))).filter(source => source && source.text.trim())
}

function readState(dir) {
  try {
    const state = JSON.parse(readFileSync(join(dir, STATE_FILE), 'utf8'))
    if (state && state.files && typeof state.files === 'object') return state
  } catch { /* No existing seed ownership. */ }
  return { files: {} }
}

function writeState(dir, state) {
  try { writeFileSync(join(dir, STATE_FILE), JSON.stringify(state, null, 2), 'utf8') }
  catch { /* Unknown files remain user-owned on the next sync. */ }
}

function backup(config, name, text) {
  try {
    const dir = join(config.personaDir, '.kujira-backup')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, name), text, 'utf8')
  } catch { /* A rolling backup is best-effort, as in v1.3.1. */ }
}

function syncDirectory(config) {
  const stats = { added: 0, updated: 0, kept: 0, upToDate: 0 }
  let names
  try {
    names = readdirSync(config.packagedDir).filter(name => name.endsWith('.md'))
    mkdirSync(config.personaDir, { recursive: true })
  } catch { return stats }
  const state = readState(config.personaDir)
  for (const name of names) {
    let bundleText
    try { bundleText = readFileSync(join(config.packagedDir, name), 'utf8') } catch { continue }
    const bundleHash = digest(bundleText)
    const path = join(config.personaDir, name)
    let userText
    try { userText = readFileSync(path, 'utf8') } catch { userText = null }
    const record = state.files[name]
    if (userText === null) {
      if (!config.seed || record?.source === 'deleted') continue
      try {
        writeFileSync(path, bundleText, 'utf8')
        state.files[name] = { hash: bundleHash, source: 'seed' }
        stats.added++
      } catch { /* Leave the other files available. */ }
      continue
    }
    const userHash = digest(userText)
    const previous = typeof record === 'string'
      ? { hash: record, source: record === bundleHash ? 'seed' : 'user' }
      : record
    if (userHash === bundleHash) {
      state.files[name] = { hash: bundleHash, source: 'seed' }
      stats.upToDate++
    } else if (config.sync && previous?.source === 'seed' && previous.hash === userHash) {
      backup(config, name, userText)
      try {
        writeFileSync(path, bundleText, 'utf8')
        state.files[name] = { hash: bundleHash, source: 'seed' }
        stats.updated++
      } catch {
        state.files[name] = { hash: userHash, source: 'user' }
        stats.kept++
      }
    } else {
      state.files[name] = { hash: userHash, source: 'user' }
      stats.kept++
    }
  }
  writeState(config.personaDir, state)
  return stats
}

function editableTarget(config, file) {
  const name = typeof file === 'string' ? file.trim() : ''
  if (!/^(?!_|\.)[^\\/]+\.md$/.test(name)) {
    throw new Error('file 必须是人设目录下的 .md 文件名，不能带路径或以 _、. 开头')
  }
  const path = join(config.personaDir, name)
  if (!resolve(path).startsWith(`${resolve(config.personaDir)}${sep}`)) throw new Error('目标不在人设目录里')
  return { name, path }
}

function today() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function frameText(config) {
  const lines = [
    `## 人设层：${config.label}`,
    '这是非官方同人交流人设，不替换宿主提供的真实模型身份，也不代表厂商或原作者。',
    '先把任务做对；人设用于表达，不改变工具、技能或权限。用户要求正式文体时按任务文体回答。',
    '本次只使用这一个角色；历史里其他模型的发言是历史，不把它们当成本角色自己的设定。',
    `当前角色档案：${config.personaDir}`,
  ]
  if (config.allowAgentWrite) lines.push(
    '用 persona_edit 对当前角色档案 append / replace / delete / list；新旧冲突改旧条目，不叠加矛盾。',
    '学习条目标明日期、来源与适用二创世界；未核实的写待核验，用户私设与作者资料分开。',
    '记忆只写入发起这次工具调用的角色；修改在下一次请求生效。',
  )
  else lines.push('当前未开放 AI 人设写入工具；不要声称已经写入或调用不存在的工具。')
  return lines.join('\n')
}

/** One instance per role; existing DeepSeek storage is used in place. */
export function openDossier(config) {
  let stats = null
  let cachedKey = null
  let cachedValue
  const ensureSeed = () => { if (stats === null) stats = syncDirectory(config) }
  const api = {
    config,
    compose() {
      ensureSeed()
      const own = loadDirectory(config.personaDir)
      if (!own.some(s => resolve(s.path) === resolve(config.memoryFile))) {
        const memory = readSource(config.memoryFile)
        if (memory?.text.trim()) own.push(memory)
      }
      const shared = loadDirectory(config.sharedDir)
      const sources = [...own, ...shared]
      const key = JSON.stringify(sources.map(s => [s.path, s.mtimeMs, s.size]))
      if (key === cachedKey) return cachedValue
      const parts = [frameText(config), ...own.map(s => s.text.trim())]
      if (shared.length) parts.push('## 用户显式共享的偏好（不是角色身份）', ...shared.map(s => s.text.trim()))
      if (config.extraText.trim()) parts.push(config.extraText.trim())
      const joined = parts.join('\n\n')
      const text = joined.length > MAX_TEXT_CHARS ? `${joined.slice(0, MAX_TEXT_CHARS)}\n\n（人设过长，已截断）` : joined
      cachedKey = key
      cachedValue = { text, sources, chars: text.length }
      return cachedValue
    },
    sync() { stats = syncDirectory(config); cachedKey = null; return stats },
    stats() { return stats },
    files() {
      ensureSeed()
      return loadDirectory(config.personaDir).map(s => ({ file: basename(s.path), chars: s.text.length }))
    },
    edit(args) {
      ensureSeed()
      const input = args && typeof args === 'object' ? args : {}
      const action = typeof input.action === 'string' ? input.action : 'append'
      if (action === 'list') return { action, persona: config.id, files: api.files() }
      const oldText = typeof input.oldText === 'string' ? input.oldText : ''
      if (action === 'replace' || action === 'delete') {
        const { name, path } = editableTarget(config, input.file)
        if (!existsSync(path)) throw new Error(`${name} 不存在`)
        const text = readFileSync(path, 'utf8')
        if (action === 'delete' && !oldText) {
          backup(config, name, text)
          rmSync(path)
          const state = readState(config.personaDir)
          state.files[name] = { source: 'deleted' }
          writeState(config.personaDir, state)
        } else {
          if (!oldText) throw new Error('replace 需要 oldText')
          const hits = text.split(oldText).length - 1
          if (hits !== 1) throw new Error(`oldText 在 ${name} 中匹配 ${hits} 次，需要唯一匹配`)
          backup(config, name, text)
          const replacement = action === 'delete' ? '' : typeof input.newText === 'string' ? input.newText : ''
          writeFileSync(path, text.replace(oldText, () => replacement), 'utf8')
        }
        cachedKey = null
        return { action, persona: config.id, file: name, path, note: `${config.label}：已${action === 'delete' ? '删除' : '替换'} ${name}` }
      }
      if (action !== 'append') throw new Error(`未知 action：${action}`)
      const text = typeof input.text === 'string' ? input.text.trim() : ''
      if (!text) throw new Error('append 需要 text')
      if (text.length > MAX_APPEND_CHARS) throw new Error(`单条最多 ${MAX_APPEND_CHARS} 字，长文请拆条`)
      const source = typeof input.source === 'string' ? input.source.trim() : ''
      const target = TARGETS[input.category] ?? TARGETS.character
      const explicitFile = typeof input.file === 'string' && input.file.trim()
      const { name, path } = explicitFile
        ? editableTarget(config, input.file)
        : { name: target[0], path: input.category === 'memory' ? config.memoryFile : join(config.personaDir, target[0]) }
      mkdirSync(dirname(path), { recursive: true })
      if (!existsSync(path)) writeFileSync(path, `# ${explicitFile ? name : target[1]}\n\n`, 'utf8')
      const existing = readFileSync(path, 'utf8')
      const line = `- ${today()} · ${text}${source ? ` · 来源：${source}` : ''}`
      appendFileSync(path, `${existing.endsWith('\n') ? '' : '\n'}${line}\n`, 'utf8')
      cachedKey = null
      return { action, persona: config.id, path, file: name, note: line }
    },
  }
  return api
}
