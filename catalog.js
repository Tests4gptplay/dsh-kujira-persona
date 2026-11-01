/** Model-family routing and user-authored persona bindings. No background work. */
import { mkdir, readFile, rename, writeFile, lstat, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const BUILTINS = [
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'gpt', label: 'GPT' },
  { id: 'gemini', label: 'Gemini · 星猫' },
  { id: 'claude', label: 'Claude' },
  { id: 'grok', label: 'Grok' },
  { id: 'glm', label: 'GLM' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'qwen', label: 'Qwen' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'llama', label: 'Llama' },
  { id: 'doubao', label: '豆包 / Seed' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'hunyuan', label: '混元' },
  { id: 'mimo', label: 'MiMo' },
  { id: 'stella', label: '星璃', hidden: true },
]

const FAMILIES = [
  ['deepseek', /^deepseek(?:[-._:]|\d|$)/],
  ['gpt', /^(?:gpt(?:[-._:]|\d|$)|chatgpt(?:[-._:]|\d|$)|o[1-9]\d*(?:[-._:]|$)|codex(?:[-._:]|$))/],
  ['gemini', /^gemini(?:[-._:]|\d|$)/],
  ['claude', /^claude(?:[-._:]|\d|$)/],
  ['grok', /^grok(?:[-._:]|\d|$)/],
  ['glm', /^(?:glm|chatglm)(?:[-._:]|\d|$)/],
  ['kimi', /^(?:kimi|moonshot)(?:[-._:]|\d|$)/],
  ['qwen', /^(?:qwen|qwq|qvq)(?:[-._:]|\d|$)/],
  ['minimax', /^mini-?max(?:[-._:]|\d|$)/],
  ['llama', /^(?:meta-)?llama(?:[-._:]|\d|$)/],
  ['doubao', /^(?:doubao|seed)(?:[-._:]|\d|$)/],
  ['mistral', /^(?:mistral|mixtral|ministral|devstral|codestral|magistral)(?:[-._:]|\d|$)/],
  ['hunyuan', /^hunyuan(?:[-._:]|\d|$)/],
  ['mimo', /^mimo(?:[-._:]|\d|$)/],
]
const text = value => typeof value === 'string' ? value.trim() : ''
const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value) && value !== 'none'

/** Match model identity, never display names or API protocol. Versions share a family. */
export function modelFamily(route) {
  let model = text(route.model).toLowerCase().split('/').at(-1).replace(/^ft:/, '')
  // Bedrock region/vendor prefixes, e.g. us.anthropic.claude-sonnet-4-5-20250929-v1:0.
  model = model.replace(/^(?:us|eu|apac|global)\./, '')
    .replace(/^(?:anthropic|meta|openai|google|amazon|mistralai)\./, '')
  for (const [id, pattern] of FAMILIES) if (pattern.test(model)) return id
  // Only resolve the adapter's explicit default alias by route. A different or
  // opaque model name must not be assigned a fictional identity by its provider.
  const provider = text(route.provider).toLowerCase()
  if (model === 'default') {
    if (provider === 'codex-local' || provider === 'openai-codex') return 'gpt'
    if (/^deepseek-(?:official|account|messages)$/.test(provider)) return 'deepseek'
  }
  return 'none'
}

function matches(value, pattern) {
  if (pattern === undefined) return true
  const escaped = pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${escaped}$`, 'i').test(text(value))
}
const matchesRule = (route, rule) => matches(route.provider, rule.provider) && matches(route.model, rule.model)

export function parseCatalog(raw) {
    const object = JSON.parse(raw)
    if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('invalid catalog')
    const personas = (Array.isArray(object.personas) ? object.personas : []).filter(p => p && safeId(p.id) && typeof p.label === 'string')
    const ids = new Set(['none', ...BUILTINS.map(p => p.id), ...personas.map(p => p.id)])
    const bindings = (Array.isArray(object.bindings) ? object.bindings : []).filter(b => b && ids.has(b.persona)
      && (b.provider === undefined || typeof b.provider === 'string') && (b.model === undefined || typeof b.model === 'string')
      && (text(b.provider) || text(b.model)))
    const valid = Array.isArray(object.personas) && Array.isArray(object.bindings)
      && personas.length === object.personas.length && bindings.length === object.bindings.length
    return { value: { ...object, personas, bindings }, valid }
  }

/** The registry contains only role names and model bindings, never model credentials. */
export function openCatalog(config) {
  const path = join(config.personasDir, '.kujira-catalog.json')
  const goodPath = path + '.last-good.json'
  const warnings = new Set()
  const warn = message => { if (!warnings.has(message)) { warnings.add(message); config.onWarning?.(message) } }
  const listeners = new Set()
  const notify = () => { for (const fn of listeners) { try { fn() } catch {} } }
  let state, initialization, reloadNeeded = false, recoveryRaw = null
  let tail = Promise.resolve()
  function enqueue(operation) {
    const result = tail.then(operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
  async function load() {
    let raw
    try { raw = await readFile(path, 'utf8') } catch (e) {
      if (e.code === 'ENOENT') { reloadNeeded = false; recoveryRaw = null; return { v: 1, personas: [], bindings: [] } }
      throw e
    }
    let parsed
    try { parsed = parseCatalog(raw) } catch { /* Recover from the last complete catalog. */ }
    if (parsed?.valid) {
      reloadNeeded = false; recoveryRaw = null
      return parsed.value
    }
    recoveryRaw = raw; reloadNeeded = true
    let recovered = state
    if (!recovered) {
      try { const good = parseCatalog(await readFile(goodPath, 'utf8')); if (good.valid) recovered = good.value } catch {}
    }
    warn(recovered ? '角色绑定文件损坏；继续使用最近有效绑定，原文件待修复。' : '角色绑定文件损坏且没有有效恢复副本；仅使用可恢复的登记与默认匹配，请检查绑定。')
    return recovered ?? parsed?.value ?? { v: 1, personas: [], bindings: [] }
  }
  async function save(next) {
    await mkdir(config.personasDir, { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {encoding:'utf8',flag:'wx'})
      await rename(temporary, path)
    } finally { await rm(temporary, {force:true}) }
    state = next
    recoveryRaw = null; reloadNeeded = false
    notify()
  }
  function ready() {
    if (!initialization || reloadNeeded) {
      const work = enqueue(async () => { state = await load() })
      initialization = work
      work.catch(() => { if (initialization === work) initialization = undefined })
    }
    return initialization
  }
  function entries(state) {
    return [...BUILTINS.filter(p => !state.personas.some(u => u.id === p.id)).map(p => ({ ...p, builtin: true })), ...state.personas
      .filter(p => safeId(p.id))
      .map(p => ({ id: p.id, label: p.label, builtin: false }))]
  }
  function selected(state, id) {
    if (id === 'none') return null
    const entry = entries(state).find(p => p.id === id)
    if (!entry) throw new Error(`未知角色 ${id}；请先列出角色或创建该角色`)
    return entry
  }
  function routeRule(args, current) {
    if (args.use_current_model === true) {
      if (!text(current.provider) || !text(current.model)) throw new Error('当前请求没有完整 provider/model，请明确给出要绑定的模型 ID')
      return { provider: current.provider, model: current.model }
    }
    const provider = text(args.provider), model = text(args.model)
    if (!provider && !model) throw new Error('需要 provider/model 匹配规则，或 use_current_model=true')
    return { ...(provider ? { provider } : {}), ...(model ? { model } : {}) }
  }
  function putBinding(state, rule, persona) {
    selected(state, persona)
    const same = b => b.provider === rule.provider && b.model === rule.model
    state.bindings = [{ ...rule, persona }, ...state.bindings.filter(b => !same(b))]
  }
  return {
    path,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    async list() { await ready(); await tail; return { personas: entries(state).filter(p => !p.hidden), bindings: [...state.bindings] } },
    async get(id) { await ready(); await tail; return selected(state, id) },
    reload() {
      const work = enqueue(async () => { state = await load(); notify(); return { personas: entries(state), bindings: state.bindings } })
      initialization = work
      work.catch(() => { if (initialization === work) initialization = undefined })
      return work
    },
    async resolve(route) {
      await ready(); await tail
      if (!text(route?.model)) return selected(state, 'stella')
      if (config.mode === 'fixed') return selected(state, config.persona)
      const rules = [...state.bindings, ...config.modelRules]
      const match = rules.find(rule => matchesRule(route, rule))
      const family = modelFamily(route)
      return selected(state, match?.persona ?? (family === 'none' ? 'stella' : family))
    },
    async change(args, current) {
      await ready()
      return enqueue(async () => {
        const next = { ...state, personas: [...state.personas], bindings: [...state.bindings] }
        const id = text(args.persona), action = args.action
        if (action === 'create') {
          if (!safeId(id)) throw new Error('角色 ID 使用小写字母开头的字母、数字、短横线，不能带路径')
          if (entries(next).some(p => p.id === id)) throw new Error('该角色已存在；补充设定请用 persona_edit，不要按模型版本重复创建角色')
          const label = text(args.name) || id, body = typeof args.text === 'string' ? args.text : ''
          const rule = args.use_current_model === true || text(args.model) || text(args.provider) ? routeRule(args, current) : null
          const directory = join(config.personasDir, id)
          await mkdir(config.personasDir, { recursive: true })
          try { await mkdir(directory) } catch (error) {
            if (error.code !== 'EEXIST') throw error
            const info = await lstat(directory)
            if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('角色目录必须是自己的目录，不能指向其它角色或文件')
          }
          // A prior interrupted create may already have written these files.
          // Keep every existing byte; retry only the missing files and registry save.
          for (const [name, content] of [
            ['00-用户设定.md', `# ${label}\n\n> 用户自定义角色。\n\n${body}\n`],
            ['90-记忆.md', `# ${label}的记忆\n\n`],
          ]) {
            try { await writeFile(join(directory, name), content, { flag: 'wx' }) }
            catch (error) { if (error.code !== 'EEXIST') throw error }
          }
          next.personas.push({ id, label })
          if (rule) putBinding(next, rule, id)
          await save(next)
          return { action, persona: id, note: `已创建 ${label}（${id}）${rule ? '并绑定指定模型' : '；尚未绑定模型'}。不同版本请绑定这个相同角色 ID。`, path: directory }
        }
        if (action === 'bind') {
          const rule = routeRule(args, current)
          putBinding(next, rule, id)
          await save(next)
          return { action, persona: id, note: `已绑定 ${rule.provider ?? '*'}/${rule.model ?? '*'} → ${id}；下次请求生效。`, path }
        }
        if (action === 'unbind') {
          const rule = routeRule(args, current)
          const before = next.bindings.length
          next.bindings = next.bindings.filter(b => b.provider !== rule.provider || b.model !== rule.model)
          if (before === next.bindings.length) throw new Error('未找到完全相同的用户绑定；请先 list 查看规则')
          await save(next)
          return { action, note: '已移除这条用户绑定，恢复配置/内置匹配；角色文件与记忆未删除。', path }
        }
        throw new Error(`未知管理操作：${action}`)
      })
    },
  }
}
