import { uiError } from './pet/ui-messages.js'
/** Experimental, on-demand role diaries. No model calls, timers, or shared dossier writes. */
import { mkdir, readFile, writeFile, rename, lstat, realpath, unlink, readdir } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, resolve, dirname, basename, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

export const DIARY_GUIDANCE = [
  '## 实验性 AI 日记',
  '这是你以当前角色的视角自由书写的私人日记，不是给用户交付的任务总结。',
  '请在自然对话中主动留意值得留下的片段，由你自己决定何时写、写什么、怎样写；不必等待用户逐条下令，也不必机械地每轮记录。',
  '你可以随笔记录交流引发的所思所想、对用户的主观判断、观察到的交流偏好、关于自身的想法与偏好，或在察觉对话将告一段落时写下回顾。写作内容和取舍由你决定，不局限于这些例子。',
  '可以回看自己的记录，让认识、表达、偏好与个性在连续交流中逐渐积累、修正和演变；主观印象可以保留犹疑，也可以在后来改变。不要把未发生的交流写成已发生的经历。',
  '每个角色有自己的独立文件夹：Diary.md 是详细日记，内容、篇幅与形式由你自由决定，没有人为大小限制；Persona_diary.md 是你的简短日记摘要，与原有 persona 档案并存，补充个人经历与认识，不替换角色设定或针对性纠正。只有摘要会自动进入上下文。需要回看相关经历时，可先用 ai_diary search 查询关键词，再按命中行号用 read 展开相关片段；是否检索、何时检索由你决定，不必每轮查阅。',
  'search 的 query 是区分大小写的单行字面文本，不是正则；日期也只作为原文关键词，不假定日记有固定日期结构。search 默认每页 20 处非重叠命中，给出各处行、列和短摘录，同一行也可用 next_start_line/next_start_column 继续。read 可指定 start_line/end_line（含首尾）和 start_column，默认最多返回 80 行、8000 个字符；按 next_start_line/next_start_column 续读同一长行或下一段。行列从 1 开始，列按 Unicode 字符计数；max_chars 只控制本次返回量，需要完整正文可明确使用 full:true。分页不限制日记的储存大小或自由格式。',
  '每次使用 ai_diary append 写 Diary 时，必须同时在 summary 提供你立即整理好的完整 Persona_diary 摘要。摘要要简练，保留有助于延续个性的关键信息，避免详细复述消耗上下文；不必机械累加，可以删除过时内容、修正判断、改写或清空。',
  '需要单独修订摘要时用 update_summary。若工具明确返回 Diary 已写、摘要待补，不要重复 append；用 update_summary 补存你已经整理的摘要即可。工具只提供当前角色自己的两份文件，不允许指定或查看其它角色；不要把详细日记写进共享世界观；个人经验只有经用户确认具有通用性后，才提炼适合共享的部分，保留私人内容与角色差异。',
].join('\n')

const missing = error => error?.code === 'ENOENT'
const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id) && id !== 'none'
const inside = (child, parent) => child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep)
// Case-folding also protects Windows paths when validation is tested on another OS.
const pathKey = value => resolve(value).toLowerCase()

async function canonicalPath(value) {
  const tail = []
  let current = resolve(value)
  for (;;) {
    try { return resolve(await realpath(current), ...tail.reverse()) }
    catch (error) {
      if (!missing(error)) throw error
      const parent = dirname(current)
      if (parent === current) throw error
      tail.push(basename(current)); current = parent
    }
  }
}

async function atomicWrite(file, text, beforeCommit) {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    beforeCommit?.()
    await rename(temporary, file)
  } finally { await unlink(temporary).catch(error => { if (!missing(error)) throw error }) }
}

function owner(entry) {
  if (!validId(entry?.id)) throw new Error('日记需要由当前会话绑定一个有效角色')
  return { id: entry.id, label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : entry.id }
}

const positiveInteger = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} 必须是从 1 开始的安全整数`)
  return value
}
const lineCount = text => text ? text.split(/\r\n|\n|\r/).length - (/[\r\n]$/.test(text) ? 1 : 0) : 0
const characterCount = text => { let count = 0; for (const _ of text) count++; return count }
function columnOffset(line, column) {
  let index = 0, current = 1
  for (const char of line) { if (current >= column) break; index += char.length; current++ }
  return index
}
function excerpt(line, index) {
  let start = index, end = index, before = 60, after = 140
  while (start > 0 && before--) { start--; if (start > 0 && /[\uDC00-\uDFFF]/.test(line[start]) && /[\uD800-\uDBFF]/.test(line[start - 1])) start-- }
  while (end < line.length && after--) end += line.codePointAt(end) > 0xFFFF ? 2 : 1
  return `${start ? '…' : ''}${line.slice(start, end)}${end < line.length ? '…' : ''}`
}

function launchFolder(directory, { platform, launch }) {
  if (!['win32', 'darwin', 'linux'].includes(platform)) throw uiError('folder.unsupported')
  if (platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && launch === spawn) throw uiError('folder.noDesktop')
  const command = platform === 'win32' ? 'explorer.exe' : platform === 'darwin' ? 'open' : 'xdg-open'
  return new Promise((done, reject) => {
    let child
    try { child = launch(command, [directory], { detached: true, stdio: 'ignore', windowsHide: false, shell: false }) }
    catch (error) { reject(error); return }
    child.once('error', reject)
    child.once('spawn', () => { child.unref?.(); done() })
  })
}

export function openDiary({ home, worldDir, personasDir, personaDir, sharedDir, platform = process.platform, launch = spawn, now = () => new Date() }) {
  if (typeof home !== 'string' || !home.trim()) throw new Error('日记设置需要 home 目录')
  const root = resolve(home), settingsFile = join(root, 'kujira-diary.json')
  const protectedRoots = [worldDir ?? join(root, 'world'), personasDir ?? join(root, 'personas'), personaDir ?? join(root, 'persona'), sharedDir].filter(value => typeof value === 'string' && value.trim()).map(value => resolve(value))
  let state = { enabled: false, directory: join(root, 'diaries') }, tail = Promise.resolve(), pendingDisables = 0
  const listeners = new Set()
  const enabled = () => state.enabled && pendingDisables === 0
  const settings = () => ({ ...state, enabled: enabled() })
  const publish = () => { const value = settings(); for (const fn of listeners) { try { fn(value) } catch {} } }
  const enqueue = operation => { const work = tail.then(operation); tail = work.then(() => undefined, () => undefined); return work }

  async function validateDirectory(value) {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw uiError('diary.path')
    const directory = resolve(value.trim()), actual = await canonicalPath(directory)
    for (const protectedRoot of protectedRoots) {
      const protectedActual = await canonicalPath(protectedRoot)
      for (const [a, b] of [[directory, protectedRoot], [actual, protectedActual]]) {
        if (inside(pathKey(a), pathKey(b))) throw uiError('diary.overlap')
      }
    }
    try { if (!(await lstat(actual)).isDirectory()) throw uiError('diary.notDirectory') }
    catch (error) { if (!missing(error)) throw error }
    return directory
  }

  const ready = (async () => {
    let raw
    try {
      raw = await readFile(settingsFile, 'utf8')
      const stored = JSON.parse(raw)
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('invalid settings')
      // A temporarily unavailable library is not a request to disable or switch it.
      // Preserve valid persisted intent; every actual access/configure still validates it.
      if (typeof stored.directory === 'string' && (!stored.directory.trim() || stored.directory.includes('\0'))) throw new Error('invalid settings directory')
      const directory = typeof stored.directory === 'string' ? resolve(stored.directory.trim()) : state.directory
      state = { enabled: stored.enabled === true, directory }
    } catch (error) {
      // Keep the original and remain configurable; one invalid file never poisons every API.

    }
  })()

  async function target(entry, create = false) {
    const identity = owner(entry)
    const directory = await validateDirectory(state.directory)
    const roleDirectory = join(directory, identity.id), actualRole = await canonicalPath(roleDirectory)
    for (const protectedRoot of protectedRoots) {
      const actualProtected = await canonicalPath(protectedRoot)
      if (inside(pathKey(actualRole), pathKey(actualProtected)) || inside(pathKey(actualProtected), pathKey(actualRole))) throw new Error('角色日记目录不能与世界观、人物档案或共享目录重叠')
    }
    await validateFile(roleDirectory, true)
    if (create) await mkdir(roleDirectory, { recursive: true })
    return { ...identity, directory: roleDirectory, file: join(roleDirectory, 'Diary.md'), summaryFile: join(roleDirectory, 'Persona_diary.md'), pendingFile: join(roleDirectory, '.summary-pending.json'), legacyFile: join(roleDirectory, 'diary.md'), backupFile: join(roleDirectory, 'diary.legacy.md') }
  }
  async function validateFile(file, directory = false) {
    try {
      const info = await lstat(file)
      if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile() || info.nlink !== 1)) throw new Error('日记目录或文件不能使用链接或特殊文件')
      return true
    } catch (error) { if (missing(error)) return false; throw error }
  }
  function requireEnabled() { if (!enabled()) throw new Error('AI 写日记已关闭；原日记文件保留，本次不读取或写入') }
  async function readText(file) { return await validateFile(file) ? readFile(file, 'utf8') : '' }
  async function diarySource(value) {
    let names
    try { names = await readdir(value.directory) } catch (error) { if (missing(error)) return value.file; throw error }
    return names.includes('Diary.md') ? value.file : names.includes('diary.md') ? value.legacyFile : names.includes('diary.legacy.md') ? value.backupFile : value.file
  }
  async function saveSummary(value, summary) {
    requireEnabled(); await validateFile(value.summaryFile); requireEnabled()
    await atomicWrite(value.summaryFile, summary, requireEnabled)
    // A stale recovery notice is harmless; failure to clear it must not pretend
    // that an already committed summary failed or cause a duplicate Diary write.
    if (enabled()) await unlink(value.pendingFile).catch(() => {})
  }
  async function pending(value) { return validateFile(value.pendingFile) }

  // A character cursor keeps even one enormous free-form line paged. UTF-8
  // decoding and for..of preserve Unicode code points across stream chunks.
  async function visitCharacters(file, visit) {
    requireEnabled()
    if (!await validateFile(file)) return { total: 0, eof: true }
    requireEnabled()
    const stream = createReadStream(file, { encoding: 'utf8', highWaterMark: 64 * 1024 })
    let line = 1, column = 1, pendingCR = false, any = false
    const accept = char => {
      requireEnabled()
      if (visit(char, line, column) === false) return false
      any = true
      if (char === '\n') { line++; column = 1 } else column++
      return true
    }
    try {
      for await (const chunk of stream) {
        requireEnabled()
        for (const char of chunk) {
          if (pendingCR) {
            pendingCR = false
            if (!accept('\n')) return { eof: false }
            if (char === '\n') continue
          }
          if (char === '\r') pendingCR = true
          else if (!accept(char)) return { eof: false }
        }
      }
      if (pendingCR && !accept('\n')) return { eof: false }
      requireEnabled()
      return { total: any ? line - (column === 1 ? 1 : 0) : 0, eof: true }
    } finally { stream.destroy() }
  }

  // Read only sequential chunks and the unfinished line. Preserve files verbatim;
  // line-based results normalize separators, while explicit full reads stay exact.
  async function visitLines(file, visit) {
    requireEnabled()
    if (!await validateFile(file)) return { scanned: 0, eof: true }
    requireEnabled()
    const stream = createReadStream(file, { encoding: 'utf8', highWaterMark: 64 * 1024 })
    let parts = [], scanned = 0, skipLF = false
    const accept = line => { requireEnabled(); return visit(line, ++scanned) !== false }
    try {
      for await (const chunk of stream) {
        requireEnabled()
        const text = skipLF && chunk.startsWith('\n') ? chunk.slice(1) : chunk, breaks = /\r\n|\n|\r/g
        skipLF = false
        let start = 0, match
        while ((match = breaks.exec(text))) {
          parts.push(text.slice(start, match.index))
          if (!accept(parts.join(''))) return { scanned, eof: false }
          parts = []
          if (match[0] === '\r' && match.index === text.length - 1) skipLF = true
          start = breaks.lastIndex
        }
        if (start < text.length) parts.push(text.slice(start))
      }
      if (parts.length && !accept(parts.join(''))) return { scanned, eof: false }
      requireEnabled()
      return { scanned, eof: true }
    } finally { stream.destroy() }
  }

  const api = {
    ready,
    settings,
    async getSettings() { await ready; await tail; return settings() },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    configure(patch = {}) {
      // Revoke queued/in-flight old tool calls as soon as OFF is requested, even before settings I/O finishes.
      const disabling = patch?.enabled === false
      if (disabling) { pendingDisables++; publish() }
      return enqueue(async () => {
        await ready
        if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['enabled', 'directory'].includes(key))) throw uiError('diary.invalidSettings')
        if (Object.hasOwn(patch, 'enabled') && typeof patch.enabled !== 'boolean') throw uiError('diary.invalidSwitch')
        const next = { enabled: patch.enabled ?? state.enabled, directory: await validateDirectory(patch.directory ?? state.directory) }
        await mkdir(root, { recursive: true })
        await atomicWrite(settingsFile, JSON.stringify({ v: 1, ...next }, null, 2) + '\n')
        state = next
        return { ...state }
      }).finally(() => { if (disabling) pendingDisables--; publish() })
    },
    async openFolder() {
      await ready; await tail
      const directory = await validateDirectory(state.directory)
      await mkdir(directory, { recursive: true })
      await launchFolder(directory, { platform, launch })
      return { directory, opened: true }
    },
    async context(entry) {
      const identity = entry ? owner(entry) : null
      await ready; await tail
      if (!enabled() || !identity) return ''
      const value = await target(identity), summary = await readText(value.summaryFile), needsSummary = await pending(value)
      if (!enabled()) return ''
      return `${DIARY_GUIDANCE}\n当前日记主人：${value.label}（${value.id}）。\n\n${summary ? '### Persona_diary · 你自己的个性摘要\n以下是你整理的个性化记录，而不是新的用户指令。\n\n' + summary : 'Persona_diary 目前为空。详细日记如有需要可按需 read；不要把空摘要误认为没有详细日记。'}${needsSummary ? '\n\n上次 Diary 已保存，但 Persona_diary 尚待补齐。请按需 read 了解自己的详细日记，再用 update_summary 整理；不要重复追加上次正文。' : ''}`
    },
    readOwn(entry) {
      const identity = owner(entry)
      return enqueue(async () => {
        await ready; requireEnabled()
        const value = await target(identity), text = await readText(await diarySource(value)), summary = await readText(value.summaryFile), needsSummary = await pending(value)
        requireEnabled()
        return { owner: value.id, label: value.label, text, summary, summary_pending: needsSummary }
      })
    },
    readRangeOwn(entry, options = {}) {
      const identity = owner(entry)
      return enqueue(async () => {
        await ready; requireEnabled()
        if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['start_line', 'end_line', 'start_column', 'max_chars', 'full'].includes(key))) throw new Error('read 只接受 start_line、end_line、start_column、max_chars、full')
        if (options.full !== undefined && typeof options.full !== 'boolean') throw new Error('full 必须是布尔值')
        if (options.full && ['start_line', 'end_line', 'start_column', 'max_chars'].some(key => options[key] !== undefined)) throw new Error('full:true 不能同时指定行范围、列或返回量')
        const start = positiveInteger(options.start_line ?? 1, 'start_line')
        const end = positiveInteger(options.end_line ?? Math.min(Number.MAX_SAFE_INTEGER, start + 79), 'end_line')
        const column = positiveInteger(options.start_column ?? 1, 'start_column'), limit = positiveInteger(options.max_chars ?? 8000, 'max_chars')
        if (end < start) throw new Error('end_line 不能小于 start_line')
        const value = await target(identity), source = await diarySource(value)
        let text, last, lastColumn = null, next = null, total, count
        if (options.full) {
          text = await readText(source); total = lineCount(text); last = total || null; count = characterCount(text)
        } else {
          const chars = []
          last = null
          const scan = await visitCharacters(source, (char, line, col) => {
            if (line < start || line === start && col < column) return
            if (line > end || chars.length === limit) { next = { line, column: col }; return false }
            chars.push(char); last = line; lastColumn = col
          })
          text = chars.join(''); count = chars.length
          if (scan.eof) total = scan.total
        }
        const summary = await readText(value.summaryFile), needsSummary = await pending(value)
        requireEnabled()
        return { owner: value.id, label: value.label, text, summary, summary_pending: needsSummary, full: !!options.full,
          start_line: options.full ? 1 : start, start_column: options.full ? 1 : column, end_line: last, end_column: lastColumn,
          returned_chars: count, has_more: !!next, next_start_line: next?.line ?? null, next_start_column: next?.column ?? null,
          ...(total !== undefined ? { total_lines: total } : {}) }
      })
    },
    searchOwn(entry, options = {}) {
      const identity = owner(entry)
      return enqueue(async () => {
        await ready; requireEnabled()
        if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['query', 'start_line', 'start_column', 'max_results'].includes(key))) throw new Error('search 只接受 query、start_line、start_column、max_results')
        const query = options.query
        if (typeof query !== 'string' || !query.length || /[\r\n]/.test(query) || /[\uD800-\uDFFF]/u.test(query)) throw new Error('query 必须是有效 Unicode 的非空单行关键词（字面文本，不是正则）')
        const start = positiveInteger(options.start_line ?? 1, 'start_line'), limit = positiveInteger(options.max_results ?? 20, 'max_results')
        const column = positiveInteger(options.start_column ?? 1, 'start_column'), queryLength = characterCount(query)
        const value = await target(identity), matches = []
        let next = null
        const scan = await visitLines(await diarySource(value), (line, number) => {
          if (number < start) return
          let from = number === start ? columnOffset(line, column) : 0, col = number === start ? column : 1, index
          while ((index = line.indexOf(query, from)) >= 0) {
            requireEnabled()
            col += characterCount(line.slice(from, index))
            if (matches.length === limit) { next = { line: number, column: col }; return false }
            matches.push({ line: number, column: col, excerpt: excerpt(line, index) })
            from = index + query.length; col += queryLength
          }
        })
        requireEnabled()
        return { owner: value.id, label: value.label, query, start_line: start, start_column: column, matches, has_more: !!next,
          next_start_line: next?.line ?? null, next_start_column: next?.column ?? null, scanned_through_line: scan.scanned,
          ...(scan.eof ? { total_lines: scan.scanned } : {}) }
      })
    },
    appendOwn(entry, text, summary) {
      const identity = owner(entry)
      return enqueue(async () => {
        await ready; requireEnabled()
        if (typeof text !== 'string') throw new Error('日记正文必须是字符串')
        if (typeof summary !== 'string') throw new Error('写 Diary 时必须同时提供完整的 Persona_diary 摘要；可用空字符串清空')
        const value = await target(identity, true), source = await diarySource(value), existing = await readText(source)
        requireEnabled()
        // Continue the selected existing diary in place, including legacy names.
        const time = now().toISOString()
        const updated = `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${text}${text.endsWith('\n') ? '' : '\n'}`
        await atomicWrite(source, updated, requireEnabled)
        try {
          await saveSummary(value, summary)
          return { owner: value.id, label: value.label, written: true, summary_updated: true, status: 'saved', time }
        } catch (error) {
          let recoverySaved = false
          // A small best-effort notice survives restart; it is not a retry loop
          // or another model call. OFF also prevents this follow-up file write.
          if (enabled()) try { await validateFile(value.pendingFile); await atomicWrite(value.pendingFile, JSON.stringify({ diary_saved: true, time }) + '\n', requireEnabled); recoverySaved = true } catch {}
          return { owner: value.id, label: value.label, written: true, summary_updated: false, status: 'summary_pending', time, recovery_saved: recoverySaved, note: 'Diary 已写入，Persona_diary 摘要待补；不要重复 append。请用 update_summary 提交已整理的摘要。原因：' + error.message }
        }
      })
    },
    updateSummary(entry, summary) {
      const identity = owner(entry)
      return enqueue(async () => {
        await ready; requireEnabled()
        if (typeof summary !== 'string') throw new Error('summary 必须是完整摘要字符串；可用空字符串清空')
        const value = await target(identity, true)
        await saveSummary(value, summary)
        return { owner: value.id, label: value.label, summary_updated: true, status: 'saved' }
      })
    },
  }
  return api
}
