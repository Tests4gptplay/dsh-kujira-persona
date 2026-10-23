/** Model-family routing and user-authored persona bindings. No background work. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const BUILTINS = [
  { id: 'deepseek', label: 'DeepSeek 鲸鱼娘（小鲸）' },
  { id: 'gpt', label: 'GPT 白龙娘' },
  { id: 'gemini', label: 'Gemini 猫娘' },
  { id: 'claude', label: 'Claude 书卷娘' },
  { id: 'grok', label: 'Grok 蝠翼娘' },
  { id: 'glm', label: 'GLM 黑白狐娘' },
  { id: 'kimi', label: 'Kimi 星月娘' },
  { id: 'qwen', label: 'Qwen 千问娘' },
  { id: 'minimax', label: 'MiniMax 创作娘' },
  { id: 'llama', label: 'Llama 羊驼娘' },
  { id: 'doubao', label: '豆包 / Seed 娘' },
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
]
const text = value => typeof value === 'string' ? value.trim() : ''
const safeId = value => /^[a-z][a-z0-9-]{0,63}$/.test(value) && value !== 'none'

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

/** The registry contains only role names and model bindings, never model credentials. */
export function openCatalog(config) {
  const path = join(config.personasDir, '.kujira-catalog.json')
  let state, initialization
  let tail = Promise.resolve()
  function enqueue(operation) {
    const result = tail.then(operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
  async function load() {
    let raw
    try { raw = await readFile(path, 'utf8') } catch (e) {
      if (e.code === 'ENOENT') return { v: 1, personas: [], bindings: [] }
      throw e
    }
    const value = JSON.parse(raw)
    if (value.v !== 1 || !Array.isArray(value.personas) || !Array.isArray(value.bindings)) throw new Error('人设目录索引格式无效，未覆盖原文件')
    return value
  }
  async function save(next) {
    await mkdir(config.personasDir, { recursive: true })
    const temporary = `${path}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    await rename(temporary, path)
    state = next
  }
  function ready() {
    return initialization ??= enqueue(async () => { state = await load() })
  }
  function entries(state) {
    return [...BUILTINS.map(p => ({ ...p, builtin: true })), ...state.personas
      .filter(p => safeId(p.id) && !BUILTINS.some(b => b.id === p.id))
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
    async list() { await ready(); await tail; return { personas: entries(state), bindings: [...state.bindings] } },
    async get(id) { await ready(); await tail; return selected(state, id) },
    reload() {
      const work = enqueue(async () => { state = await load(); return { personas: entries(state), bindings: state.bindings } })
      initialization = work.then(() => undefined)
      initialization.catch(() => {})
      return work
    },
    async resolve(route) {
      await ready(); await tail
      if (config.mode === 'fixed') return selected(state, config.persona)
      const rules = [...state.bindings, ...config.modelRules]
      const match = rules.find(rule => matchesRule(route, rule))
      const family = modelFamily(route)
      return selected(state, match?.persona ?? (family === 'none' ? config.unknownPersona : family))
    },
    async change(args, current) {
      await ready()
      return enqueue(async () => {
        const next = { ...state, personas: [...state.personas], bindings: [...state.bindings] }
        const id = text(args.persona), action = args.action
        if (action === 'create') {
          if (!safeId(id)) throw new Error('角色 ID 使用小写字母开头的字母、数字、短横线，最多 64 字符')
          if (entries(next).some(p => p.id === id)) throw new Error('该角色已存在；补充设定请用 persona_edit，不要按模型版本重复创建角色')
          const label = text(args.name), body = text(args.text)
          if (!label || !body) throw new Error('create 需要 name 和 text（基本人设）')
          const rule = args.use_current_model === true || text(args.model) || text(args.provider) ? routeRule(args, current) : null
          const directory = join(config.personasDir, id)
          await mkdir(config.personasDir, { recursive: true })
          await mkdir(directory)
          await writeFile(join(directory, '00-用户设定.md'), `# ${label}\n\n> 用户自定义角色，不是模型厂商的官方设定。\n\n${body}\n`, 'utf8')
          await writeFile(join(directory, '90-记忆.md'), `# ${label}的记忆\n\n`, 'utf8')
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
