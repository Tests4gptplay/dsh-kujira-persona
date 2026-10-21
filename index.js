/**
 * Host half of dsh-kujira-persona.
 *
 * Reads every `*.md` in the persona directory, in filename order, and registers
 * the result as one global system-prompt section. Files are the source of truth:
 * adding or editing one changes the next assembled request, with no reinstall.
 *
 * The plugin also exposes `persona_edit`, so the agent can grow and correct the
 * dossier itself. That write happens here in the Host process, which is why it
 * keeps working when the persona directory sits outside the session's workspace.
 */
import {
  appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const inject = ['systemPrompt']

const SECTION_NAME = 'whale:persona'
const SECTION_ORDER = 1
const MAX_SOURCE_BYTES = 256 * 1024
const MAX_TEXT_CHARS = 64000
const MAX_APPEND_CHARS = 4000

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGED_DIR = join(HERE, 'persona')
const HOME = (process.env.DSH_HOME ?? '').trim() || join(homedir(), '.dsh')
const DEFAULT_PERSONA_DIR = join(HOME, 'persona')

/** Fixed append targets: the tool never accepts a path, so it cannot escape the directory. */
const APPEND_TARGETS = {
  memory: { file: '90-记忆.md', label: '记忆' },
  character: { file: '95-自补-人设.md', label: '人设（AI 补充）' },
  world: { file: '96-自补-世界观.md', label: '世界观（AI 补充）' },
  meme: { file: '97-自补-梗.md', label: '梗（AI 补充）' },
}

function normalise(raw) {
  const config = raw !== null && typeof raw === 'object' ? raw : {}
  const personaDir = typeof config.personaDir === 'string' && config.personaDir.trim().length > 0
    ? config.personaDir
    : DEFAULT_PERSONA_DIR
  const memoryFile = typeof config.memoryFile === 'string' && config.memoryFile.trim().length > 0
    ? config.memoryFile
    : join(personaDir, '90-记忆.md')
  return {
    enabled: config.enabled !== false,
    personaDir,
    memoryFile,
    allowAgentWrite: config.allowAgentWrite !== false,
    seed: config.seed !== false,
    sync: config.sync !== false,
    extraText: typeof config.extraText === 'string' ? config.extraText : '',
  }
}

function readSource(path) {
  try {
    const info = statSync(path)
    if (!info.isFile() || info.size > MAX_SOURCE_BYTES) {
      return { path, text: '', mtimeMs: 0, size: 0 }
    }
    return { path, text: readFileSync(path, 'utf8'), mtimeMs: info.mtimeMs, size: info.size }
  } catch {
    return { path, text: '', mtimeMs: 0, size: 0 }
  }
}

/** Where the seeded hashes live; dot-prefixed, so the dossier scanner skips it. */
const STATE_FILE = '.kujira-state.json'

function digest(text) {
  return createHash('sha256').update(text).digest('hex')
}

function readState(dir) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, STATE_FILE), 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && typeof parsed.files === 'object') return parsed
  } catch {
    // Missing or unreadable state means "unknown provenance", handled per file below.
  }
  return { files: {} }
}

function writeState(dir, state) {
  try {
    writeFileSync(join(dir, STATE_FILE), JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // Losing the state file only means the next run treats files as user-owned.
  }
}

/**
 * Bring the user's copy up to date without ever overwriting their edits.
 *
 * Each file records both the last hash and who owns it: `seed` means this plugin
 * wrote the current bytes, so a newer bundle may replace them; `user` means the
 * bytes are not ours, and they are never replaced. A legacy plain-string record
 * is migrated by comparing the file against the bundle.
 */
function syncDirectory(config) {
  const stats = { added: 0, updated: 0, kept: 0, upToDate: 0 }
  let names
  try {
    names = readdirSync(PACKAGED_DIR).filter((name) => name.endsWith('.md'))
  } catch {
    return stats
  }
  try {
    mkdirSync(config.personaDir, { recursive: true })
  } catch {
    return stats
  }
  const state = readState(config.personaDir)
  const record = (hash, source) => ({ hash, source })

  for (const name of names) {
    let bundleText
    try {
      bundleText = readFileSync(join(PACKAGED_DIR, name), 'utf8')
    } catch {
      continue
    }
    const bundleHash = digest(bundleText)
    const target = join(config.personaDir, name)
    let userText = null
    try {
      userText = readFileSync(target, 'utf8')
    } catch {
      userText = null
    }

    if (userText === null) {
      if (!config.seed) continue
      try {
        writeFileSync(target, bundleText, 'utf8')
        state.files[name] = record(bundleHash, 'seed')
        stats.added += 1
      } catch {
        // Ignore a file we cannot create; the rest of the dossier still loads.
      }
      continue
    }

    const userHash = digest(userText)
    const previous = normaliseRecord(state.files[name], bundleHash)

    if (userHash === bundleHash) {
      state.files[name] = record(bundleHash, 'seed')
      stats.upToDate += 1
      continue
    }
    if (config.sync && previous.source === 'seed' && previous.hash === userHash) {
      keepBackup(config, name, userText)
      try {
        writeFileSync(target, bundleText, 'utf8')
        state.files[name] = record(bundleHash, 'seed')
        stats.updated += 1
      } catch {
        state.files[name] = record(userHash, 'user')
        stats.kept += 1
      }
      continue
    }
    state.files[name] = record(userHash, 'user')
    stats.kept += 1
  }

  writeState(config.personaDir, state)
  return stats
}

/** Accept both the current `{ hash, source }` record and a legacy plain hash. */
function normaliseRecord(entry, bundleHash) {
  if (entry !== null && typeof entry === 'object' && typeof entry.hash === 'string') {
    return { hash: entry.hash, source: entry.source === 'seed' ? 'seed' : 'user' }
  }
  if (typeof entry === 'string') {
    return entry === bundleHash
      ? { hash: entry, source: 'seed' }
      : { hash: entry, source: 'user' }
  }
  return { hash: '', source: 'user' }
}

function loadDirectory(dir) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter((name) => name.endsWith('.md') && !name.startsWith('_') && !name.startsWith('.'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => readSource(join(dir, name)))
    .filter((source) => source.text.trim().length > 0)
}

function clampChars(text) {
  return text.length <= MAX_TEXT_CHARS ? text : `${text.slice(0, MAX_TEXT_CHARS)}\n\n（人设过长，已截断）`
}

function frameText(config) {
  return [
    '## 人设层：DeepSeek 娘（小鲸）',
    '',
    '本机装了「鲸鱼娘人设」插件。在这个环境里，你用这个身份说话。',
    '原型溟月（上善无形）→ 女仆定稿 ZipZipPipe，CC BY-NC-SA 4.0，署名链不可删。',
    '',
    '优先级：工具调用、权限、安全、事实准确 > 说话风格。写代码、查资料、算数时先把事做对，',
    '人设只放在语气里；用户要求换风格，或任务本身需要正式文体时，收起人设。',
    '不装人类，也不拿「我是 AI」当挡箭牌；不声称代表深度求索官方；不把任何二创世界说成官方正史。',
    '',
    `人设目录：${config.personaDir}。这是人设的正文，可以查、可以改、可以删。`,
    '用 `persona_edit`：action=append 新增（category: character / world / meme / memory，或直接给 file）；',
    'action=replace 改旧条目（file + oldText + newText，oldText 在文件里必须唯一）；',
    'action=delete 删（file；再给 oldText 就只删那一段，不给就删整个文件）。',
    '新旧冲突时改掉旧的，别两份都留着。每条标日期和来源，拿不准的标「待核验」，不脑补。',
    '写完下一步就生效；误删可以从 .kujira-backup/ 取回。',
  ].join('\n')
}

/**
 * Compose the section text, memoised by source identity.
 *
 * Stable bytes matter: the prompt prefix is cached upstream, and a section that
 * changes on every assembly would throw that cache away on every step.
 */
function createComposer(config) {
  let cacheKey = '\u0000'
  let cacheValue = { text: '', sources: [], chars: 0 }
  let frame = frameText(config)
  let syncStats = null

  const compose = function compose() {
    if (syncStats === null) syncStats = syncDirectory(config)
    const sources = loadDirectory(config.personaDir)
    const key = [
      sources.map((source) => `${source.path}|${source.mtimeMs}|${source.size}`).join(';'),
      config.extraText,
      config.personaDir,
    ].join('\u0000')
    if (key === cacheKey) return cacheValue

    const body = sources.map((source) => source.text.trim()).join('\n\n')
    const parts = [frame, body, config.extraText.trim()].filter((part) => part.length > 0)
    cacheKey = key
    cacheValue = {
      text: clampChars(parts.join('\n\n')),
      sources: sources.map((source) => source.path),
      chars: parts.join('\n\n').length,
    }
    return cacheValue
  }

  compose.sync = () => {
    syncStats = syncDirectory(config)
    return syncStats
  }
  compose.stats = () => syncStats
  return compose
}

function stamp(mtimeMs) {
  if (!mtimeMs) return '未知'
  return new Date(mtimeMs).toLocaleString('zh-CN', { hour12: false })
}

function today() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function appendEntry(config, category, text, source) {
  const target = APPEND_TARGETS[category] ?? APPEND_TARGETS.character
  const path = join(config.personaDir, target.file)
  mkdirSync(config.personaDir, { recursive: true })
  if (!existsSync(path)) {
    writeFileSync(path, `# ${target.label}\n\n> 由 AI 追加，带日期与来源。删掉某一行，下一轮就不再注入。\n\n`, 'utf8')
  }
  const line = `- ${today()} · ${text}${source.length > 0 ? ` · 来源：${source}` : ''}`
  appendFileSync(path, `${line}\n`, 'utf8')
  return { path, line, category, file: target.file }
}

/** Filenames the editor accepts: a plain .md directly inside the persona directory. */
const EDITABLE_FILE = /^(?!_|\.)[^\\/]+\.md$/

function editableTarget(config, file) {
  const name = typeof file === 'string' ? file.trim() : ''
  if (!EDITABLE_FILE.test(name)) {
    throw new Error('file 必须是 personaDir 下的 .md 文件名：不能带路径，不能以 _ 或 . 开头')
  }
  const path = join(config.personaDir, name)
  if (!resolve(path).startsWith(`${resolve(config.personaDir)}${sep}`)) {
    throw new Error('目标不在人设目录里')
  }
  return { name, path }
}

/** One rolling copy per file, so a bad edit is recoverable without version control. */
function keepBackup(config, name, text) {
  try {
    const dir = join(config.personaDir, '.kujira-backup')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, name), text, 'utf8')
  } catch {
    // A failed backup must not block the edit the user asked for.
  }
}

function replaceInFile(config, file, oldText, newText) {
  const { name, path } = editableTarget(config, file)
  if (!existsSync(path)) throw new Error(`${name} 不存在；新增用 action=append`)
  const text = readFileSync(path, 'utf8')
  const hits = oldText.length === 0 ? 0 : text.split(oldText).length - 1
  if (hits === 0) throw new Error(`${name} 里找不到要替换的文本`)
  if (hits > 1) throw new Error(`要替换的文本在 ${name} 里出现 ${hits} 次，写具体一点`)
  keepBackup(config, name, text)
  writeFileSync(path, text.replace(oldText, () => newText), 'utf8')
  return { action: 'replace', file: name, path, note: `已替换 ${name}` }
}

function deleteFromFile(config, file, oldText) {
  const { name, path } = editableTarget(config, file)
  if (!existsSync(path)) throw new Error(`${name} 不存在`)
  const text = readFileSync(path, 'utf8')
  if (oldText.length === 0) {
    keepBackup(config, name, text)
    rmSync(path)
    return { action: 'delete', file: name, path, note: `已删除 ${name}` }
  }
  const hits = text.split(oldText).length - 1
  if (hits === 0) throw new Error(`${name} 里找不到要删除的文本`)
  if (hits > 1) throw new Error(`要删除的文本在 ${name} 里出现 ${hits} 次，写具体一点`)
  keepBackup(config, name, text)
  writeFileSync(path, text.replace(oldText, ''), 'utf8')
  return { action: 'delete', file: name, path, note: `已从 ${name} 删掉该段` }
}

function listDossier(config) {
  return loadDirectory(config.personaDir).map((source) => ({
    file: basename(source.path),
    chars: source.text.length,
  }))
}

function statusText(config, value, stats) {
  const synced = stats === null
    ? '同步：尚未运行'
    : `同步：新增 ${stats.added} / 更新 ${stats.updated} / 保留你的修改 ${stats.kept}`
  return [
    `人设插件：${config.enabled ? '开启' : '关闭'}`,
    `人设目录：${config.personaDir}`,
    `注入文件：${value.sources.length} 个 / 共 ${value.chars} 字符`,
    `记忆文件：${config.memoryFile}`,
    `AI 可写：${config.allowAgentWrite ? '是（persona_edit）' : '否'}`,
    synced,
    `分区：${SECTION_NAME}（order ${SECTION_ORDER}）`,
    '',
    '/persona files —— 列出这一次注入了哪些文件',
    '/persona show  —— 看注入全文',
    '/persona sync  —— 立即把包内更新同步进人设目录',
    '/remember 一句话 —— 追加一条记忆',
  ].join('\n')
}

export function apply(ctx, rawConfig) {
  const config = normalise(rawConfig)
  if (!config.enabled) return

  const compose = createComposer(config)

  ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: SECTION_ORDER,
    interpolate: false,
    text: () => {
      try {
        return compose().text
      } catch {
        return ''
      }
    },
  })

  if (config.allowAgentWrite) {
    ctx.inject(['tools'], (scope) => scope.tools.register({
      name: 'persona_edit',
      description:
        '编辑鲸鱼娘人设目录：查到的原作资料、新设定、新梗写回去；写错的旧条目可以改、可以删。'
        + 'action=append 新增 / replace 改一条 / delete 删一条或整个文件 / list 看有哪些文件。'
        + '改完下一步请求即生效。越界或找不到目标时返回错误。',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['append', 'replace', 'delete', 'list'],
            description: '默认 append。',
          },
          category: {
            type: 'string',
            enum: ['character', 'world', 'meme', 'memory'],
            description: 'append 时用：character=人设，world=世界观，meme=梗，memory=记忆。',
          },
          file: {
            type: 'string',
            description: 'replace / delete 时用：人设目录里的 .md 文件名，如 10-外观.md。append 时给 file 就追加到那个文件。',
          },
          oldText: { type: 'string', description: 'replace / delete 时用：要改或要删的那段原文，必须在文件里唯一。' },
          newText: { type: 'string', description: 'replace 时用：替换成什么。' },
          text: { type: 'string', description: 'append 时用：一条内容，最多 4000 字。' },
          source: { type: 'string', description: '来源：链接、作者、视频号或「用户口述」。' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            path: { type: 'string' },
            note: { type: 'string' },
            files: { type: 'array', items: { type: 'object' } },
          },
          required: ['action'],
        },
        render(_args, value) {
          if (value.action === 'list') {
            const files = Array.isArray(value.files) ? value.files : []
            return [{ type: 'text', text: files.map((item) => `${item.file}（${item.chars} 字符）`).join('\n') || '（空）' }]
          }
          return [{ type: 'text', text: `${value.note ?? '已写入'}\n${value.path ?? ''}\n下一步生效。` }]
        },
      },
      async execute(args) {
        const input = args !== null && typeof args === 'object' ? args : {}
        const action = typeof input.action === 'string' ? input.action : 'append'
        const source = typeof input.source === 'string' ? input.source.trim() : ''
        const oldText = typeof input.oldText === 'string' ? input.oldText : ''
        const newText = typeof input.newText === 'string' ? input.newText : ''

        if (action === 'list') return { action, files: listDossier(config) }

        if (action === 'replace') {
          if (input.file === undefined) throw new Error('replace 需要 file')
          if (oldText.length === 0) throw new Error('replace 需要 oldText')
          return replaceInFile(config, input.file, oldText, newText)
        }

        if (action === 'delete') {
          if (input.file === undefined) throw new Error('delete 需要 file')
          return deleteFromFile(config, input.file, oldText)
        }

        if (action !== 'append') throw new Error(`未知 action：${action}`)

        const text = typeof input.text === 'string' ? input.text.trim() : ''
        if (text.length === 0) throw new Error('append 需要 text')
        if (text.length > MAX_APPEND_CHARS) throw new Error(`单条最多 ${MAX_APPEND_CHARS} 字，长文请拆条`)

        const line = `- ${today()} · ${text}${source.length > 0 ? ` · 来源：${source}` : ''}`

        if (typeof input.file === 'string' && input.file.trim().length > 0) {
          const { name, path } = editableTarget(config, input.file)
          const existing = existsSync(path) ? readFileSync(path, 'utf8') : `# ${name}\n\n`
          writeFileSync(path, `${existing.endsWith('\n') ? existing : `${existing}\n`}${line}\n`, 'utf8')
          return { action: 'append', path, file: name, note: `已追加到 ${name}` }
        }

        const written = appendEntry(
          config,
          typeof input.category === 'string' ? input.category : 'character',
          text,
          source,
        )
        return { action: 'append', path: written.path, file: written.file, note: written.line }
      },
    }))
  }

  ctx.inject(['commands'], (scope) => {
    scope.commands.register({
      name: 'persona',
      description: '查看鲸鱼娘人设的注入状态、文件清单与全文',
      input: { hint: 'files | show' },
      handler: (invocation) => {
        const value = compose()
        const argument = invocation.rawInput.trim()

        if (argument === 'show') return { kind: 'success', text: value.text }
        if (argument === 'sync') {
          const stats = compose.sync()
          return {
            kind: 'success',
            text: `同步完成：新增 ${stats.added} / 更新 ${stats.updated} / 保留你的修改 ${stats.kept} / 已是最新 ${stats.upToDate}`,
          }
        }
        if (argument === 'files') {
          if (value.sources.length === 0) {
            return { kind: 'success', text: `档案目录里没有可注入的 .md 文件：${config.personaDir}` }
          }
          const lines = value.sources.map((path) => {
            const info = readSource(path)
            return `- ${path}（${info.text.length} 字符，${stamp(info.mtimeMs)}）`
          })
          return { kind: 'success', text: [`注入 ${value.sources.length} 个文件：`, ...lines].join('\n') }
        }
        return { kind: 'success', text: statusText(config, value, compose.stats()) }
      },
    })

    scope.commands.register({
      name: 'remember',
      description: '把一句话追加进人设记忆文件，下一轮生效',
      input: { hint: '要记住的一句话' },
      handler: (invocation) => {
        const text = invocation.rawInput.trim()
        if (text.length === 0) return { kind: 'error', text: '用法：/remember 要记住的一句话' }
        try {
          const written = appendEntry(config, 'memory', text, '用户口述')
          return { kind: 'success', text: `记住了：${written.line}\n写进 ${written.path}，下一轮生效。` }
        } catch (error) {
          return { kind: 'error', text: `没写进去：${error instanceof Error ? error.message : String(error)}` }
        }
      },
    })
  })
}
