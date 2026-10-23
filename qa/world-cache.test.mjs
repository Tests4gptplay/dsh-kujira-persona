import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { join, resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
const ROOT = resolve(process.env.SOURCE_DIR)
const calls = { readFile: 0, readdir: 0, stat: 0, writeFile: 0, rename: 0, mkdir: 0, rm: 0 }
const original = {}
for (const name of Object.keys(calls)) {
  original[name] = fsp[name]
  fsp[name] = (...args) => { calls[name]++; return original[name](...args) }
}
syncBuiltinESMExports()
const { apply } = await import(pathToFileURL(join(ROOT, 'index.js')))
const { modelFamily, openCatalog } = await import(pathToFileURL(join(ROOT, 'catalog.js')))
const reset = () => { for (const key of Object.keys(calls)) calls[key] = 0 }
const noIO = () => assert.deepEqual(calls, { readFile: 0, readdir: 0, stat: 0, writeFile: 0, rename: 0, mkdir: 0, rm: 0 })
function fixture(t, extra = {}) {
  const root = fs.mkdtempSync(join(tmpdir(), 'kujira16-'))
  const config = { personaDir: join(root, 'persona'), personasDir: join(root, 'personas'), worldDir: join(root, 'world'), ...extra }
  const sections = [], hooks = [], tools = new Map(), commands = new Map(), pending = new WeakMap()
  let modelCalls = 0
  const context = {
    systemPrompt: { section: s => sections.push(s) },
    on: (event, handler) => hooks.push({ event, handler }),
    get: name => name === 'sessionProjections' ? { stateOf: s => ({ pending: pending.get(s) }) } : name === 'llm' ? {
      listProviders: () => [{ id: 'mixed', name: 'Many models' }],
      listModels: async () => { modelCalls++; return [{ id: 'gpt-4o', name: 'GPT' }, { id: 'claude-sonnet-4', name: 'Claude' }, { id: 'gemma-3', name: 'No preset' }] },
    } : undefined,
    inject: (_, callback) => callback({ tools: { register: v => tools.set(v.name, v) }, commands: { register: v => commands.set(v.name, v) } }),
  }
  apply(context, config)
  const agent = (model = 'gpt-4o', provider = 'mixed') => {
    const a = { options: { provider, model }, header: null }
    a.session = { requestHeader: () => a.header }
    return a
  }
  async function assemble(a, route = a.options) {
    const body = { sections: [{ name: 'host', text: 'KEEP_HOST' }, ...sections.map(s => ({ ...s }))], tools: [{ name: 'host' }], contexts: [{ text: 'HOST_CONTEXT' }], variables: { model: 'STALE' } }
    const output = await hooks[0].handler(body, { agent: a }, async () => ({ ...body, variables: { ...route } }))
    a.header = { config: { ...route } }
    assert.equal(output.tools, body.tools); assert.equal(output.contexts, body.contexts); assert.equal(output.sections[0], body.sections[0])
    return { world: output.sections.find(s => s.name === 'whale:world').text, persona: output.sections.find(s => s.name === 'whale:persona').text }
  }
  const edit = (a, args) => tools.get('persona_edit').execute(args, { agent: a })
  const manage = (a, args) => tools.get('persona_manage').execute(args, { agent: a })
  t.after(async () => { if (hooks.length) await assemble(agent()); await original.rm(root, { recursive: true, force: true }) })
  return { root, config, sections, hooks, tools, commands, pending, agent, assemble, edit, manage, modelCalls: () => modelCalls }
}

test('world contains the 11 public identities; private persona is only one role', async t => {
  const f = fixture(t), a = f.agent('deepseek-chat')
  const { world, persona } = await f.assemble(a)
  for (const id of ['deepseek','gpt','gemini','claude','grok','glm','kimi','qwen','minimax','llama','doubao']) assert.ok(world.includes(id), id)
  assert.match(persona, /当前角色：DeepSeek/)
  assert.doesNotMatch(persona, /## 当前角色：GPT/)
  assert.equal(fs.existsSync(join(f.config.personasDir, 'gpt')), false)
  assert.equal(f.hooks.length, 1); assert.equal(f.sections.length, 2)
  assert.equal(f.modelCalls(), 0)
})
test('the actual packaged instruction README is present in the prompt, not merely on GitHub', async t => {
  const f = fixture(t), a = f.agent()
  const { world } = await f.assemble(a)
  const guide = fs.readFileSync(join(ROOT, 'instructions/README.md'), 'utf8').trim()
  assert.ok(world.includes(guide))
  assert.match(guide, /外部|其他文件/); assert.match(guide, /不要再重复 reload/); assert.match(guide, /不要定时刷新/)
})
test('100 warm turns and same-family model version changes do exactly zero file operations', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a)
  reset()
  for (let i = 0; i < 100; i++) await f.assemble(a, { provider: i % 2 ? 'openai' : 'codex-local', model: i % 2 ? 'gpt-5.3-codex-spark' : 'gpt-4o', reasoningEffort: i % 2 ? 'high' : 'low' })
  noIO(); assert.equal(f.modelCalls(), 0)
})
test('switching back among already loaded roles performs zero disk reads', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a); await f.assemble(a, { provider: 'mixed', model: 'claude-sonnet-4' })
  reset()
  for (let i = 0; i < 25; i++) { await f.assemble(a); await f.assemble(a, { provider: 'mixed', model: 'claude-sonnet-4' }) }
  noIO()
})
test('unknown family retains world and instructions but does not gain a private persona', async t => {
  const f = fixture(t), a = f.agent('gemma-3', 'openai-codex')
  const value = await f.assemble(a)
  assert.equal(value.persona, ''); assert.match(value.world, /公开角色名录|大家认识/)
  assert.equal(fs.existsSync(f.config.personaDir), false)
  assert.equal(fs.existsSync(f.config.personasDir), false)
})
test('saving world by conversation updates all sessions immediately without a reload or scan', async t => {
  const f = fixture(t), a = f.agent(), b = f.agent('deepseek-chat'); await f.assemble(a); await f.assemble(b)
  reset()
  const out = await f.edit(a, { action: 'append', scope: 'world', category: 'world', text: 'SHARED_RELATION_UPDATE' })
  assert.equal(out.cache_updated, true); assert.equal(out.scope, 'world')
  assert.equal(calls.readdir, 0); assert.equal(calls.stat, 0); assert.equal(calls.readFile, 1)
  reset()
  assert.match((await f.assemble(a)).world, /SHARED_RELATION_UPDATE/)
  assert.match((await f.assemble(b)).world, /SHARED_RELATION_UPDATE/)
  assert.doesNotMatch((await f.assemble(b)).persona, /SHARED_RELATION_UPDATE/)
  noIO()
})
test('legacy category=world now targets global scope, not a character-private file', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a)
  const out = await f.edit(a, { action: 'append', category: 'world', text: 'GLOBAL_DEFAULT' })
  assert.equal(out.scope, 'world'); assert.equal(out.persona, 'world')
  assert.ok(out.path.startsWith(f.config.worldDir))
})
test('saving personal memory changes only that role; no rescan after saving', async t => {
  const f = fixture(t), a = f.agent(), b = f.agent('deepseek-chat'); await f.assemble(a); await f.assemble(b)
  await f.edit(a, { action: 'append', category: 'memory', text: 'PRIVATE_GPT_MEMORY' })
  reset()
  assert.match((await f.assemble(a)).persona, /PRIVATE_GPT_MEMORY/)
  assert.doesNotMatch((await f.assemble(b)).persona, /PRIVATE_GPT_MEMORY/)
  assert.doesNotMatch((await f.assemble(a)).world, /PRIVATE_GPT_MEMORY/)
  noIO()
})
test('external persona edits stay cached until one targeted reload; other roles are not scanned', async t => {
  const f = fixture(t), a = f.agent(), b = f.agent('deepseek-chat'); await f.assemble(a); await f.assemble(b)
  fs.writeFileSync(join(f.config.personasDir, 'gpt/45-external.md'), 'EXTERNAL_GPT_UPDATE')
  reset(); assert.doesNotMatch((await f.assemble(a)).persona, /EXTERNAL_GPT_UPDATE/); noIO()
  const reload = await f.edit(a, { action: 'reload' })
  assert.equal(reload.cache_updated, true); assert.equal(calls.readdir, 1)
  reset(); assert.match((await f.assemble(a)).persona, /EXTERNAL_GPT_UPDATE/)
  assert.doesNotMatch((await f.assemble(b)).persona, /EXTERNAL_GPT_UPDATE/); noIO()
})
test('external world edits become visible everywhere after one world reload, not every turn', async t => {
  const f = fixture(t), a = f.agent(), b = f.agent('gemini-2.5-pro'); await f.assemble(a); await f.assemble(b)
  fs.writeFileSync(join(f.config.worldDir, '40-external.md'), 'EXTERNAL_WORLD_UPDATE')
  assert.doesNotMatch((await f.assemble(a)).world, /EXTERNAL_WORLD_UPDATE/)
  reset(); await f.edit(a, { action: 'reload', scope: 'world' }); assert.equal(calls.readdir, 1)
  reset(); assert.match((await f.assemble(a)).world, /EXTERNAL_WORLD_UPDATE/); assert.match((await f.assemble(b)).world, /EXTERNAL_WORLD_UPDATE/); noIO()
})
test('binding creation updates registry cache automatically; current request stays its original role', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a)
  await f.manage(a, { action: 'bind', persona: 'claude', use_current_model: true })
  assert.equal((await f.edit(a, { action: 'append', category: 'memory', text: 'ORIGINATING_GPT_ONLY' })).persona, 'gpt')
  assert.match((await f.assemble(a)).persona, /当前角色：Claude/)
  assert.doesNotMatch((await f.assemble(a)).persona, /ORIGINATING_GPT_ONLY/)
  reset(); await f.assemble(a); noIO()
})
test('external bindings reload once, without polling', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a)
  fs.mkdirSync(f.config.personasDir, { recursive: true })
  fs.writeFileSync(join(f.config.personasDir, '.kujira-catalog.json'), JSON.stringify({ v: 1, personas: [], bindings: [{ model: 'gpt-*', persona: 'qwen' }] }))
  assert.match((await f.assemble(a)).persona, /当前角色：GPT/)
  await f.manage(a, { action: 'reload' }); assert.match((await f.assemble(a)).persona, /当前角色：Qwen/)
  reset(); await f.assemble(a); noIO()
})
test('custom names are public, custom private text is not automatically copied to world', async t => {
  const f = fixture(t), a = f.agent('private-model'); await f.assemble(a)
  await f.manage(a, { action: 'create', persona: 'stella', name: '星璃', text: 'PRIVATE_CUSTOM_BACKGROUND', use_current_model: true })
  const result = await f.assemble(a)
  assert.match(result.world, /星璃（stella）/)
  assert.doesNotMatch(result.world, /PRIVATE_CUSTOM_BACKGROUND/)
  assert.match(result.persona, /PRIVATE_CUSTOM_BACKGROUND/)
})
test('replace/delete/list/read update and consume snapshots without unnecessary rescans', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a)
  await f.edit(a, { action: 'append', file: '45-note.md', text: 'OLD_TEXT' })
  await f.edit(a, { action: 'replace', file: '45-note.md', oldText: 'OLD_TEXT', newText: 'NEW_TEXT' })
  reset(); assert.match((await f.edit(a, { action: 'read', file: '45-note.md' })).text, /NEW_TEXT/)
  await f.edit(a, { action: 'list' }); await f.assemble(a); noIO()
  await f.edit(a, { action: 'delete', file: '45-note.md' })
  assert.doesNotMatch((await f.assemble(a)).persona, /NEW_TEXT/)
})
test('concurrent edits to the same world file preserve both updates', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a)
  await Promise.all([f.edit(a, { action: 'append', scope: 'world', text: 'FIRST_PARALLEL' }), f.edit(a, { action: 'append', scope: 'world', text: 'SECOND_PARALLEL' })])
  const out = await f.assemble(a); assert.match(out.world, /FIRST_PARALLEL/); assert.match(out.world, /SECOND_PARALLEL/)
  assert.match(fs.readFileSync(join(f.config.worldDir, '95-自补-人设.md'), 'utf8'), /FIRST_PARALLEL[\s\S]*SECOND_PARALLEL/)
})
test('reload and edit scheduled together finish coherently without losing the saved change', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a)
  await Promise.all([f.edit(a, { action: 'reload', scope: 'world' }), f.edit(a, { action: 'append', scope: 'world', text: 'AFTER_RELOAD' })])
  assert.match((await f.assemble(a)).world, /AFTER_RELOAD/)
})
test('legacy private world files are preserved, not silently published to everybody', async t => {
  const dir = fs.mkdtempSync(join(tmpdir(), 'kujira-legacy-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.writeFileSync(join(dir, '96-自补-世界观.md'), 'LEGACY_PRIVATE_WORLD')
  const f = fixture(t, { personaDir: dir }), a = f.agent('deepseek-chat')
  const result = await f.assemble(a)
  assert.match(result.persona, /LEGACY_PRIVATE_WORLD/); assert.doesNotMatch(result.world, /LEGACY_PRIVATE_WORLD/)
  assert.equal(fs.readFileSync(join(dir, '96-自补-世界观.md'), 'utf8'), 'LEGACY_PRIVATE_WORLD')
})
test('global and persona manual commands support awaitable reload; pending remember remains isolated', async t => {
  const f = fixture(t), a = f.agent('deepseek-chat'); await f.assemble(a)
  f.pending.set(a.session, { provider: 'mixed', model: 'gpt-4o' })
  const result = await f.commands.get('remember').handler({ agent: a, rawInput: 'PENDING_GPT_MEMORY' })
  assert.equal(result.kind, 'success')
  assert.doesNotMatch((await f.assemble(a)).persona, /PENDING_GPT_MEMORY/)
  assert.equal((await f.commands.get('persona').handler({ agent: a, rawInput: 'world reload' })).kind, 'success')
  assert.equal((await f.commands.get('persona').handler({ agent: a, rawInput: 'reload' })).kind, 'success')
})
test('model listing is still on-demand and correctly separates gateway from family', async t => {
  const f = fixture(t), a = f.agent(); await f.assemble(a); assert.equal(f.modelCalls(), 0)
  const out = await f.manage(a, { action: 'models' }); assert.equal(f.modelCalls(), 1)
  assert.match(out.text, /gpt-4o\] → gpt/); assert.match(out.text, /claude-sonnet-4\] → claude/); assert.match(out.text, /gemma-3\] → 未绑定/)
})
test('old model family rules and explicit overrides are unchanged', async t => {
  for (const model of ['gpt-4o','gpt-6-astra','gpt-5.6-sol','codex-mini-latest','o3','openai/gpt-oss-120b']) assert.equal(modelFamily({ provider: 'relay', model }), 'gpt')
  for (const model of ['gemma-3','mistral-large','nova-pro']) assert.equal(modelFamily({ provider: 'openai', model }), 'none')
  const f = fixture(t, { modelRules: [{ model: 'gpt-*', persona: 'none' }] }), a = f.agent()
  assert.equal((await f.assemble(a)).persona, '')
})
test('no dialogue writing tools when disabled, yet world lore and manual memory remain usable', async t => {
  const f = fixture(t, { allowAgentWrite: false }), a = f.agent(); const result = await f.assemble(a)
  assert.equal(f.tools.size, 0); assert.match(result.world, /对话写入工具/)
  assert.doesNotMatch(result.world, /修改优先使用 persona_edit/)
  assert.equal((await f.commands.get('remember').handler({ agent: a, rawInput: 'MANUAL_ONLY' })).kind, 'success')
})
test('disabled plugin registers and reads nothing', t => {
  reset(); const f = fixture(t, { enabled: false }); assert.equal(f.hooks.length, 0); assert.equal(f.sections.length, 0); noIO()
})
test('package has no runtime loops, watchers, sync I/O or installation scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.version, '1.6.0'); assert.equal(pkg.scripts, undefined); assert.equal(pkg.dependencies, undefined)
  for (const file of ['index.js','catalog.js','dossier.js']) assert.doesNotMatch(fs.readFileSync(join(ROOT,file),'utf8'), /readFileSync|readdirSync|statSync|writeFileSync|setInterval\s*\(|setTimeout\s*\(|watchFile\s*\(|\bwatch\s*\(|child_process|node:test|node:assert/)
  for (const lang of ['zh','en']) assert.match(JSON.parse(fs.readFileSync(join(ROOT, `locale/${lang}.json`),'utf8')).meta.description, /README\.md/)
})
