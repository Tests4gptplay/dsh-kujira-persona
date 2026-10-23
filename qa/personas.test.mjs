import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const ROOT = process.env.SOURCE_DIR
const { apply } = await import(pathToFileURL(join(ROOT, 'index.js')))

function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'kujira-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const sections = [], tools = new Map(), commands = new Map(), hooks = []
  const pending = new WeakMap()
  const context = {
    systemPrompt: { section: value => sections.push(value) },
    get: name => name === 'sessionProjections' ? { stateOf: session => ({ pending: pending.get(session) }) } : undefined,
    on: (event, handler, opts) => hooks.push({ event, handler, opts }),
    inject: (services, callback) => callback({
      tools: { register: value => tools.set(value.name, value) },
      commands: { register: value => commands.set(value.name, value) },
    }),
  }
  const config = { personaDir: join(root, 'legacy'), personasDir: join(root, 'roles'), ...options }
  apply(context, config)
  function agent(provider, model) {
    const a = { options: { provider, model }, header: null }
    a.session = { requestHeader: () => a.header }
    return a
  }
  async function assemble(a, route = a.options, gate) {
    const assembly = {
      sections: [{ name: 'harness:identity', text: 'HOST_UNCHANGED', interpolate: true }, ...sections.map(s => ({ ...s }))],
      tools: [{ name: 'ordinary_tool' }], contexts: [{ name: 'runtime', text: 'DO_NOT_TOUCH' }], variables: { provider: 'stale', model: 'stale' },
    }
    const result = await hooks[0].handler(assembly, { agent: a }, async () => {
      if (gate) await gate
      return { ...assembly, variables: { ...route } }
    })
    a.header = { config: { ...route } }
    assert.equal(result.tools, assembly.tools)
    assert.equal(result.contexts, assembly.contexts)
    assert.equal(result.sections[0], assembly.sections[0])
    return result.sections.find(s => s.name === 'whale:persona').text
  }
  return { root, config, agent, assemble, pending, tools, commands, sections, hooks }
}

test('one hook and existing tools/commands only; no timer or service loop', t => {
  const f = fixture(t)
  assert.deepEqual(f.hooks.map(h => h.event), ['system-prompt/assemble'])
  assert.deepEqual([...f.tools.keys()], ['persona_edit'])
  assert.deepEqual([...f.commands.keys()], ['persona', 'remember'])
  assert.equal(f.sections.length, 1)
})

test('first request and same-session DeepSeek -> GPT -> DeepSeek select one identity', async t => {
  const f = fixture(t), a = f.agent('deepseek-official', 'deepseek-chat')
  assert.match(await f.assemble(a), /人设层：DeepSeek 鲸鱼娘/)
  const gpt = await f.assemble(a, { provider: 'gateway', model: 'gpt-6' })
  assert.match(gpt, /人设层：GPT 白龙娘/)
  assert.doesNotMatch(gpt, /人设层：DeepSeek 鲸鱼娘/)
  assert.match(await f.assemble(a), /人设层：DeepSeek 鲸鱼娘/)
})

test('concurrent sessions do not share selection', async t => {
  const f = fixture(t), whale = f.agent('deepseek-official', 'deepseek-chat'), dragon = f.agent('gateway', 'openai/gpt-6')
  let resolve
  const gate = new Promise(r => { resolve = r })
  const first = f.assemble(whale, whale.options, gate)
  assert.match(await f.assemble(dragon), /人设层：GPT 白龙娘/)
  resolve()
  assert.match(await first, /人设层：DeepSeek 鲸鱼娘/)
})

test('provider protocol alone is not GPT; codex-local and family aliases are recognized', async t => {
  const f = fixture(t)
  for (const model of ['gpt-5.4', 'chatgpt-4o-latest', 'o3', 'openai/gpt-6']) {
    assert.match(await f.assemble(f.agent('custom', model)), /人设层：GPT 白龙娘/)
  }
  assert.match(await f.assemble(f.agent('codex-local', 'default')), /人设层：GPT 白龙娘/)
  assert.equal(await f.assemble(f.agent('openai-compatible', 'claude-sonnet')), '')
  assert.equal(await f.assemble(f.agent('openai', 'private-model')), '')
})

test('explicit mappings override defaults with literal matching and none support', async t => {
  const f = fixture(t, { modelRules: [
    { provider: 'private-gateway', model: 'prod.*', persona: 'gpt' },
    { model: 'deepseek-*', persona: 'none' },
  ] })
  assert.match(await f.assemble(f.agent('private-gateway', 'prod.v1')), /人设层：GPT 白龙娘/)
  assert.equal(await f.assemble(f.agent('private-gateway', 'prodXv1')), '')
  assert.equal(await f.assemble(f.agent('other', 'prod.v1')), '')
  assert.equal(await f.assemble(f.agent('deepseek-official', 'deepseek-chat')), '')
})

test('fixed persona and unknown fallback are explicit configuration', async t => {
  const fixed = fixture(t, { mode: 'fixed', persona: 'gpt' })
  assert.match(await fixed.assemble(fixed.agent('other', 'unknown')), /人设层：GPT 白龙娘/)
  const fallback = fixture(t, { unknownPersona: 'deepseek' })
  assert.match(await fallback.assemble(fallback.agent('other', 'unknown')), /人设层：DeepSeek 鲸鱼娘/)
})

test('learning persists by role, tools ignore later pending picker change', async t => {
  const f = fixture(t), a = f.agent('deepseek-official', 'deepseek-chat'), tool = f.tools.get('persona_edit')
  await f.assemble(a)
  f.pending.set(a.session, { provider: 'other', model: 'gpt-6' })
  const w = await tool.execute({ action: 'append', category: 'memory', text: 'WHALE_ONLY', source: '用户口述' }, { agent: a })
  assert.equal(w.persona, 'deepseek')
  assert.equal(w.path, join(f.config.personaDir, '90-记忆.md'))
  const g = await f.assemble(a, { provider: 'other', model: 'gpt-6' })
  assert.doesNotMatch(g, /WHALE_ONLY/)
  const r = await tool.execute({ action: 'append', category: 'memory', text: 'DRAGON_ONLY' }, { agent: a })
  assert.equal(r.persona, 'gpt')
  const whaleText = await f.assemble(a)
  assert.match(whaleText, /WHALE_ONLY/)
  assert.doesNotMatch(whaleText, /DRAGON_ONLY/)
  assert.match(await f.assemble(a, { provider: 'other', model: 'gpt-6' }), /DRAGON_ONLY/)
})

test('tool cannot guess a role without agent or for an unknown route', async t => {
  const f = fixture(t), tool = f.tools.get('persona_edit')
  await assert.rejects(tool.execute({ action: 'append', text: 'WRONG' }, {}), /所属会话/)
  await assert.rejects(tool.execute({ action: 'append', text: 'WRONG' }, { agent: f.agent('custom', 'unknown') }), /未绑定/)
  assert.equal(existsSync(f.config.personaDir), false)
})

test('old DeepSeek directory and user edits survive first activation, sync and restart', async t => {
  const f = fixture(t)
  mkdirSync(f.config.personaDir, { recursive: true })
  const original = '# 用户已有的鲸鱼娘\nUSER_CUSTOM_BEFORE_UPGRADE\n'
  const path = join(f.config.personaDir, '00-身份.md')
  writeFileSync(path, original)
  writeFileSync(join(f.config.personaDir, '.kujira-state.json'), JSON.stringify({ files: { '00-身份.md': { hash: 'old-seed', source: 'seed' } } }))
  const a = f.agent('deepseek-official', 'deepseek-chat')
  await f.assemble(a)
  assert.equal(readFileSync(path, 'utf8'), original)
  f.commands.get('persona').handler({ agent: a, rawInput: 'sync' })
  assert.equal(readFileSync(path, 'utf8'), original)
  const { openDossier } = await import(pathToFileURL(join(ROOT, 'dossier.js')))
  const reopened = openDossier({ ...f.config, id: 'deepseek', label: 'DeepSeek 鲸鱼娘', packagedDir: join(ROOT, 'persona'), memoryFile: join(f.config.personaDir, '90-记忆.md'), seed: true, sync: true, allowAgentWrite: true, sharedDir: '', extraText: '' })
  assert.match(reopened.compose().text, /USER_CUSTOM_BEFORE_UPGRADE/)
  assert.equal(readFileSync(path, 'utf8'), original)
})

test('unchanged seeded files upgrade, legacy state migrates without overwriting edits', async t => {
  const f = fixture(t), path = join(f.config.personaDir, '00-身份.md')
  mkdirSync(f.config.personaDir, { recursive: true })
  const old = '# previous seeded body\n'
  writeFileSync(path, old)
  writeFileSync(join(f.config.personaDir, '.kujira-state.json'), JSON.stringify({ files: { '00-身份.md': { hash: createHash('sha256').update(old).digest('hex'), source: 'seed' } } }))
  await f.assemble(f.agent('deepseek-official', 'deepseek-chat'))
  assert.equal(readFileSync(path, 'utf8'), readFileSync(join(ROOT, 'persona/00-身份.md'), 'utf8'))
  assert.equal(readFileSync(join(f.config.personaDir, '.kujira-backup/00-身份.md'), 'utf8'), old)
})

test('GPT edits and explicit file deletion survive sync', async t => {
  const f = fixture(t), a = f.agent('openai', 'gpt-6'), tool = f.tools.get('persona_edit')
  await f.assemble(a)
  await tool.execute({ action: 'append', file: '20-性格与表达.md', text: 'CUSTOM_DRAGON' }, { agent: a })
  const path = join(f.config.personasDir, 'gpt/20-性格与表达.md')
  f.commands.get('persona').handler({ agent: a, rawInput: 'sync' })
  assert.match(readFileSync(path, 'utf8'), /CUSTOM_DRAGON/)
  await tool.execute({ action: 'delete', file: '10-外观.md' }, { agent: a })
  f.commands.get('persona').handler({ agent: a, rawInput: 'sync' })
  assert.equal(existsSync(join(f.config.personasDir, 'gpt/10-外观.md')), false)
})

test('replace/delete apply only to current role and ordinary filename semantics remain', async t => {
  const f = fixture(t), a = f.agent('gateway', 'gpt-6'), tool = f.tools.get('persona_edit')
  await f.assemble(a)
  await tool.execute({ action: 'append', file: '45-私设.md', text: 'ORIGINAL' }, { agent: a })
  await tool.execute({ action: 'replace', file: '45-私设.md', oldText: 'ORIGINAL', newText: 'REPLACED' }, { agent: a })
  assert.match(await f.assemble(a), /REPLACED/)
  await assert.rejects(tool.execute({ action: 'append', file: '../outside.md', text: 'bad' }, { agent: a }))
  await tool.execute({ action: 'delete', file: '45-私设.md', oldText: 'REPLACED' }, { agent: a })
  assert.doesNotMatch(await f.assemble(a), /REPLACED/)
  assert.equal(existsSync(f.config.personaDir), false)
})

test('manual remember follows pending selection while tools follow originating request', async t => {
  const f = fixture(t), a = f.agent('deepseek-official', 'deepseek-chat')
  await f.assemble(a)
  f.pending.set(a.session, { provider: 'gateway', model: 'gpt-6' })
  const result = f.commands.get('remember').handler({ agent: a, rawInput: 'SELECTED_DRAGON' })
  assert.equal(result.kind, 'success')
  assert.match(result.text, /GPT 白龙娘/)
  assert.match(readFileSync(join(f.config.personasDir, 'gpt/90-记忆.md'), 'utf8'), /SELECTED_DRAGON/)
  assert.doesNotMatch(await f.assemble(a), /SELECTED_DRAGON/)
})

test('disabled agent edits remove only persona_edit; commands and host tools untouched', async t => {
  const f = fixture(t, { allowAgentWrite: false })
  assert.equal(f.tools.size, 0)
  assert.equal(f.commands.size, 2)
  const text = await f.assemble(f.agent('gateway', 'gpt-6'))
  assert.doesNotMatch(text, /用 persona_edit/)
})

test('disabled plugin does nothing', t => {
  const f = fixture(t, { enabled: false })
  assert.equal(f.hooks.length, 0)
  assert.equal(f.sections.length, 0)
  assert.equal(f.tools.size, 0)
  assert.equal(f.commands.size, 0)
})

test('custom memoryFile remains DeepSeek-only and is included in its prompt', async t => {
  const extra = mkdtempSync(join(tmpdir(), 'kujira-custom-memory-'))
  t.after(() => rmSync(extra, { recursive: true, force: true }))
  const memoryFile = join(extra, 'memory.md'), f = fixture(t, { memoryFile }), a = f.agent('deepseek-official', 'deepseek-chat')
  await f.assemble(a)
  f.commands.get('remember').handler({ agent: a, rawInput: 'CUSTOM_MEMORY_PATH' })
  assert.match(readFileSync(memoryFile, 'utf8'), /CUSTOM_MEMORY_PATH/)
  assert.match(await f.assemble(a), /CUSTOM_MEMORY_PATH/)
  assert.doesNotMatch(await f.assemble(a, { provider: 'gateway', model: 'gpt-6' }), /CUSTOM_MEMORY_PATH/)
})

test('shared preferences are opt-in, read-only, and stable prompt bytes stay stable', async t => {
  const f = fixture(t), a = f.agent('gateway', 'gpt-6')
  const first = await f.assemble(a)
  assert.equal(await f.assemble(a), first)
  const shared = join(f.root, 'shared'); mkdirSync(shared); writeFileSync(join(shared, '00-user.md'), 'SHARED_USER_PREF')
  const explicit = fixture(t, { sharedDir: shared })
  assert.match(await explicit.assemble(explicit.agent('deepseek-official', 'deepseek-chat')), /SHARED_USER_PREF/)
  assert.match(await explicit.assemble(explicit.agent('gateway', 'gpt-6')), /SHARED_USER_PREF/)
  assert.equal(readFileSync(join(shared, '00-user.md'), 'utf8'), 'SHARED_USER_PREF')
  assert.doesNotMatch(await f.assemble(a), /SHARED_USER_PREF/)
})

test('freshly edited Markdown changes next prompt without a reload', async t => {
  const f = fixture(t), a = f.agent('gateway', 'gpt-6')
  await f.assemble(a)
  writeFileSync(join(f.config.personasDir, 'gpt/45-live.md'), '# LIVE_CHANGE_MARKER')
  assert.match(await f.assemble(a), /LIVE_CHANGE_MARKER/)
})
