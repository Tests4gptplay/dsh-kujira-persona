import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
const ROOT = process.env.SOURCE_DIR
const { apply } = await import(pathToFileURL(join(ROOT, 'index.js')))
const { BUILTINS, modelFamily, openCatalog } = await import(pathToFileURL(join(ROOT, 'catalog.js')))
const { openDossier } = await import(pathToFileURL(join(ROOT, 'dossier.js')))
const variants = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-pro', 'deepseek-v3.2', 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B'],
  gpt: ['gpt-4o', 'gpt-4.1-mini', 'gpt-5.5', 'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.3-codex-spark', 'chatgpt-4o-latest', 'o1', 'o3-pro', 'o4-mini', 'codex-mini-latest', 'openai/gpt-oss-120b', 'ft:gpt-4o:org:suffix:id', 'openai/ft:gpt-4o:org:suffix:id'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'google/gemini-3-pro-preview'],
  claude: ['claude-opus-4', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'anthropic/claude-3.7-sonnet:thinking'],
  grok: ['grok-3', 'grok-4-fast-reasoning', 'x-ai/grok-code-fast-1'],
  glm: ['glm-4.5', 'glm-4-flash', 'ChatGLM3-6b', 'z-ai/glm-4.6'],
  kimi: ['kimi-k2', 'kimi-k2-thinking', 'moonshot-v1-128k', 'moonshotai/kimi-k2.5'],
  qwen: ['qwen-turbo', 'Qwen2.5-Coder-32B-Instruct', 'qwen3-next', 'qwen3-vl-235b', 'qwen/qwq-32b', 'qvq-max'],
  minimax: ['MiniMax-M1', 'minimax-m2.1', 'minimaxai/MiniMax-M2'],
  llama: ['Llama-3.3-70B-Instruct', 'meta-llama/Llama-4-Maverick', 'us.meta.llama3-3-70b-instruct-v1:0'],
  doubao: ['doubao-1.5-pro', 'doubao-seed-1.6', 'bytedance-seed/seed-2.0'],
}
for (const [family, models] of Object.entries(variants)) {
  test(`family ${family}: versions and variants share one stable id`, () => {
    for (const model of models) {
      for (const provider of ['openrouter', 'github-copilot', 'custom-relay']) {
        assert.equal(modelFamily({ provider, model, reasoningEffort: 'high' }), family, `${provider}/${model}`)
      }
    }
  })
}
test('only the 11 documented families have built-in roles', () => {
  assert.deepEqual(BUILTINS.map(p => p.id).sort(), Object.keys(variants).sort())
})
test('no preset for undocumented families, aliases, protocol names or misleading providers', () => {
  for (const provider of ['openai', 'openai-compatible', 'openrouter', 'github-copilot', 'google', 'azure', 'groq', 'codex-local', 'openai-codex', 'deepseek-official']) {
    for (const model of ['gemma-3-27b', 'mistral-large', 'mimo-v2', 'nova-pro', 'my-private-deployment', 'ep-20261023', 'seedream-4', '']) {
      assert.equal(modelFamily({ provider, model }), 'none', `${provider}/${model}`)
    }
  }
  assert.equal(modelFamily({ provider: 'openai-codex', model: 'claude-sonnet-4-5' }), 'claude')
  assert.equal(modelFamily({ provider: 'codex-local', model: 'qwen3-coder' }), 'qwen')
  assert.equal(modelFamily({ provider: 'groq', model: 'llama-3.3-70b' }), 'llama')
  assert.equal(modelFamily({ provider: 'codex-local', model: 'default' }), 'gpt')
  assert.equal(modelFamily({ provider: 'openai-codex', model: 'default' }), 'gpt')
})

function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'kujira-15-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const sections = [], tools = new Map(), commands = new Map(), hooks = [], pending = new WeakMap()
  let modelCalls = 0
  const llm = {
    listProviders: () => [{ id: 'codex-local', name: 'Codex (local login)' }, { id: 'openrouter', name: 'Mixed models' }],
    listModels: async provider => { modelCalls++; return provider === 'codex-local'
      ? [{ id: 'gpt-6-astra', name: 'GPT-6-Astra' }, { id: 'gpt-5.6-sol', name: 'GPT-5.6-Sol' }]
      : [{ id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet' }, { id: 'google/gemma-3', name: 'Gemma' }] },
  }
  const ctx = {
    systemPrompt: { section: value => sections.push(value) },
    get: name => name === 'sessionProjections' ? { stateOf: session => ({ pending: pending.get(session) }) } : name === 'llm' ? llm : undefined,
    on: (event, handler, opts) => hooks.push({ event, handler, opts }),
    inject: (services, callback) => callback({ tools: { register: value => tools.set(value.name, value) }, commands: { register: value => commands.set(value.name, value) } }),
  }
  const config = { personaDir: join(root, 'legacy'), personasDir: join(root, 'roles'), ...options }
  apply(ctx, config)
  function agent(provider = 'gateway', model = 'gpt-6-astra') {
    const a = { options: { provider, model }, header: null }
    a.session = { requestHeader: () => a.header }
    return a
  }
  async function assemble(a, route = a.options, gate) {
    const assembly = { sections: [{ name: 'host', text: 'HOST_UNCHANGED' }, ...sections.map(s => ({ ...s }))], tools: [{ name: 'host_tool' }], contexts: [{ name: 'context', text: 'KEEP' }], variables: { provider: 'old', model: 'deepseek-chat' } }
    const result = await hooks[0].handler(assembly, { agent: a }, async () => {
      if (gate) await gate
      return { ...assembly, variables: { ...route } }
    })
    a.header = { config: { ...route } }
    assert.equal(result.tools, assembly.tools)
    assert.equal(result.contexts, assembly.contexts)
    assert.equal(result.sections[0], assembly.sections[0])
    assert.deepEqual(result.variables, route)
    return result.sections.find(s => s.name === 'whale:persona').text
  }
  const edit = (a, args) => tools.get('persona_edit').execute(args, { agent: a })
  const manage = (a, args) => tools.get('persona_manage').execute(args, { agent: a })
  return { root, config, agent, assemble, pending, tools, commands, sections, hooks, edit, manage, modelCalls: () => modelCalls }
}

test('only one prompt hook and two on-demand tools, no model queries on activation or assembly', async t => {
  const f = fixture(t)
  assert.deepEqual(f.hooks.map(h => h.event), ['system-prompt/assemble'])
  assert.deepEqual([...f.tools.keys()], ['persona_edit', 'persona_manage'])
  assert.equal(f.sections.length, 1)
  await f.assemble(f.agent())
  assert.equal(f.modelCalls(), 0)
})
test('all documented roles have packaged basics and only the selected role is loaded', async t => {
  const f = fixture(t)
  for (const [id, models] of Object.entries(variants)) {
    const body = await f.assemble(f.agent('mixed', models[0]))
    assert.match(body, new RegExp(`## 人设层：${BUILTINS.find(p => p.id === id).label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.equal((body.match(/## 人设层：/g) ?? []).length, 1)
    const dir = id === 'deepseek' ? f.config.personaDir : join(f.config.personasDir, id)
    assert.ok(existsSync(join(dir, '90-记忆.md')), id)
  }
})
test('unknown model has no character, no seeded directory, but can be extended through conversation', async t => {
  const f = fixture(t), a = f.agent('custom', 'my-private-model')
  const text = await f.assemble(a)
  assert.doesNotMatch(text, /## 人设层：/)
  assert.equal(existsSync(f.config.personaDir), false)
  assert.equal(existsSync(f.config.personasDir), false)
  assert.ok(f.tools.has('persona_manage'))
})
test('GPT versions and provider variants read and write one memory', async t => {
  const f = fixture(t), a = f.agent()
  await f.assemble(a)
  await f.edit(a, { action: 'append', category: 'memory', text: 'ONE_DRAGON_MEMORY' })
  for (const model of variants.gpt) {
    assert.match(await f.assemble(a, { provider: 'openrouter', model }), /ONE_DRAGON_MEMORY/)
    const out = await f.edit(a, { action: 'list' })
    assert.equal(out.persona, 'gpt')
  }
  assert.deepEqual(readdirSync(f.config.personasDir).filter(n => !n.startsWith('.')), ['gpt'])
})
test('concurrent sessions keep distinct families and memories', async t => {
  const f = fixture(t), w = f.agent('deepseek-official', 'deepseek-chat'), g = f.agent('openai-codex', 'gpt-6-astra')
  let resolve; const gate = new Promise(r => { resolve = r })
  const delayed = f.assemble(w, w.options, gate)
  assert.match(await f.assemble(g), /人设层：GPT/)
  resolve(); assert.match(await delayed, /人设层：DeepSeek/)
  await f.edit(w, { action: 'append', category: 'memory', text: 'WHALE_EXCLUSIVE' })
  assert.doesNotMatch(await f.assemble(g), /WHALE_EXCLUSIVE/)
})
test('create custom role and bind current unknown model without changing current request role', async t => {
  const f = fixture(t), a = f.agent('company', 'my-model-v1')
  await f.assemble(a)
  const created = await f.manage(a, { action: 'create', persona: 'stella', name: '星璃', text: 'STELLA_BASICS', use_current_model: true })
  assert.match(created.text, /已创建/)
  await assert.rejects(f.edit(a, { action: 'append', text: 'NO_RETROACTIVE_ROLE' }), /未绑定/)
  await f.edit(a, { action: 'append', persona: 'stella', text: 'EXPLICIT_TARGET_OK' })
  const next = await f.assemble(a)
  assert.match(next, /STELLA_BASICS/)
  assert.match(next, /EXPLICIT_TARGET_OK/)
})
test('custom versions can share the same role and persist after reopening', async t => {
  const f = fixture(t), a = f.agent('company', 'my-model-v1')
  await f.assemble(a)
  await f.manage(a, { action: 'create', persona: 'stella', name: '星璃', text: 'USER_ROLE' })
  await f.manage(a, { action: 'bind', persona: 'stella', provider: 'company', model: 'my-model-*' })
  await f.assemble(a)
  await f.edit(a, { action: 'append', category: 'memory', text: 'STELLA_SHARED_MEMORY' })
  assert.match(await f.assemble(a, { provider: 'company', model: 'my-model-v2' }), /STELLA_SHARED_MEMORY/)
  const reopened = openCatalog({ ...f.config, mode: 'auto', unknownPersona: 'none', modelRules: [] })
  assert.equal(reopened.resolve({ provider: 'company', model: 'my-model-v3' }).id, 'stella')
  assert.equal(reopened.list().personas.filter(p => !p.builtin).length, 1)
})
test('bind existing role instead of cloning, unbind keeps files and restores default', async t => {
  const f = fixture(t), a = f.agent('company', 'private-alias')
  await f.assemble(a)
  await f.manage(a, { action: 'bind', persona: 'gpt', use_current_model: true })
  assert.match(await f.assemble(a), /人设层：GPT/)
  await f.edit(a, { action: 'append', category: 'memory', text: 'KEEP_AFTER_UNBIND' })
  await f.manage(a, { action: 'unbind', use_current_model: true })
  assert.doesNotMatch(await f.assemble(a), /## 人设层：/)
  assert.match(readFileSync(join(f.config.personasDir, 'gpt/90-记忆.md'), 'utf8'), /KEEP_AFTER_UNBIND/)
  await assert.rejects(f.manage(a, { action: 'create', persona: 'gpt', name: 'copy', text: 'bad' }), /已存在/)
})
test('binding changes during a GPT request do not redirect that request memory', async t => {
  const f = fixture(t), a = f.agent()
  await f.assemble(a)
  await f.manage(a, { action: 'bind', persona: 'claude', use_current_model: true })
  assert.equal((await f.edit(a, { action: 'append', category: 'memory', text: 'OLD_REQUEST_GPT' })).persona, 'gpt')
  assert.doesNotMatch(await f.assemble(a), /OLD_REQUEST_GPT/)
  assert.equal((await f.edit(a, { action: 'append', category: 'memory', text: 'NEW_REQUEST_CLAUDE' })).persona, 'claude')
})
test('pending picker switch does not redirect tools; manual remember follows pending selection', async t => {
  const f = fixture(t), a = f.agent('deepseek-official', 'deepseek-chat')
  await f.assemble(a)
  f.pending.set(a.session, { provider: 'gateway', model: 'gpt-6-astra' })
  assert.equal((await f.edit(a, { action: 'append', category: 'memory', text: 'WHALE_CURRENT' })).persona, 'deepseek')
  const command = f.commands.get('remember').handler({ agent: a, rawInput: 'DRAGON_NEXT' })
  assert.equal(command.kind, 'success')
  assert.match(readFileSync(join(f.config.personasDir, 'gpt/90-记忆.md'), 'utf8'), /DRAGON_NEXT/)
  assert.doesNotMatch(await f.assemble(a), /DRAGON_NEXT/)
})
test('models action returns real provider IDs, model IDs and mixed-family classifications', async t => {
  const f = fixture(t), a = f.agent()
  const result = await f.manage(a, { action: 'models' })
  assert.match(result.text, /Codex \(local login\) \[provider=codex-local\]/)
  assert.match(result.text, /gpt-6-astra\] → gpt/)
  assert.match(result.text, /claude-sonnet-4-5\] → claude/)
  assert.match(result.text, /google\/gemma-3\] → 未绑定/)
  assert.equal(f.modelCalls(), 2)
  const filtered = await f.manage(a, { action: 'models', provider: 'codex-local' })
  assert.doesNotMatch(filtered.text, /provider=openrouter/)
  assert.equal(f.modelCalls(), 3)
})
test('read, replace and delete support conversational editing of current and explicit roles', async t => {
  const f = fixture(t), a = f.agent('provider', 'gemini-2.5-flash')
  await f.assemble(a)
  await f.edit(a, { action: 'append', file: '45-custom.md', text: 'ORIGINAL_SETTING' })
  assert.match((await f.edit(a, { action: 'read', file: '45-custom.md' })).text, /ORIGINAL_SETTING/)
  await f.edit(a, { action: 'replace', file: '45-custom.md', oldText: 'ORIGINAL_SETTING', newText: 'NEW_SETTING' })
  assert.match(await f.assemble(a), /NEW_SETTING/)
  await f.edit(a, { action: 'append', persona: 'qwen', category: 'memory', text: 'EXPLICIT_QWEN_ONLY' })
  assert.doesNotMatch(await f.assemble(a), /EXPLICIT_QWEN_ONLY/)
  await f.edit(a, { action: 'delete', file: '45-custom.md' })
  assert.doesNotMatch(await f.assemble(a), /NEW_SETTING/)
  await assert.rejects(f.edit(a, { action: 'append', file: '../escape.md', text: 'NO' }))
})
test('existing DeepSeek and GPT user files survive sync and new families do not inherit them', async t => {
  const f = fixture(t)
  for (const directory of [f.config.personaDir, join(f.config.personasDir, 'gpt')]) {
    mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, '00-身份.md'), 'EXISTING_PRIVATE_CUSTOMIZATION')
  }
  const a = f.agent('deepseek-official', 'deepseek-chat')
  assert.match(await f.assemble(a), /EXISTING_PRIVATE_CUSTOMIZATION/)
  f.commands.get('persona').handler({ agent: a, rawInput: 'sync' })
  assert.match(readFileSync(join(f.config.personaDir, '00-身份.md'), 'utf8'), /EXISTING_PRIVATE_CUSTOMIZATION/)
  assert.match(await f.assemble(a, { provider: 'openai', model: 'gpt-6-astra' }), /EXISTING_PRIVATE_CUSTOMIZATION/)
  assert.doesNotMatch(await f.assemble(a, { provider: 'google', model: 'gemini-2.5-pro' }), /EXISTING_PRIVATE_CUSTOMIZATION/)
})
test('intentional default-file deletion stays deleted on sync', async t => {
  const f = fixture(t), a = f.agent('zai', 'glm-4.5')
  await f.assemble(a)
  await f.edit(a, { action: 'delete', file: '00-基础设定.md' })
  f.commands.get('persona').handler({ agent: a, rawInput: 'sync' })
  assert.equal(existsSync(join(f.config.personasDir, 'glm/00-基础设定.md')), false)
})
test('custom memoryFile and extraText remain DeepSeek-only; prompt bytes stable', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'kujira-memory-')); t.after(() => rmSync(dir, { recursive: true, force: true }))
  const memoryFile = join(dir, 'custom.md'), f = fixture(t, { memoryFile, extraText: 'WHALE_EXTRA_ONLY' }), a = f.agent('deepseek-official', 'deepseek-chat')
  const before = await f.assemble(a)
  assert.equal(await f.assemble(a), before)
  f.commands.get('remember').handler({ agent: a, rawInput: 'CUSTOM_PATH_MEMORY' })
  assert.match(readFileSync(memoryFile, 'utf8'), /CUSTOM_PATH_MEMORY/)
  assert.match(await f.assemble(a), /CUSTOM_PATH_MEMORY/)
  assert.doesNotMatch(await f.assemble(a, { provider: 'gateway', model: 'gpt-6' }), /CUSTOM_PATH_MEMORY|WHALE_EXTRA_ONLY/)
})
test('explicit mappings override builtins; none stays a deliberately empty persona', async t => {
  const f = fixture(t, { modelRules: [{ provider: 'relay', model: 'prod.*', persona: 'qwen' }, { model: 'gpt-*', persona: 'none' }] })
  assert.match(await f.assemble(f.agent('relay', 'prod.v2')), /人设层：Qwen/)
  assert.doesNotMatch(await f.assemble(f.agent('relay', 'prodXv2')), /## 人设层：/)
  assert.doesNotMatch(await f.assemble(f.agent('openai', 'gpt-6')), /## 人设层：/)
})
test('disabled write setting removes both persona tools; manual remember remains', async t => {
  const f = fixture(t, { allowAgentWrite: false }), a = f.agent()
  assert.equal(f.tools.size, 0)
  const body = await f.assemble(a)
  assert.doesNotMatch(body, /用户明确要求新增角色|用 persona_edit/)
  assert.equal(f.commands.get('remember').handler({ agent: a, rawInput: 'MANUAL' }).kind, 'success')
})
test('disabled plugin leaves host untouched', t => {
  const f = fixture(t, { enabled: false })
  assert.equal(f.hooks.length, 0); assert.equal(f.sections.length, 0); assert.equal(f.tools.size, 0); assert.equal(f.commands.size, 0)
})
test('installed Chinese and English plugin descriptions explain dialogue and custom roles', () => {
  const p = JSON.parse(readFileSync(join(ROOT, 'package.json')))
  assert.equal(p.exports['./package.json'], './package.json')
  for (const language of ['zh', 'en']) {
    const meta = JSON.parse(readFileSync(join(ROOT, `locale/${language}.json`))).meta
    assert.match(meta.description, /persona_edit/); assert.match(meta.description, /persona_manage/)
    assert.match(meta.description, /codex-local/); assert.match(meta.description, /openai-codex/)
  }
  assert.match(JSON.parse(readFileSync(join(ROOT, 'locale/zh.json'))).meta.description, /通过对话修改/)
})
