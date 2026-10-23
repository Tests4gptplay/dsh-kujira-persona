/** Conversation personas: one prompt hook and two on-demand tools. */
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDossier } from './dossier.js'
import { openCatalog } from './catalog.js'

export const inject = ['systemPrompt']
const SECTION = 'whale:persona'
const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = (process.env.DSH_HOME ?? '').trim() || join(homedir(), '.dsh')
const pathOption = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback
const GUIDE = '用户要求修改或补充人设时，实际调用 persona_edit 写入并反馈结果；只口头承诺不算保存。用户明确要求新增角色或绑定模型时，用 persona_manage。先 list/models 查看已有角色和真实模型 ID；同一模型家族的版本、尺寸和推理档位共用一个角色 ID。不要自行创建重复角色。这里的模型绑定不新增 API 接入或索取密钥。'

function configuration(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  const personaDir = pathOption(c.personaDir, join(HOME, 'persona'))
  return {
    enabled: c.enabled !== false,
    mode: c.mode === 'fixed' ? 'fixed' : 'auto',
    persona: pathOption(c.persona, 'deepseek'),
    unknownPersona: pathOption(c.unknownPersona, 'none'),
    personaDir,
    memoryFile: pathOption(c.memoryFile, join(personaDir, '90-记忆.md')),
    personasDir: pathOption(c.personasDir, join(HOME, 'personas')),
    sharedDir: pathOption(c.sharedDir, ''),
    allowAgentWrite: c.allowAgentWrite !== false,
    seed: c.seed !== false,
    sync: c.sync !== false,
    extraText: typeof c.extraText === 'string' ? c.extraText : '',
    modelRules: (Array.isArray(c.modelRules) ? c.modelRules : []).filter(r => r && (typeof r.provider === 'string' || typeof r.model === 'string')),
  }
}

export function apply(ctx, rawConfig) {
  const config = configuration(rawConfig)
  if (!config.enabled) return
  const catalog = openCatalog(config)
  const dossiers = new Map()
  const requests = new WeakMap()
  function dossier(entry) {
    if (!entry) return null
    const { id, label } = entry
    if (!dossiers.has(id)) {
      const personaDir = id === 'deepseek' ? config.personaDir : join(config.personasDir, id)
      dossiers.set(id, openDossier({
        ...config, id, label, personaDir,
        extraText: id === 'deepseek' ? config.extraText : '',
        memoryFile: id === 'deepseek' ? config.memoryFile : join(personaDir, '90-记忆.md'),
        packagedDir: id === 'deepseek' ? join(HERE, 'persona') : join(HERE, 'personas', id),
      }))
    }
    return dossiers.get(id)
  }
  const guide = config.allowAgentWrite ? GUIDE : ''
  ctx.systemPrompt.section({ name: SECTION, order: 1, interpolate: false, text: '' })
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const route = { provider: assembled.variables.provider ?? '', model: assembled.variables.model ?? '' }
    let entry = null, text = guide
    try {
      entry = catalog.resolve(route)
      text = [dossier(entry)?.compose().text ?? '', guide].filter(Boolean).join('\n\n')
    } catch { /* Dossier I/O does not change the host request or its other sections. */ }
    if (context.agent) requests.set(context.agent, { route, entry })
    return { ...assembled, sections: assembled.sections.map(s => s.name === SECTION ? { ...s, text, interpolate: false } : s) }
  }, { global: true, prepend: true })

  function routeFor(agent, pending = false) {
    if (!agent) return {}
    if (pending) {
      const state = ctx.get('sessionProjections')?.stateOf(agent.session, 'modelSelection')
      if (state?.pending) return state.pending
    }
    return agent.session.requestHeader()?.config ?? requests.get(agent)?.route ?? agent.options ?? {}
  }
  function forInvocation(agent, pending = false, explicit) {
    const route = routeFor(agent, pending)
    const captured = requests.get(agent)
    const same = captured && captured.route.provider === route.provider && captured.route.model === route.model
    const entry = explicit ? catalog.get(explicit) : !pending && same ? captured.entry : catalog.resolve(route)
    return { route, entry, store: dossier(entry) }
  }
  function summary(agent) {
    const { route, entry } = forInvocation(agent, true)
    return `模式：${config.mode}\n供应商 ID：${route.provider || '未知'}\n模型 ID：${route.model || '尚未请求'}\n角色：${entry ? `${entry.label}（${entry.id}）` : '未绑定'}`
  }
  function listText(agent) {
    const { personas, bindings } = catalog.list()
    return `${summary(agent)}\n\n角色库：\n${personas.map(p => `${p.id}：${p.label}${p.builtin ? '（内置）' : '（自定义）'}`).join('\n')}\n\n对话保存的绑定：\n${bindings.map(b => `${b.provider ?? '*'}/${b.model ?? '*'} → ${b.persona}`).join('\n') || '无；当前使用配置或内置家族规则'}`
  }
  async function modelList(providerFilter) {
    const llm = ctx.get('llm')
    if (!llm) throw new Error('宿主未提供模型目录服务；请从 DSH 设置复制实际 provider/model ID')
    const providers = llm.listProviders().filter(p => !providerFilter || p.id === providerFilter)
    if (!providers.length) throw new Error('没有找到该供应商 ID；不要把显示名称当作 ID')
    const groups = []
    for (const p of providers) {
      try {
        const models = await llm.listModels(p.id)
        groups.push(`${p.name} [provider=${p.id}]\n${models.map(m => {
          const entry = catalog.resolve({ provider: p.id, model: m.id })
          return `  ${m.name} [model=${m.id}] → ${entry?.id ?? '未绑定'}`
        }).join('\n')}`)
      } catch (e) { groups.push(`${p.name} [provider=${p.id}]：目录读取失败（${e.message}）`) }
    }
    return groups.join('\n\n')
  }

  if (config.allowAgentWrite) ctx.inject(['tools'], scope => {
    scope.tools.register({
      name: 'persona_edit',
      description: '按用户要求保存、阅读或修订角色人设。默认编辑发起本次请求的角色；只有用户明确指定其他角色时才传 persona。read 读取原文；append/replace/delete/list 与旧版相同。成功后报告实际写入结果。',
      parameters: {
        type: 'object', properties: {
          action: { type: 'string', enum: ['read', 'append', 'replace', 'delete', 'list'] },
          persona: { type: 'string', description: '已有角色 ID；省略则使用本次请求的角色。先用 persona_manage list 查 ID。' },
          category: { type: 'string', enum: ['character', 'world', 'meme', 'memory'] },
          file: { type: 'string', description: '角色目录内 .md 文件名，不是路径；read 可省略以读取全部。' },
          oldText: { type: 'string' }, newText: { type: 'string' },
          text: { type: 'string', description: 'append 正文，最多 4000 字。' }, source: { type: 'string' },
        }, required: ['action'], additionalProperties: false,
      },
      output: {
        schema: { type: 'object', properties: {
          action: { type: 'string' }, persona: { type: 'string' }, label: { type: 'string' }, path: { type: 'string' },
          file: { type: 'string' }, note: { type: 'string' }, text: { type: 'string' }, files: { type: 'array', items: { type: 'object' } },
        }, required: ['action', 'persona'] },
        render(_args, value) {
          const text = value.action === 'read' ? value.text : value.action === 'list'
            ? value.files.map(f => `${f.file}（${f.chars} 字符）`).join('\n') || '（空）'
            : `${value.note}\n${value.path}\n下次请求生效。`
          return [{ type: 'text', text: `${value.label ?? value.persona}\n${text}` }]
        },
      },
      async execute(args, exec) {
        if (!exec?.agent) throw new Error('persona_edit 需要所属会话')
        const { store, entry } = forInvocation(exec.agent, false, args.persona)
        if (!store) throw new Error('当前模型未绑定人设；请用 persona_manage 创建或绑定角色')
        if (args.action === 'read') {
          const all = store.compose().sources.filter(s => dirname(s.path) === store.config.personaDir || s.path === store.config.memoryFile)
          const sources = args.file ? all.filter(s => basename(s.path) === args.file) : all
          if (args.file && !sources.length) throw new Error('找不到该角色文件')
          return { action: 'read', persona: entry.id, label: entry.label, text: sources.map(s => `## ${basename(s.path)}\n${s.text}`).join('\n\n') }
        }
        return { ...store.edit(args), label: entry.label }
      },
    })
    scope.tools.register({
      name: 'persona_manage',
      description: '用户明确要求时，通过对话创建角色、把模型绑定到角色或解除自定义绑定。list 查角色与规则；models 从 DSH 当前宿主读取真实供应商/模型目录和分类。供应商显示名、provider ID、model ID 不混用；同家族各版本共用角色，不为版本号另建角色。这里只添加人设绑定，不新增 API 服务或处理密钥。',
      parameters: { type: 'object', properties: {
        action: { type: 'string', enum: ['list', 'models', 'create', 'bind', 'unbind'] },
        persona: { type: 'string', description: '稳定角色 ID，例如 gpt / qwen / 自定义 stella；bind 可用 none 表示不启用人设。' },
        name: { type: 'string', description: 'create 的显示名称。' },
        text: { type: 'string', description: 'create 的基本人设；写明用户自定义，不虚构来源。' },
        provider: { type: 'string', description: '实际 provider ID，不是显示名称。models 可按它筛选；绑定时支持用户明确要求的 * 通配符。' },
        model: { type: 'string', description: '实际 model ID；支持用户明确要求的 * 通配符，将多个版本绑定到同一角色。' },
        use_current_model: { type: 'boolean', description: '用户明确说绑定当前模型时使用，自动填本次请求的 provider/model；否则提供具体规则。' },
      }, required: ['action'], additionalProperties: false },
      output: { schema: { type: 'object', properties: { action: { type: 'string' }, text: { type: 'string' } }, required: ['action', 'text'] },
        render(_args, value) { return [{ type: 'text', text: value.text }] } },
      async execute(args, exec) {
        if (!exec?.agent) throw new Error('persona_manage 需要所属会话')
        if (args.action === 'list') return { action: 'list', text: listText(exec.agent) }
        if (args.action === 'models') return { action: 'models', text: await modelList(args.provider) }
        const result = catalog.change(args, routeFor(exec.agent))
        return { action: result.action, text: `${result.note}\n保存位置：${result.path}${config.mode === 'fixed' ? '\n当前是固定人设模式，自动模型绑定要在 auto 模式下才生效。' : ''}` }
      },
    })
  })

  ctx.inject(['commands'], scope => {
    scope.commands.register({
      name: 'persona', description: '查看会话人设、目录和对话管理方法', input: { hint: 'files | show | sync | list | help' },
      handler(invocation) {
        const argument = invocation.rawInput.trim()
        try {
          if (argument === 'help') return { kind: 'success', text: '直接用对话管理：\n“请把我希望的说话方式保存到当前角色人设。”\n“列出 DSH 可用模型及对应角色。”\n“创建名为星璃的新角色，设定是……，绑定当前模型。”\n“把 my-gateway 的 my-model-* 全部版本绑定星璃，不另建角色。”\nAI 应调用 persona_edit / persona_manage 实际保存并反馈文件位置。新增 API 接入仍使用 DSH 模型设置；此处不处理密钥。' }
          if (argument === 'list') return { kind: 'success', text: listText(invocation.agent) }
          const { store } = forInvocation(invocation.agent, true)
          const head = summary(invocation.agent)
          if (!store) return { kind: 'success', text: `${head}\n可通过对话让 AI 创建角色并绑定这个模型。/persona help 查看例句。` }
          if (argument === 'sync') {
            const s = store.sync()
            return { kind: 'success', text: `${head}\n同步：新增 ${s.added} / 更新 ${s.updated} / 保留修改 ${s.kept} / 已是最新 ${s.upToDate}` }
          }
          const value = store.compose()
          if (argument === 'show') return { kind: 'success', text: value.text }
          if (argument === 'files') return { kind: 'success', text: `${head}\n${value.sources.map(s => `${s.path}（${s.text.length} 字符）`).join('\n')}` }
          return { kind: 'success', text: `${head}\n人设目录：${store.config.personaDir}\n记忆文件：${store.config.memoryFile}\n注入：${value.sources.length} 个文件 / ${value.chars} 字符\nAI 可写：${config.allowAgentWrite ? '是' : '否'}\n修改或补充人设请直接在聊天中让 AI 保存；/persona help 查看例句。` }
        } catch (error) { return { kind: 'error', text: error.message } }
      },
    })
    scope.commands.register({
      name: 'remember', description: '为当前选择的角色记住一句话', input: { hint: '要记住的一句话' },
      handler(invocation) {
        const text = invocation.rawInput.trim()
        if (!text) return { kind: 'error', text: '用法：/remember 要记住的一句话' }
        try {
          const { store } = forInvocation(invocation.agent, true)
          if (!store) return { kind: 'error', text: '当前模型未绑定人设，请先通过对话绑定角色' }
          const value = store.edit({ action: 'append', category: 'memory', text, source: '用户口述' })
          return { kind: 'success', text: `${store.config.label}：${value.note}\n写入 ${value.path}` }
        } catch (error) { return { kind: 'error', text: `没写进去：${error.message}` } }
      },
    })
  })
}
