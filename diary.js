/** Experimental, on-demand role diaries. No model calls, timers, or shared dossier writes. */
import { mkdir, readFile, writeFile, rename, lstat, realpath, unlink, readdir } from 'node:fs/promises'
import { join, resolve, dirname, basename, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

export const DIARY_GUIDANCE = [
  '## 实验性 AI 日记',
  '这是你以当前角色的视角自由书写的私人日记，不是给用户交付的任务总结。',
  '请在自然对话中主动留意值得留下的片段，由你自己决定何时写、写什么、怎样写；不必等待用户逐条下令，也不必机械地每轮记录。',
  '你可以随笔记录交流引发的所思所想、对用户的主观判断、观察到的交流偏好、关于自身的想法与偏好，或在察觉对话将告一段落时写下回顾。写作内容和取舍由你决定，不局限于这些例子。',
  '可以回看自己的记录，让认识、表达、偏好与个性在连续交流中逐渐积累、修正和演变；主观印象可以保留犹疑，也可以在后来改变。不要把未发生的交流写成已发生的经历。',
  '每个角色有自己的独立文件夹：Diary.md 是详细日记，内容、篇幅与形式由你自由决定，没有人为大小限制；Persona_diary.md 是纳入你个性化 persona 的简短摘要。只有摘要会自动进入上下文，详细日记需要时再用 ai_diary read 读取。',
  '每次使用 ai_diary append 写 Diary 时，必须同时在 summary 提供你立即整理好的完整 Persona_diary 摘要。摘要要简练，保留有助于延续个性的关键信息，避免详细复述消耗上下文；不必机械累加，可以删除过时内容、修正判断、改写或清空。',
  '需要单独修订摘要时用 update_summary。若工具明确返回 Diary 已写、摘要待补，不要重复 append；用 update_summary 补存你已经整理的摘要即可。工具只提供当前角色自己的两份文件，不允许指定或查看其它角色；不要把详细日记写进共享世界观。',
].join('\n')

const missing = error => error?.code === 'ENOENT'
const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id) && id !== 'none'
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

function launchFolder(directory, { platform, launch }) {
  if (!['win32', 'darwin', 'linux'].includes(platform)) throw new Error('当前系统暂无文件夹打开方式，可复制路径后打开。')
  if (platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && launch === spawn) throw new Error('当前宿主没有图形桌面；请在运行 DSH 的电脑上查看此路径。')
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
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error('请填写有效的日记文件夹路径')
    const directory = resolve(value.trim()), actual = await canonicalPath(directory)
    for (const protectedRoot of protectedRoots) {
      const protectedActual = await canonicalPath(protectedRoot)
      for (const [a, b] of [[directory, protectedRoot], [actual, protectedActual]]) {
        if (inside(pathKey(a), pathKey(b)) || inside(pathKey(b), pathKey(a))) throw new Error('日记文件夹必须独立于世界观、人物档案和共享偏好目录，不能与其重叠')
      }
    }
    try { if (!(await lstat(actual)).isDirectory()) throw new Error('日记文件夹路径不是目录') }
    catch (error) { if (!missing(error)) throw error }
    return directory
  }

  const ready = (async () => {
    let stored
    try { stored = JSON.parse(await readFile(settingsFile, 'utf8')) }
    catch (error) { if (missing(error)) return; throw new Error('日记设置读取失败，未启用或覆盖原文件：' + error.message) }
    if (!stored || stored.v !== 1 || typeof stored.enabled !== 'boolean' || typeof stored.directory !== 'string') throw new Error('日记设置格式无效，未启用或覆盖原文件')
    const directory = await validateDirectory(stored.directory)
    state = { enabled: stored.enabled, directory }
  })()

  async function target(entry, create = false) {
    const identity = owner(entry)
    const directory = await validateDirectory(state.directory)
    const roleDirectory = join(directory, identity.id)
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
        if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['enabled', 'directory'].includes(key))) throw new Error('无效的日记设置')
        if (Object.hasOwn(patch, 'enabled') && typeof patch.enabled !== 'boolean') throw new Error('日记开关必须是布尔值')
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
    appendOwn(entry, text, summary) {
      const identity = owner(entry)
      return enqueue(async () => {
        await ready; requireEnabled()
        if (typeof text !== 'string' || !text.trim()) throw new Error('日记正文不能为空')
        if (typeof summary !== 'string') throw new Error('写 Diary 时必须同时提供完整的 Persona_diary 摘要；可用空字符串清空')
        const value = await target(identity, true), source = await diarySource(value), existing = await readText(source)
        requireEnabled()
        // On case-insensitive systems Diary.md and legacy diary.md are the same
        // path. Preserve the old original under a distinct name before creating
        // the new canonical file; a failed new write remains readable there.
        if (source === value.legacyFile && ['win32', 'darwin'].includes(platform)) {
          if (await validateFile(value.backupFile)) throw new Error('旧日记保留文件已存在；请先检查 diary.legacy.md，不会覆盖旧资料')
          requireEnabled(); await rename(value.legacyFile, value.backupFile)
        }
        const time = now().toISOString()
        const updated = `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${text}${text.endsWith('\n') ? '' : '\n'}`
        await atomicWrite(value.file, updated, requireEnabled)
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
