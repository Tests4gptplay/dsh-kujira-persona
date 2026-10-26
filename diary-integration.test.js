import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { openDiary } from './diary.js'
import { applyDiaryIntegration, DIARY_SECTION } from './diary-integration.js'

const roles = { gpt: { id: 'gpt', label: 'GPT' }, claude: { id: 'claude', label: 'Claude' }, 'role-c': { id: 'role-c', label: '角色C' } }
function harness() {
  const sections = new Map(), events = new Map(), tools = new Map(), warnings = [], registrations = [], disposedTools = [], effects = new Set()
  const ctx = {
    logger: { warn: text => warnings.push(text) },
    systemPrompt: { section(value) { sections.set(value.name, value); return () => sections.delete(value.name) } },
    tools: { register(definition) { assert.equal(tools.has(definition.name), false); tools.set(definition.name, definition); registrations.push(definition.name); return () => { if (tools.get(definition.name) === definition) tools.delete(definition.name); disposedTools.push(definition.name) } } },
    commands: { register() {} },
    get() { return undefined },
    effect(setup) { const cleanup = setup(); const dispose = () => { if (effects.delete(dispose)) return cleanup?.() }; effects.add(dispose); return dispose },
    on(name, listener, options = {}) {
      const listeners = events.get(name) ?? []; events.set(name, listeners)
      if (options.prepend) listeners.unshift(listener); else listeners.push(listener)
      return () => { const i = listeners.indexOf(listener); if (i >= 0) listeners.splice(i, 1) }
    },
    inject(dependencies, callback) { if (dependencies.every(name => ['tools', 'commands'].includes(name))) callback(ctx) },
  }
  async function assemble(agent, variables = {}) {
    const assembly = { variables, sections: [...sections.values()], contexts: [{ name: 'untouched', text: 'existing context' }], history: [{ role: 'assistant', content: 'KEEP-OLD-CHAT' }] }
    const listeners = events.get('system-prompt/assemble') ?? []
    const next = i => i === listeners.length ? Promise.resolve(assembly) : listeners[i](assembly, { agent }, () => next(i + 1))
    return next(0)
  }
  function dispose() { for (const stop of [...effects]) stop(); for (const listener of [...events.get('dispose') ?? []]) listener() }
  return { ctx, assemble, dispose, tools, warnings, registrations, disposedTools, events, effects }
}
async function fixture(t, options = {}) {
  const home = options.home ?? await mkdtemp(join(tmpdir(), 'kujira-diary-integration-'))
  if (!options.home) t.after(() => rm(home, { recursive: true, force: true }))
  const diary = options.diary ?? openDiary({ home }), requests = new WeakMap(), host = harness()
  const fallbackCalls = []
  const forInvocation = options.forInvocation ?? (async agent => { fallbackCalls.push(agent); return { entry: roles[agent.role] ?? null } })
  // Stand-in for the existing index.js listener: it captures the actual route of
  // this assembly, not an unrelated UI selection or a previous request header.
  host.ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const entry = roles[assembled.variables.model] ?? roles['role-c']
    requests.set(context.agent, { route: { provider: 'fixture', model: assembled.variables.model }, entry })
    return assembled
  }, { global: true, prepend: true })
  const integration = applyDiaryIntegration(host.ctx, { diary, requests, forInvocation })
  t.after(() => integration.dispose())
  await diary.ready; await Promise.resolve()
  return { home, diary, requests, host, integration, fallbackCalls }
}
const diaryText = assembly => assembly.sections.find(section => section.name === DIARY_SECTION)?.text ?? ''
const agent = role => ({ role, session: { requestHeader: () => ({ config: { provider: 'fixture', model: role } }) } })

test('default OFF registers no tool; ON registers once; OFF disposes and removes only future section', async t => {
  const { diary, host } = await fixture(t), a = agent('gpt')
  assert.equal(host.tools.has('ai_diary'), false)
  assert.equal(diaryText(await host.assemble(a, { model: 'gpt' })), '')
  await diary.configure({ enabled: true })
  const tool = host.tools.get('ai_diary'); assert.ok(tool)
  assert.match(diaryText(await host.assemble(a, { model: 'gpt' })), /GPT（gpt）/)
  await diary.configure({ enabled: true }); assert.equal(host.tools.get('ai_diary'), tool)
  await tool.execute({ action: 'append', text: 'unchanged record', summary: 'unchanged record' }, { agent: a })
  const before = await diary.readOwn(roles.gpt)
  await diary.configure({ enabled: false })
  assert.equal(host.tools.has('ai_diary'), false)
  await assert.rejects(tool.execute({ action: 'append', text: 'blocked', summary: 'blocked' }, { agent: a }), /已关闭|失效/)
  const result = await host.assemble(a, { model: 'gpt' })
  assert.equal(diaryText(result), '')
  assert.deepEqual(result.history, [{ role: 'assistant', content: 'KEEP-OLD-CHAT' }])
  assert.deepEqual(result.contexts, [{ name: 'untouched', text: 'existing context' }])
  assert.deepEqual([...host.events.keys()].sort(), ['system-prompt/assemble']); assert.equal(host.effects.size, 2)
  await diary.configure({ enabled: true })
  await assert.rejects(tool.execute({ action: 'append', text: 'old tool cannot revive', summary: 'old tool cannot revive' }, { agent: a }), /失效/)
  assert.equal((await diary.readOwn(roles.gpt)).text, before.text)
  assert.equal(host.registrations.filter(name => name === 'ai_diary').length, 2)
  assert.equal(host.disposedTools.filter(name => name === 'ai_diary').length, 1)
})

test('persisted ON restores tool and own diary after a new plugin instance', async t => {
  const first = await fixture(t)
  await first.diary.configure({ enabled: true }); await first.diary.appendOwn(roles['role-c'], 'persistent role C', 'persistent role C')
  first.integration.dispose()
  const second = await fixture(t, { home: first.home })
  assert.ok(second.host.tools.has('ai_diary'))
  assert.match(diaryText(await second.host.assemble(agent('role-c'), { model: 'unknown-model' })), /persistent role C/)
})

test('same session switching three independent roles uses each current assembly owner only', async t => {
  const { diary, host, fallbackCalls } = await fixture(t), a = agent('gpt')
  await diary.configure({ enabled: true })
  for (const id of ['gpt', 'claude', 'role-c']) {
    await host.assemble(a, { model: id })
    await host.tools.get('ai_diary').execute({ action: 'append', text: `ONLY-${id}`, summary: `ONLY-${id}` }, { agent: a })
  }
  for (const id of ['gpt', 'claude', 'role-c']) {
    const text = diaryText(await host.assemble(a, { model: id }))
    assert.ok(text.includes(`ONLY-${id}`))
    for (const other of ['gpt', 'claude', 'role-c'].filter(value => value !== id)) assert.equal(text.includes(`ONLY-${other}`), false)
    const read = await host.tools.get('ai_diary').execute({ action: 'read' }, { agent: a })
    assert.equal(read.owner, id)
  }
  assert.equal(fallbackCalls.length, 0)
})

test('parallel sessions and a role change during pending write never retarget captured owner', async t => {
  const { diary, host, requests } = await fixture(t)
  await diary.configure({ enabled: true })
  const sessions = Array.from({ length: 24 }, (_, i) => agent(i % 2 ? 'claude' : 'gpt'))
  await Promise.all(sessions.map(a => host.assemble(a, { model: a.role })))
  const tool = host.tools.get('ai_diary')
  const pending = sessions.map((a, i) => tool.execute({ action: 'append', text: `SESSION-${i}-${a.role}`, summary: `SESSION-${i}-${a.role}` }, { agent: a }))
  for (const a of sessions) requests.set(a, { entry: roles['role-c'], route: { model: 'role-c' } })
  await Promise.all(pending)
  const gpt = (await diary.readOwn(roles.gpt)).text, claude = (await diary.readOwn(roles.claude)).text
  for (let i = 0; i < sessions.length; i++) {
    assert.ok((i % 2 ? claude : gpt).includes(`SESSION-${i}-`))
    assert.equal((i % 2 ? gpt : claude).includes(`SESSION-${i}-`), false)
  }
  assert.equal((await diary.readOwn(roles['role-c'])).text, '')
})

test('OFF while queued append/fallback owner resolution is pending blocks writing without killing host', async t => {
  let finish
  const { diary, host } = await fixture(t, { forInvocation: () => new Promise(resolve => { finish = resolve }) })
  await diary.configure({ enabled: true })
  const tool = host.tools.get('ai_diary'), pending = tool.execute({ action: 'append', text: 'must not save', summary: 'must not save' }, { agent: agent('gpt') })
  const off = diary.configure({ enabled: false }); finish({ entry: roles.gpt })
  await assert.rejects(pending, /已关闭|失效/); await off
  assert.equal(diaryText(await host.assemble(agent('gpt'), { model: 'gpt' })), '')
  await diary.configure({ enabled: true }); assert.equal((await diary.readOwn(roles.gpt)).text, '')
})

test('tool has no owner/path schema or runtime bypass, and does not require persona write feature', async t => {
  const { diary, host } = await fixture(t), a = agent('gpt')
  await diary.configure({ enabled: true }); await host.assemble(a, { model: 'gpt' })
  const tool = host.tools.get('ai_diary')
  assert.deepEqual(Object.keys(tool.parameters.properties).sort(), ['action', 'cursor', 'date', 'end_line', 'full', 'kind', 'max_chars', 'max_results', 'query', 'start_column', 'start_line', 'summary', 'text'])
  assert.equal(tool.parameters.additionalProperties, false)
  assert.equal(Object.hasOwn(tool, 'when'), false)
  for (const args of [{ action: 'read', owner: 'claude' }, { action: 'read', path: '/tmp/foreign' }, { action: 'list' }]) await assert.rejects(tool.execute(args, { agent: a }), /只接受/)
  await assert.rejects(tool.execute({ action: 'read' }, {}), /所属会话/)
  assert.deepEqual([...host.tools.keys()], ['ai_diary'])
})

test('context I/O failure is visible in log but keeps all ordinary prompt content usable', async t => {
  const { home, diary, host } = await fixture(t)
  await diary.configure({ enabled: true })
  host.ctx.systemPrompt.section({ name: 'normal', order: 5, text: 'ordinary prompt' })
  await mkdir(join(home, 'diaries', 'gpt'), { recursive: true })
  await mkdir(join(home, 'diaries', 'gpt', 'Persona_diary.md'))
  const assembly = await host.assemble(agent('gpt'), { model: 'gpt' })
  assert.equal(diaryText(assembly), '')
  assert.equal(assembly.sections.find(value => value.name === 'normal').text, 'ordinary prompt')
  assert.ok(host.warnings.some(value => value.includes('日记暂不可用')))
})

test('plugin disposal unregisters current tool and stops updates without deleting diary files', async t => {
  const { home, diary, host, integration } = await fixture(t), a = agent('gpt')
  await diary.configure({ enabled: true }); await host.assemble(a, { model: 'gpt' })
  await host.tools.get('ai_diary').execute({ action: 'append', text: 'kept after dispose', summary: 'kept after dispose' }, { agent: a })
  integration.dispose(); assert.equal(host.tools.has('ai_diary'), false)
  await diary.configure({ enabled: false }); await diary.configure({ enabled: true })
  assert.equal(host.tools.has('ai_diary'), false)
  assert.match(await readFile(join(home, 'diaries', 'gpt', 'Diary.md'), 'utf8'), /kept after dispose/)
})

test('invalid settings initialize safely even before optional tools service exists', async t => {
  const home = await mkdtemp(join(tmpdir(), 'kujira-diary-no-tools-')); t.after(() => rm(home, { recursive: true, force: true }))
  await writeFile(join(home, 'kujira-diary.json'), '{broken')
  const diary = openDiary({ home }), host = harness(); host.ctx.inject = () => {}
  applyDiaryIntegration(host.ctx, { diary, requests: new WeakMap(), forInvocation: async () => ({ entry: roles.gpt }) })
  host.ctx.systemPrompt.section({ name: 'normal', order: 5, text: 'normal conversation remains' })
  const assembly = await host.assemble(agent('gpt'), { model: 'gpt' })
  assert.equal(diaryText(assembly), '')
  assert.equal(assembly.sections.find(value => value.name === 'normal').text, 'normal conversation remains')
  assert.equal(host.warnings.length, 0)
})

test('tool requires paired summary, supports summary-only correction and renders partial saves truthfully', async t => {
  const { home, diary, host } = await fixture(t), a = agent('gpt')
  await diary.configure({ enabled: true }); await host.assemble(a, { model: 'gpt' })
  const tool = host.tools.get('ai_diary')
  await assert.rejects(tool.execute({ action: 'append', text: 'no summary' }, { agent: a }), /必须同时提供/)
  const summaryFile = join(home, 'diaries', 'gpt', 'Persona_diary.md'); await mkdir(summaryFile, { recursive: true })
  const result = await tool.execute({ action: 'append', text: 'DETAIL-ONCE', summary: 'concise persona summary' }, { agent: a })
  assert.equal(result.status, 'summary_pending')
  assert.match(tool.output.render({}, result)[0].text, /Diary 已写入.*摘要待补/)
  await rm(summaryFile, { recursive: true })
  await tool.execute({ action: 'update_summary', summary: 'corrected concise summary' }, { agent: a })
  const read = await tool.execute({ action: 'read' }, { agent: a })
  assert.equal(read.text, 'DETAIL-ONCE\n'); assert.equal(read.summary, 'corrected concise summary')
  const prompt = diaryText(await host.assemble(a, { model: 'gpt' }))
  assert.match(prompt, /corrected concise summary/); assert.doesNotMatch(prompt, /DETAIL-ONCE/)
  await tool.execute({ action: 'update_summary', summary: '' }, { agent: a })
  assert.equal((await diary.readOwn(roles.gpt)).summary, '')
})

test('actual index wiring preserves persona tools and routes current diary despite old session header', async t => {
  const home = await mkdtemp(join(tmpdir(), 'kujira-diary-index-')); t.after(() => rm(home, { recursive: true, force: true }))
  const previous = process.env.DSH_HOME; process.env.DSH_HOME = home
  let plugin
  try { plugin = await import('./index.js?diary-integration-test=' + encodeURIComponent(home)) }
  finally { if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous }
  await writeFile(join(home, 'kujira-diary.json'), JSON.stringify({ v: 1, enabled: true, directory: join(home, 'diaries') }))
  const host = harness(); t.after(() => host.dispose())
  plugin.apply(host.ctx, { worldDir: join(home, 'world'), personasDir: join(home, 'personas'), personaDir: join(home, 'persona'), seed: false, sync: false })
  const a = agent('gpt')
  const assembly = await host.assemble(a, { provider: 'fixture', model: 'claude-sonnet-4' })
  assert.ok(host.tools.has('persona_edit')); assert.ok(host.tools.has('persona_manage')); assert.ok(host.tools.has('ai_diary'))
  assert.match(diaryText(assembly), /Claude（claude）/)
  assert.equal((await host.tools.get('ai_diary').execute({ action: 'append', text: 'correct current route', summary: 'correct current route' }, { agent: a })).owner, 'claude')
  const fallback = await host.assemble(a, { provider: 'fixture', model: 'opaque-model' })
  const fallbackRead = await host.tools.get('ai_diary').execute({ action: 'read' }, { agent: a })
  assert.notEqual(fallbackRead.owner, 'claude'); assert.notEqual(fallbackRead.owner, 'gpt')
  assert.ok(diaryText(fallback).includes(`（${fallbackRead.owner}）`))
  assert.doesNotMatch(diaryText(fallback), /correct current route/)
  const readOnlyPersonaHost = harness(); t.after(() => readOnlyPersonaHost.dispose())
  plugin.apply(readOnlyPersonaHost.ctx, { worldDir: join(home, 'world'), personasDir: join(home, 'personas'), personaDir: join(home, 'persona'), seed: false, sync: false, allowAgentWrite: false })
  await readOnlyPersonaHost.assemble(a, { provider: 'fixture', model: 'gpt-6' })
  assert.equal(readOnlyPersonaHost.tools.has('persona_edit'), false)
  assert.ok(readOnlyPersonaHost.tools.has('ai_diary'))
})

test('tool default read is bounded, explicit full is available, and rendered search/read cursors are actionable', async t => {
  const { diary, host } = await fixture(t), a = agent('role-c')
  await diary.configure({ enabled: true }); await host.assemble(a, { model: 'role-c' })
  const tool = host.tools.get('ai_diary'), body = '中😀'.repeat(5000) + 'needleA 间隔 needleA END-DETAIL'
  await tool.execute({ action: 'append', text: body, summary: '只保留简短个性摘要' }, { agent: a })
  const page = await tool.execute({ action: 'read' }, { agent: a })
  assert.equal(page.returned_chars, 8000); assert.equal(page.next_start_line, 1); assert.equal(page.next_start_column, 8001)
  const rendered = tool.output.render({}, page)[0].text
  assert.match(rendered, /start_line=1、start_column=8001/); assert.doesNotMatch(rendered, /END-DETAIL/)
  const full = await tool.execute({ action: 'read', full: true }, { agent: a })
  assert.equal(full.text, body + '\n'); assert.equal(full.has_more, false)
  const first = await tool.execute({ action: 'search', query: 'needleA', max_results: 1 }, { agent: a })
  const second = await tool.execute({ action: 'search', query: 'needleA', start_line: first.next_start_line, start_column: first.next_start_column, max_results: 1 }, { agent: a })
  assert.equal(first.matches.length, 1); assert.equal(second.matches.length, 1); assert.equal(second.has_more, false)
  assert.ok(first.matches[0].column < second.matches[0].column)
  assert.match(tool.output.render({}, first)[0].text, new RegExp(`start_line=${first.next_start_line}、start_column=${first.next_start_column}`))
  assert.equal((await tool.execute({ action: 'read', start_line: second.matches[0].line, start_column: second.matches[0].column, max_chars: 7 }, { agent: a })).text, 'needleA')
  const prompt = diaryText(await host.assemble(a, { model: 'role-c' }))
  assert.match(prompt, /只保留简短个性摘要/); assert.match(prompt, /不必每轮查阅/); assert.doesNotMatch(prompt, /END-DETAIL|needleA/)
})

test('irrelevant known parameters do not block operations; foreign paths and unusable ranges still reject', async t => {
  const { diary, host } = await fixture(t), a = agent('role-c')
  await diary.configure({ enabled: true }); await host.assemble(a, { model: 'role-c' })
  const tool = host.tools.get('ai_diary')
  for (const args of [{ action: 'read', query: 'ignored?' }, { action: 'search', query: 'x', full: true }, { action: 'append', text: 'x', summary: '', max_chars: 10 }]) await tool.execute(args, { agent: a })
  for (const args of [{ action: 'search', query: 'x', path: '/tmp/other' }, { action: 'read', owner: 'other' }]) await assert.rejects(tool.execute(args, { agent: a }), /只接受/)
  await assert.rejects(tool.execute({ action: 'search' }, { agent: a }), /query/)
  await assert.rejects(tool.execute({ action: 'read', full: true, max_chars: 1 }, { agent: a }), /不能同时/)
})

test('OFF after a read/search result resolves and OFF-ON before delivery still revoke the captured tool', async t => {
  for (const [action, method] of [['read', 'readRangeOwn'], ['search', 'searchOwn']]) {
    const { home, diary, host } = await fixture(t), a = agent('role-c')
    await diary.configure({ enabled: true }); await host.assemble(a, { model: 'role-c' })
    await diary.appendOwn(roles['role-c'], 'cached result must not escape', 'unchanged summary')
    const tool = host.tools.get('ai_diary'), original = diary[method]
    diary[method] = async (...args) => {
      const value = await original(...args)
      await diary.configure({ enabled: false }); await diary.configure({ enabled: true })
      return value
    }
    await assert.rejects(tool.execute(action === 'read' ? { action } : { action, query: 'cached' }, { agent: a }), /失效|已关闭/)
    diary[method] = original
    assert.notEqual(host.tools.get('ai_diary'), tool)
    assert.equal(await readFile(join(home, 'diaries', 'role-c', 'Diary.md'), 'utf8'), 'cached result must not escape\n')
    await diary.configure({ enabled: false })
    assert.equal(host.tools.has('ai_diary'), false); assert.equal(diaryText(await host.assemble(a, { model: 'role-c' })), '')
  }
})

test('search/read bind each parallel session before later role switches, without touching other prompt sections', async t => {
  const { diary, host, requests } = await fixture(t), a = agent('gpt'), b = agent('claude')
  await diary.configure({ enabled: true })
  await diary.appendOwn(roles.gpt, 'query ONLY-A', 'summary-A'); await diary.appendOwn(roles.claude, 'query ONLY-B', 'summary-B')
  await host.assemble(a, { model: 'gpt' }); await host.assemble(b, { model: 'claude' })
  const tool = host.tools.get('ai_diary'), search = tool.execute({ action: 'search', query: 'query' }, { agent: a }), read = tool.execute({ action: 'read' }, { agent: b })
  requests.set(a, { entry: roles['role-c'] }); requests.set(b, { entry: roles['role-c'] })
  const [sa, rb] = await Promise.all([search, read])
  assert.equal(sa.owner, 'gpt'); assert.match(sa.matches[0].excerpt, /ONLY-A/); assert.doesNotMatch(sa.matches[0].excerpt, /ONLY-B/)
  assert.equal(rb.owner, 'claude'); assert.match(rb.text, /ONLY-B/); assert.equal(rb.summary, 'summary-B')
  const assembly = await host.assemble(a, { model: 'gpt' })
  assert.deepEqual(assembly.history, [{ role: 'assistant', content: 'KEEP-OLD-CHAT' }])
  assert.deepEqual(assembly.contexts, [{ name: 'untouched', text: 'existing context' }])
})

test('OFF while current-role fallback resolution is pending revokes search and range read', async t => {
  const finishes = []
  const { diary, host } = await fixture(t, { forInvocation: () => new Promise(resolve => finishes.push(resolve)) })
  await diary.configure({ enabled: true })
  const tool = host.tools.get('ai_diary'), a = agent('role-c')
  const reads = [tool.execute({ action: 'read' }, { agent: a }), tool.execute({ action: 'search', query: 'anything' }, { agent: a })]
  const off = diary.configure({ enabled: false })
  finishes.forEach(finish => finish({ entry: roles['role-c'] }))
  for (const result of reads) await assert.rejects(result, /已关闭|失效/)
  await off; assert.equal(host.tools.has('ai_diary'), false)
})

test('official DSH schema subset, registration, prompt advertisement and native dispatch accept diary paging', { skip: !process.env.DSH_TEST_ROOT }, async t => {
  // Optional host integration, enabled in release verification. No new package
  // dependency: DSH_TEST_ROOT is an isolated official SDK installation root.
  const { pathToFileURL } = await import('node:url')
  const sdk = name => import(pathToFileURL(join(process.env.DSH_TEST_ROOT, 'node_modules', '@deepseek-ai', name, 'lib', 'index.js')).href)
  const [{ Context }, { default: SystemPrompt }, { default: ToolRuntime, assertObjectJsonSchema, assertSupportedJsonSchema }] = await Promise.all([sdk('cordis'), sdk('dsh-system-prompt'), sdk('dsh-tools')])
  const home = await mkdtemp(join(tmpdir(), 'kujira-diary-official-sdk-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const ctx = new Context(), diary = openDiary({ home }), requests = new WeakMap(), entry = roles['role-c']
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt, { personaPrefix: 'KEEP-OFFICIAL-PERSONA' })
  await ctx.plugin(ToolRuntime, { mode: 'native' })
  const a = agent('role-c'); requests.set(a, { entry })
  await ctx.plugin({ name: 'diary-real-sdk-test', inject: ['systemPrompt', 'tools'], apply(scope) { applyDiaryIntegration(scope, { diary, requests, forInvocation: async () => ({ entry }) }) } })
  await diary.ready; await diary.configure({ enabled: true })
  const tool = ctx.tools.get('ai_diary')
  assert.ok(tool, 'official tools.register must accept the output schema, not only the test harness')
  assertObjectJsonSchema(tool.parameters); assertSupportedJsonSchema(tool.output.schema)
  // Pin the regression: these are valid general JSON Schema constructs, but
  // not the subset enforced by the target official DSH tools service.
  assert.throws(() => assertSupportedJsonSchema({ type: ['integer', 'null'] }))
  assert.throws(() => assertObjectJsonSchema({ type: 'object', properties: { count: { type: 'integer', minimum: 1 } } }))
  const assembly = await ctx.systemPrompt.assemble({ agent: a, model: 'role-c' })
  assert.ok(assembly.tools.some(value => value.name === 'ai_diary'))
  const execute = async args => {
    const result = await ctx.tools.execute({ agent: a, name: 'ai_diary', arguments: args, signal: new AbortController().signal, callId: 'official-diary-' + args.action })
    assert.notEqual(result.isError, true, JSON.stringify(result)); assert.ok(result.content.some(value => value.type === 'text'))
    return result.content.filter(value => value.type === 'text').map(value => value.text).join('\n')
  }
  assert.match(await execute({ action: 'read' }), /此范围没有正文/)
  await execute({ action: 'append', text: '😀关键片段与关键第二处', summary: '简短摘要' })
  assert.match(await execute({ action: 'search', query: '关键', max_results: 1 }), /start_line=1、start_column=7/)
  assert.match(await execute({ action: 'read', start_line: 1, start_column: 7, max_chars: 2 }), /关键/)
  assert.match(await execute({ action: 'read', full: true }), /明确请求的完整读取/)
  assert.match(await execute({ action: 'search', query: '无此内容' }), /无命中/)
  await diary.configure({ enabled: false })
  assert.equal(ctx.tools.get('ai_diary'), undefined)
  const off = await ctx.systemPrompt.assemble({ agent: a, model: 'role-c' })
  assert.equal(off.tools.some(value => value.name === 'ai_diary'), false)
  assert.equal(diaryText(off), '')
})
