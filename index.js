/** Conversation personas: one prompt hook and two on-demand tools. */
import { homedir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDossier } from './dossier.js'
import { openCatalog } from './catalog.js'
import { applyPet } from './pet/index.js'

export const inject = ['systemPrompt']
const SECTION = 'whale:persona'
const WORLD_SECTION = 'whale:world'
const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = (process.env.DSH_HOME ?? '').trim() || join(homedir(), '.dsh')
const pathOption = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback


function configuration(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  const personaDir = pathOption(c.personaDir, join(HOME, 'persona'))
  return {
    enabled: c.enabled !== false,
    mode: c.mode === 'fixed' ? 'fixed' : 'auto',
    persona: pathOption(c.persona, 'deepseek'),
    personaDir,
    memoryFile: pathOption(c.memoryFile, join(personaDir, '90-记忆.md')),
    personasDir: pathOption(c.personasDir, join(HOME, 'personas')),
    worldDir: pathOption(c.worldDir, join(HOME, 'world')),
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
  applyPet(ctx, { catalog, home: HOME, folders: {worldDir: config.worldDir,personaDir: config.personaDir,personasDir: config.personasDir,sharedDir: config.sharedDir}, ensureFolder: async id => {
    if(id==='world')return world.compose()
    const targetId=id==='persona'?'deepseek':id
    return dossier(await catalog.get(targetId)).compose()
  } })
  const world = openDossier({ ...config, id: 'world', kind: 'world', label: '全局世界观',
    personaDir: config.worldDir, memoryFile: null, extraText: '', packagedDir: join(HERE, 'world') })
  const shared = config.sharedDir ? openDossier({ ...config, id: 'shared', kind: 'shared',
    personaDir: config.sharedDir, memoryFile: null, extraText: '', packagedDir: null, seed: false, sync: false }) : null
  // This README is loaded once and included in every user-facing prompt assembly.
  const guideReady = readFile(join(HERE, 'instructions', 'README.md'), 'utf8').catch(() =>
    '修改用 persona_edit；本工具保存后缓存自动更新。外部文件修改后用 persona_edit action=reload，scope=world 或 persona；不要重启 DSH。')
  // World data is global to this plugin instance; individual roles remain lazy.
  world.compose().catch(() => {})
  const dossiers = new Map()
  const requests = new WeakMap()
  function dossier(entry) {
    if (!entry) return null
    const { id, label } = entry
    if (!dossiers.has(id) || dossiers.get(id).config.label !== label) {
      const personaDir = id === 'deepseek' ? config.personaDir : join(config.personasDir, id)
      dossiers.set(id, openDossier({
        ...config, id, label, personaDir,
        extraText: id === 'deepseek' ? config.extraText : '',
        memoryFile: id === 'deepseek' ? config.memoryFile : join(personaDir, '90-记忆.md'),
        packagedDir: entry.builtin === false ? null : id === 'deepseek' ? join(HERE, 'persona') : join(HERE, 'personas', id),
      }))
    }
    return dossiers.get(id)
  }
  ctx.systemPrompt.section({ name: WORLD_SECTION, order: 0, interpolate: false, text: '' })
  ctx.systemPrompt.section({ name: SECTION, order: 1, interpolate: false, text: '' })
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const route = { provider: assembled.variables.provider ?? '', model: assembled.variables.model ?? '' }
    let entry = null, personalText = ''
    const common = []
    try { common.push((await world.compose()).text) } catch { /* Keep the host's other sections available. */ }
    if (shared) { try { common.push((await shared.compose()).text) } catch {} }
    try {
      entry = await catalog.resolve(route)
      personalText = entry ? (await dossier(entry).compose()).text : ''
      const custom = (await catalog.list()).personas.filter(p => !p.builtin)
      if (custom.length) common.push('## 用户登记的其他角色\n' + custom.map(p => `${p.label}（${p.id}）`).join('、') + '\n这里只共享名字。公开背景与关系由用户补充到世界观，个人记忆不在这里共享。')
    } catch { /* A missing dossier does not block an ordinary model request. */ }
    common.push(config.allowAgentWrite ? await guideReady : '当前关闭了对话写入工具。不要声称已保存人设；人工 /remember 仍可用。')
    if (context.agent) requests.set(context.agent, { route, entry })
    return { ...assembled, sections: assembled.sections.map(s =>
      s.name === WORLD_SECTION ? { ...s, text: common.filter(Boolean).join('\n\n'), interpolate: false }
        : s.name === SECTION ? { ...s, text: personalText, interpolate: false } : s) }
  }, { global: true, prepend: true })

  function routeFor(agent, pending = false) {
    if (!agent) return {}
    if (pending) {
      const state = ctx.get('sessionProjections')?.stateOf(agent.session, 'modelSelection')
      if (state?.pending) return state.pending
    }
    return agent.session.requestHeader()?.config ?? requests.get(agent)?.route ?? agent.options ?? {}
  }
  async function forInvocation(agent, pending = false, explicit) {
    const route = routeFor(agent, pending)
    const captured = requests.get(agent)
    const same = captured && captured.route.provider === route.provider && captured.route.model === route.model
    const entry = explicit ? await catalog.get(explicit) : !pending && same ? captured.entry : await catalog.resolve(route)
    return { route, entry, store: dossier(entry) }
  }
  async function summary(agent) {
    const { route, entry } = await forInvocation(agent, true)
    return `模式：${config.mode}\n供应商 ID：${route.provider || '未知'}\n模型 ID：${route.model || '尚未请求'}\n角色：${entry ? `${entry.label}（${entry.id}）` : '未绑定'}`
  }
  async function listText(agent) {
    const { personas, bindings } = await catalog.list()
    return `${await summary(agent)}\n\n角色库：\n${personas.map(p => `${p.id}：${p.label}${p.builtin ? '（内置）' : '（自定义）'}`).join('\n')}\n\n对话保存的绑定：\n${bindings.map(b => `${b.provider ?? '*'}/${b.model ?? '*'} → ${b.persona}`).join('\n') || '无；当前使用配置或内置家族规则'}`
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
        groups.push(`${p.name} [provider=${p.id}]\n${(await Promise.all(models.map(async m => {
          const entry = await catalog.resolve({ provider: p.id, model: m.id })
          return `  ${m.name} [model=${m.id}] → ${entry?.id ?? '未绑定'}`
        }))).join('\n')}`)
      } catch (e) { groups.push(`${p.name} [provider=${p.id}]：目录读取失败（${e.message}）`) }
    }
    return groups.join('\n\n')
  }

  if (config.allowAgentWrite) ctx.inject(['tools'], scope => {
    scope.tools.register({
      name: 'persona_edit',
      description: '按用户要求读取或修改档案。scope=world 为所有角色共用的世界观/名录；scope=persona 为当前角色/明确指定的角色。category=world 默认选择全局。append/replace/delete 成功后缓存已自动更新，无需另行刷新。仅当使用其他文件工具修改后，调用一次 action=reload 重读受影响范围；不重启 DSH，不清理会话。',
      parameters: {
        type: 'object', properties: {
          action: { type: 'string', enum: ['read', 'append', 'replace', 'delete', 'list', 'reload'] },
          scope: { type: 'string', enum: ['world', 'persona'], description: '世界观和公开人物关系用 world；个人身份、习惯和记忆用 persona。' },
          persona: { type: 'string', description: 'scope=persona 的已有角色 ID；省略则使用本次请求的角色。' },
          category: { type: 'string', enum: ['character', 'world', 'meme', 'memory'] },
          file: { type: 'string', description: '角色目录内 .md 文件名，不是路径；read 可省略以读取全部。' },
          oldText: { type: 'string' }, newText: { type: 'string' },
          text: { type: 'string', description: 'append 正文，最多 4000 字。' }, source: { type: 'string' },
        }, required: ['action'], additionalProperties: false,
      },
      output: {
        schema: { type: 'object', properties: {
          action: { type: 'string' }, persona: { type: 'string' }, label: { type: 'string' }, path: { type: 'string' },
          scope: { type: 'string' }, cache_updated: { type: 'boolean' },
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
        const scopeName = args.scope ?? (args.category === 'world' ? 'world' : 'persona')
        const target = scopeName === 'world' ? { store: world, entry: { id: 'world', label: '全局世界观' } }
          : await forInvocation(exec.agent, false, args.persona)
        const { store, entry } = target
        if (!store) throw new Error('当前模型未绑定角色；世界观可用 scope=world，或先创建/绑定角色')
        if (args.action === 'reload') {
          await store.reload()
          if (scopeName === 'world' && shared) await shared.reload()
          return { action: 'reload', persona: entry.id, label: entry.label, scope: scopeName,
            path: store.config.personaDir, cache_updated: true, note: '已重新读取受影响内容并刷新缓存；下一次请求生效，无需重启 DSH。' }
        }
        if (args.action === 'read') {
          const all = (await store.compose()).sources
          const sources = args.file ? all.filter(s => basename(s.path) === args.file) : all
          if (args.file && !sources.length) throw new Error('找不到该档案文件')
          return { action: 'read', persona: entry.id, label: entry.label, scope: scopeName,
            text: sources.map(s => `## ${basename(s.path)}\n${s.text}`).join('\n\n') }
        }
        return { ...await store.edit(args), label: entry.label, scope: scopeName }
      },
    })
    scope.tools.register({
      name: 'persona_manage',
      description: 'reload 仅用于外部修改绑定索引后重读一次；本工具 create/bind/unbind 成功已自动更新缓存，不再重复 reload。用户明确要求时，通过对话创建角色、把模型绑定到角色或解除自定义绑定。list 查角色与规则；models 从 DSH 当前宿主读取真实供应商/模型目录和分类。供应商显示名、provider ID、model ID 不混用；同家族各版本共用角色，不为版本号另建角色。这里只添加人设绑定，不新增 API 服务或处理密钥。',
      parameters: { type: 'object', properties: {
        action: { type: 'string', enum: ['list', 'models', 'create', 'bind', 'unbind', 'reload'] },
        persona: { type: 'string', description: '稳定角色 ID，例如 gpt / qwen / 已创建的自定义角色；bind 可用 none 表示不启用人设。' },
        name: { type: 'string', description: 'create 的显示名称。' },
        text: { type: 'string', description: 'create 的基本人设，作为用户自定义角色保存。' },
        provider: { type: 'string', description: '实际 provider ID，不是显示名称。models 可按它筛选；绑定时支持用户明确要求的 * 通配符。' },
        model: { type: 'string', description: '实际 model ID；支持用户明确要求的 * 通配符，将多个版本绑定到同一角色。' },
        use_current_model: { type: 'boolean', description: '用户明确说绑定当前模型时使用，自动填本次请求的 provider/model；否则提供具体规则。' },
      }, required: ['action'], additionalProperties: false },
      output: { schema: { type: 'object', properties: { action: { type: 'string' }, text: { type: 'string' } }, required: ['action', 'text'] },
        render(_args, value) { return [{ type: 'text', text: value.text }] } },
      async execute(args, exec) {
        if (!exec?.agent) throw new Error('persona_manage 需要所属会话')
        if (args.action === 'list') return { action: 'list', text: await listText(exec.agent) }
        if (args.action === 'models') return { action: 'models', text: await modelList(args.provider) }
        if (args.action === 'reload') {
          await catalog.reload()
          return { action: 'reload', text: '模型角色绑定缓存已更新；下一次请求使用新绑定，无需重启。' }
        }
        const result = await catalog.change(args, routeFor(exec.agent))
        return { action: result.action, text: `${result.note}\n保存位置：${result.path}\n绑定缓存已自动更新，无需另行刷新。${config.mode === 'fixed' ? '\n当前是固定人设模式，自动模型绑定要在 auto 模式下才生效。' : ''}` }
      },
    })
  })

  ctx.inject(['commands'], scope => {
    scope.commands.register({
      name: 'persona', description: '查看会话人设、目录和对话管理方法', input: { hint: 'files | show | sync | reload | world | list | help' },
      async handler(invocation) {
        const argument = invocation.rawInput.trim()
        try {
          if (argument === 'help') return { kind: 'success', text: '通过对话修改：补充全局世界观用 persona_edit scope=world；修改自己的设定用 scope=persona。保存成功自动更新缓存，不需要重启。AI 若用外部文件工具写入，应随后自动调用一次 persona_edit action=reload（同一 scope）；外部修改绑定则调用 persona_manage action=reload。不要把刷新任务交给用户，也不要周期性刷新。/persona world 查看共同世界；/persona reload 或 /persona world reload 手动重读。' }
          if (argument === 'list') return { kind: 'success', text: await listText(invocation.agent) }
          if (argument === 'world' || argument === 'world show') return { kind: 'success', text: (await world.compose()).text }
          if (argument === 'world reload') {
            await world.reload()
            if (shared) await shared.reload()
            return { kind: 'success', text: '全局世界观缓存已更新，所有会话的下一次请求生效。' }
          }
          if (argument === 'world sync') {
            const result = await world.sync()
            return { kind: 'success', text: `全局世界观已同步并刷新：新增 ${result.added} / 更新 ${result.updated} / 保留 ${result.kept}` }
          }
          const { store } = await forInvocation(invocation.agent, true)
          const head = await summary(invocation.agent)
          if (!store) return { kind: 'success', text: `${head}\n仍加载全局世界观。可通过对话创建角色；/persona help 查看例句。` }
          if (argument === 'reload') {
            await store.reload()
            return { kind: 'success', text: `${head}\n当前角色缓存已更新。` }
          }
          if (argument === 'sync') {
            const result = await store.sync()
            return { kind: 'success', text: `${head}\n同步并刷新：新增 ${result.added} / 更新 ${result.updated} / 保留修改 ${result.kept} / 已是最新 ${result.upToDate}` }
          }
          const value = await store.compose()
          if (argument === 'show') return { kind: 'success', text: value.text }
          if (argument === 'files') return { kind: 'success', text: `${head}\n${value.sources.map(s => `${s.path}（${s.text.length} 字符）`).join('\n')}` }
          return { kind: 'success', text: `${head}\n人设目录：${store.config.personaDir}\n记忆文件：${store.config.memoryFile}\n注入：${value.sources.length} 个文件 / ${value.chars} 字符\nAI 可写：${config.allowAgentWrite ? '是' : '否'}\n修改或补充人设请直接在聊天中让 AI 保存；/persona help 查看例句。` }
        } catch (error) { return { kind: 'error', text: error.message } }
      },
    })
    scope.commands.register({
      name: 'remember', description: '为当前选择的角色记住一句话', input: { hint: '要记住的一句话' },
      async handler(invocation) {
        const text = invocation.rawInput.trim()
        if (!text) return { kind: 'error', text: '用法：/remember 要记住的一句话' }
        try {
          const { store } = await forInvocation(invocation.agent, true)
          if (!store) return { kind: 'error', text: '当前模型未绑定人设，请先通过对话绑定角色' }
          const value = await store.edit({ action: 'append', category: 'memory', text, source: '用户口述' })
          return { kind: 'success', text: `${store.config.label}：${value.note}\n写入 ${value.path}` }
        } catch (error) { return { kind: 'error', text: `没写进去：${error.message}` } }
      },
    })
  })
}
