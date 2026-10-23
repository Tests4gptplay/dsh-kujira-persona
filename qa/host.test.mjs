import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
const plugin = await import(pathToFileURL(join(process.env.SOURCE_DIR, 'index.js')))
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'kujira16-host-')), ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime, { mode: 'native' })
  ctx.systemPrompt.variable('provider', () => 'stale')
  ctx.systemPrompt.variable('model', () => 'deepseek-stale')
  ctx.systemPrompt.section({ name: 'host:preserve', order: 42, text: 'UNCHANGED_HOST_SECTION' })
  ctx.systemPrompt.context({ name: 'host:context', order: 42, text: 'UNCHANGED_CONTEXT' })
  ctx.tools.register({ name: 'ordinary_tool', description: 'unrelated host tool', parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }, render: () => [{ type: 'text', text: 'HOST_TOOL_OK' }] }, execute: async () => ({ ok: true }) })
  const config = { personaDir: join(dir, 'persona'), personasDir: join(dir, 'personas'), worldDir: join(dir, 'world') }
  const fork = ctx.plugin(plugin, config); await fork
  function agent(id, model = 'gpt-4o') {
    const a = { id, options: { provider: 'mixed', model }, header: null }
    a.session = { requestHeader: () => a.header }
    a.ctx = createScope(ctx, a).ctx
    const selection = { current: a.options, assembled: undefined }
    installModelSelection(a.ctx, selection)
    return { agent: a, selection }
  }
  let count = 0
  async function assemble(a) {
    const v = await ctx.systemPrompt.assemble({ agent: a.agent, scope: a.agent })
    a.agent.header = { config: { provider: v.variables.provider, model: v.variables.model } }
    assert.equal(v.sections.find(s => s.name === 'host:preserve').text, 'UNCHANGED_HOST_SECTION')
    assert.equal(v.contexts.find(s => s.name === 'host:context').text, 'UNCHANGED_CONTEXT')
    return v
  }
  const exec = (a, name, args) => ctx.tools.execute({ callId: `qa-${++count}`, name, arguments: args, agent: a.agent, signal: new AbortController().signal })
  t.after(async () => { await ctx.fiber.dispose(); rmSync(dir, { recursive: true, force: true }) })
  return { ctx, dir, config, fork, agent, assemble, exec }
}
const part = (v, name) => v.sections.find(s => s.name === name)?.text ?? ''
test('real host includes shared world and loaded README without overriding model selection', async t => {
  const h = await fixture(t), a = h.agent('a'); const v = await h.assemble(a)
  assert.equal(v.variables.model, 'gpt-4o'); assert.match(part(v, 'whale:persona'), /当前角色：GPT/)
  assert.match(part(v, 'whale:world'), /档案更新与静默刷新/)
  assert.deepEqual(v.tools.map(x => x.name).sort(), ['ordinary_tool','persona_edit','persona_manage'])
})
test('real DSH tool writes world, refreshes cache and preserves private memory isolation', async t => {
  const h = await fixture(t), a = h.agent('a'), b = h.agent('b', 'deepseek-chat')
  await h.assemble(a); await h.assemble(b)
  const out = await h.exec(a, 'persona_edit', { action: 'append', scope: 'world', text: 'REAL_SHARED_RELATION' })
  assert.equal(out.isError, false, JSON.stringify(out)); assert.equal(out.value.cache_updated, true)
  assert.match(part(await h.assemble(b), 'whale:world'), /REAL_SHARED_RELATION/)
  const own = await h.exec(a, 'persona_edit', { action: 'append', category: 'memory', text: 'REAL_PRIVATE_MEMORY' })
  assert.equal(own.isError, false, JSON.stringify(own))
  const other = await h.assemble(b)
  assert.doesNotMatch(part(other, 'whale:persona') + part(other, 'whale:world'), /REAL_PRIVATE_MEMORY/)
  assert.equal((await h.exec(a, 'ordinary_tool', {})).isError, false)
})
test('real external-file reload updates world once and does not restart the host', async t => {
  const h = await fixture(t), a = h.agent('a'); await h.assemble(a)
  writeFileSync(join(h.config.worldDir, '45-external.md'), 'REAL_EXTERNAL_WORLD')
  assert.doesNotMatch(part(await h.assemble(a), 'whale:world'), /REAL_EXTERNAL_WORLD/)
  const out = await h.exec(a, 'persona_edit', { action: 'reload', scope: 'world' })
  assert.equal(out.isError, false, JSON.stringify(out)); assert.equal(out.value.cache_updated, true)
  assert.match(part(await h.assemble(a), 'whale:world'), /REAL_EXTERNAL_WORLD/)
  assert.equal((await h.exec(a, 'ordinary_tool', {})).isError, false)
})
test('real custom creation preserves private text and publishes only the role name', async t => {
  const h = await fixture(t), a = h.agent('unknown', 'company-model'); await h.assemble(a)
  const out = await h.exec(a, 'persona_manage', { action: 'create', persona: 'stella', name: '星璃', text: 'SECRET_ORIGINAL_BACKGROUND', use_current_model: true })
  assert.equal(out.isError, false, JSON.stringify(out))
  const v = await h.assemble(a)
  assert.match(part(v,'whale:persona'), /SECRET_ORIGINAL_BACKGROUND/)
  assert.match(part(v,'whale:world'), /星璃/); assert.doesNotMatch(part(v,'whale:world'), /SECRET_ORIGINAL_BACKGROUND/)
})
test('real host model changes mid-assembly still obey the captured request boundary', async t => {
  const h = await fixture(t), a = h.agent('racing', 'deepseek-chat')
  a.agent.ctx.on('system-prompt/assemble', async (_v, _c, next) => { a.selection.current = { provider: 'mixed', model: 'gpt-4o' }; return next() })
  const first = await h.assemble(a); assert.equal(first.variables.model, 'deepseek-chat'); assert.match(part(first,'whale:persona'), /当前角色：DeepSeek/)
  const second = await h.assemble(a); assert.equal(second.variables.model, 'gpt-4o'); assert.match(part(second,'whale:persona'), /当前角色：GPT/)
})
test('real concurrent conversations keep one common world and distinct personal identities', async t => {
  const h = await fixture(t), a = h.agent('a'), b = h.agent('b','claude-sonnet-4')
  const [x,y] = await Promise.all([h.assemble(a),h.assemble(b)])
  assert.equal(part(x,'whale:world'),part(y,'whale:world'))
  assert.match(part(x,'whale:persona'),/当前角色：GPT/); assert.match(part(y,'whale:persona'),/当前角色：Claude/)
})
test('real dispose/reload removes both sections and tools; saved world survives', async t => {
  const h = await fixture(t), a = h.agent('a'); await h.assemble(a)
  await h.exec(a,'persona_edit',{ action:'append',scope:'world',text:'PERSISTED_WORLD' })
  await h.fork.dispose()
  const without = await h.assemble(a)
  assert.deepEqual(without.tools.map(t=>t.name),['ordinary_tool'])
  assert.equal(without.sections.some(s=>s.name.startsWith('whale:')),false)
  const reloaded = h.ctx.plugin(plugin,h.config); await reloaded
  const again = await h.assemble(a)
  assert.equal(again.sections.filter(s=>s.name==='whale:world').length,1)
  assert.equal(again.sections.filter(s=>s.name==='whale:persona').length,1)
  assert.match(part(again,'whale:world'),/PERSISTED_WORLD/)
  await reloaded.dispose(); assert.equal((await h.exec(a,'ordinary_tool',{})).isError,false)
})
test('exclusive prompt owners are not overridden by either plugin section', async t => {
  const h = await fixture(t), a = h.agent('exclusive'); await h.assemble(a)
  await a.agent.ctx.plugin({ name:'exclusive-qa',inject:['systemPrompt'],apply(scope){ scope.systemPrompt.section({ name:'exclusive',order:0,complete:true,text:'EXCLUSIVE_ONLY' }) } })
  const v = await h.ctx.systemPrompt.assemble({ agent:a.agent,scope:a.agent })
  assert.deepEqual(v.sections.map(s=>s.text),['EXCLUSIVE_ONLY'])
})
