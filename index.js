/** Model-selected personas. One prompt hook, no polling or runtime test machinery. */
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDossier } from './dossier.js'

export const inject = ['systemPrompt']
const SECTION = 'whale:persona'
const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = (process.env.DSH_HOME ?? '').trim() || join(homedir(), '.dsh')
const LABELS = { deepseek: 'DeepSeek 鲸鱼娘（小鲸）', gpt: 'GPT 白龙娘' }
const role = value => Object.hasOwn(LABELS, value) ? value : 'none'
const pathOption = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback

function pattern(value) {
  if (typeof value !== 'string') return undefined
  return new RegExp(`^${value.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i')
}

/** Explicit rules first; an OpenAI-compatible protocol is not a model identity. */
function choose(route, config) {
  if (config.mode === 'fixed') return config.persona
  const provider = typeof route.provider === 'string' ? route.provider : ''
  const model = typeof route.model === 'string' ? route.model : ''
  for (const rule of config.rules) {
    if ((!rule.provider || rule.provider.test(provider)) && (!rule.model || rule.model.test(model))) return rule.persona
  }
  const id = model.toLowerCase().split('/').at(-1)
  if (/^deepseek(?:-|$)/.test(id)) return 'deepseek'
  if (/^(?:gpt(?:-|$)|chatgpt(?:-|$)|o[1-9]\d*(?:-|$))/.test(id)) return 'gpt'
  if (provider.toLowerCase() === 'codex-local') return 'gpt'
  if (/^deepseek-(?:official|account|messages)$/.test(provider.toLowerCase())) return 'deepseek'
  return config.unknownPersona
}

function configuration(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  const personaDir = pathOption(c.personaDir, join(HOME, 'persona'))
  return {
    enabled: c.enabled !== false,
    mode: c.mode === 'fixed' ? 'fixed' : 'auto',
    persona: role(c.persona ?? 'deepseek'),
    unknownPersona: role(c.unknownPersona),
    personaDir,
    memoryFile: pathOption(c.memoryFile, join(personaDir, '90-记忆.md')),
    personasDir: pathOption(c.personasDir, join(HOME, 'personas')),
    sharedDir: pathOption(c.sharedDir, ''),
    allowAgentWrite: c.allowAgentWrite !== false,
    seed: c.seed !== false,
    sync: c.sync !== false,
    extraText: typeof c.extraText === 'string' ? c.extraText : '',
    rules: (Array.isArray(c.modelRules) ? c.modelRules : []).filter(r => r && (typeof r.provider === 'string' || typeof r.model === 'string'))
      .map(r => ({ provider: pattern(r.provider), model: pattern(r.model), persona: role(r.persona) })),
  }
}

export function apply(ctx, rawConfig) {
  const config = configuration(rawConfig)
  if (!config.enabled) return
  const dossiers = new Map()
  const assembledRoutes = new WeakMap()
  function dossier(id) {
    if (id === 'none') return null
    if (!dossiers.has(id)) {
      const personaDir = id === 'deepseek' ? config.personaDir : join(config.personasDir, id)
      dossiers.set(id, openDossier({
        ...config, id, label: LABELS[id], personaDir,
        extraText: id === 'deepseek' ? config.extraText : '',
        memoryFile: id === 'deepseek' ? config.memoryFile : join(personaDir, '90-记忆.md'),
        packagedDir: id === 'deepseek' ? join(HERE, 'persona') : join(HERE, 'personas', id),
      }))
    }
    return dossiers.get(id)
  }

  // Keep the legacy section identity/order. Resolve after DSH snapshots model selection.
  ctx.systemPrompt.section({ name: SECTION, order: 1, interpolate: false, text: '' })
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const route = { provider: assembled.variables.provider ?? '', model: assembled.variables.model ?? '' }
    const id = choose(route, config)
    let text = ''
    try { text = dossier(id)?.compose().text ?? '' } catch { /* A missing dossier does not stop the host. */ }
    if (context.agent) assembledRoutes.set(context.agent, route)
    return {
      ...assembled,
      sections: assembled.sections.map(section => section.name === SECTION ? { ...section, text, interpolate: false } : section),
    }
  }, { global: true, prepend: true })

  function routeFor(agent, pending = false) {
    if (!agent) return {}
    if (pending) {
      const projections = ctx.get('sessionProjections')
      const state = projections?.stateOf(agent.session, 'modelSelection')
      if (state?.pending) return state.pending
    }
    // For tools, the persisted request wins over a newer unconsumed picker selection.
    return agent.session.requestHeader()?.config ?? assembledRoutes.get(agent) ?? agent.options ?? {}
  }
  function forInvocation(agent, pending = false) {
    const route = routeFor(agent, pending)
    const id = choose(route, config)
    return { route, id, store: dossier(id) }
  }

  if (config.allowAgentWrite) ctx.inject(['tools'], scope => scope.tools.register({
    name: 'persona_edit',
    description: '编辑本次模型请求所用角色的人设档案。append 新增、replace 修改、delete 删除、list 列表；不跨角色写入。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['append', 'replace', 'delete', 'list'] },
        category: { type: 'string', enum: ['character', 'world', 'meme', 'memory'] },
        file: { type: 'string', description: '当前角色目录内的 .md 文件名，不是路径。' },
        oldText: { type: 'string', description: 'replace/delete 的唯一匹配原文。' },
        newText: { type: 'string' },
        text: { type: 'string', description: 'append 正文，最多 4000 字。' },
        source: { type: 'string', description: '资料来源或用户口述。' },
      },
      required: ['action'], additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: {
        action: { type: 'string' }, persona: { type: 'string' }, path: { type: 'string' }, file: { type: 'string' },
        note: { type: 'string' }, files: { type: 'array', items: { type: 'object' } },
      }, required: ['action', 'persona'] },
      render(_args, value) {
        const text = value.action === 'list'
          ? value.files.map(f => `${f.file}（${f.chars} 字符）`).join('\n') || '（空）'
          : `${value.note}\n${value.path}\n下次请求生效。`
        return [{ type: 'text', text: `${LABELS[value.persona]}\n${text}` }]
      },
    },
    async execute(args, exec) {
      if (!exec?.agent) throw new Error('persona_edit 需要所属会话，不能猜测写入哪个角色')
      const { store } = forInvocation(exec.agent)
      if (!store) throw new Error('当前模型未绑定人设；请配置 modelRules 或固定人设模式')
      return store.edit(args)
    },
  }))

  ctx.inject(['commands'], scope => {
    scope.commands.register({
      name: 'persona', description: '查看当前模型对应的人设、目录与文件', input: { hint: 'files | show | sync | list' },
      handler(invocation) {
        const argument = invocation.rawInput.trim()
        if (argument === 'list') return { kind: 'success', text: Object.entries(LABELS).map(([id, label]) => `${id}：${label}`).join('\n') }
        const { route, id, store } = forInvocation(invocation.agent, true)
        const summary = `模式：${config.mode}\n模型：${route.provider || '未知'} / ${route.model || '尚未请求'}\n人设：${LABELS[id] ?? '未启用'}`
        if (!store) return { kind: 'success', text: `${summary}\n没有匹配角色。未知模型不自动套用鲸鱼娘；可通过 modelRules 指定。` }
        try {
          if (argument === 'sync') {
            const s = store.sync()
            return { kind: 'success', text: `${summary}\n同步：新增 ${s.added} / 更新 ${s.updated} / 保留修改 ${s.kept} / 已是最新 ${s.upToDate}` }
          }
          const value = store.compose()
          if (argument === 'show') return { kind: 'success', text: value.text }
          if (argument === 'files') return { kind: 'success', text: `${summary}\n${value.sources.map(s => `${s.path}（${s.text.length} 字符）`).join('\n')}` }
          return { kind: 'success', text: `${summary}\n人设目录：${store.config.personaDir}\n记忆文件：${store.config.memoryFile}\n注入：${value.sources.length} 个文件 / ${value.chars} 字符\nAI 可写：${config.allowAgentWrite ? '是' : '否'}\n/persona files | show | sync | list\n/remember 一句话` }
        } catch (error) { return { kind: 'error', text: error.message } }
      },
    })
    scope.commands.register({
      name: 'remember', description: '为当前选中模型的角色记住一句话', input: { hint: '要记住的一句话' },
      handler(invocation) {
        const text = invocation.rawInput.trim()
        if (!text) return { kind: 'error', text: '用法：/remember 要记住的一句话' }
        const { store } = forInvocation(invocation.agent, true)
        if (!store) return { kind: 'error', text: '当前模型未绑定人设，未写入任何角色档案' }
        try {
          const value = store.edit({ action: 'append', category: 'memory', text, source: '用户口述' })
          return { kind: 'success', text: `${store.config.label}：${value.note}\n写入 ${value.path}` }
        } catch (error) { return { kind: 'error', text: `没写进去：${error.message}` } }
      },
    })
  })
}
