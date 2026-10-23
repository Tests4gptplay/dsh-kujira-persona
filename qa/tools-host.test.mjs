import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
const plugin = await import(pathToFileURL(join(process.env.SOURCE_DIR, 'index.js')))

async function fixture(t, model = 'gpt-6-astra') {
  const dir = mkdtempSync(join(tmpdir(), 'kujira-real-tools-15-')), ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose(); rmSync(dir, { recursive: true, force: true }) })
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime, { mode: 'native' })
  ctx.tools.register({ name: 'ordinary_tool', description: 'An unrelated existing tool', parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }, render: () => [{ type: 'text', text: 'HOST_TOOL_WORKS' }] }, execute: async () => ({ ok: true }) })
  const options = { provider: 'gateway', model }
  const agent = { id: 'tool-owner', options, session: { requestHeader: () => ({ config: options }) } }
  agent.ctx = createScope(ctx, agent).ctx
  const selection = { current: options, assembled: undefined }
  installModelSelection(agent.ctx, selection)
  const config = { personaDir: join(dir, 'legacy'), personasDir: join(dir, 'roles') }
  const fork = ctx.plugin(plugin, config); await fork
  const assemble = () => ctx.systemPrompt.assemble({ agent, scope: agent })
  let call = 0
  const execute = (name, args = {}) => ctx.tools.execute({ callId: `qa-call-${++call}`, name, arguments: args, agent, signal: new AbortController().signal })
  return { ctx, dir, fork, config, agent, options, selection, assemble, execute }
}

test('real ToolRuntime accepts both persona schemas, read/edit and unrelated host tools', async t => {
  const h = await fixture(t), assembly = await h.assemble()
  assert.deepEqual(assembly.tools.map(x => x.name).sort(), ['ordinary_tool', 'persona_edit', 'persona_manage'])
  assert.equal((await h.execute('ordinary_tool')).isError, false)
  const result = await h.execute('persona_edit', { action: 'append', category: 'memory', text: 'REAL_TOOL_MEMORY' })
  assert.equal(result.isError, false, JSON.stringify(result)); assert.equal(result.value.persona, 'gpt')
  const read = await h.execute('persona_edit', { action: 'read', file: '90-记忆.md' })
  assert.equal(read.isError, false, JSON.stringify(read)); assert.match(read.value.text, /REAL_TOOL_MEMORY/)
  const list = await h.execute('persona_manage', { action: 'list' })
  assert.equal(list.isError, false, JSON.stringify(list)); assert.match(list.value.text, /doubao/)
})

test('real tool pipeline can create a role, bind current model, then read/edit the persisted role', async t => {
  const h = await fixture(t, 'company-model-v1')
  await h.assemble()
  const created = await h.execute('persona_manage', { action: 'create', persona: 'stella', name: '星璃', text: 'REAL_CUSTOM_ROLE', use_current_model: true })
  assert.equal(created.isError, false, JSON.stringify(created))
  const next = await h.assemble()
  assert.match(next.sections.find(s => s.name === 'whale:persona').text, /REAL_CUSTOM_ROLE/)
  const edit = await h.execute('persona_edit', { action: 'append', category: 'memory', text: 'REAL_CUSTOM_MEMORY' })
  assert.equal(edit.isError, false, JSON.stringify(edit)); assert.equal(edit.value.persona, 'stella')
  assert.match(readFileSync(join(h.config.personasDir, 'stella/90-记忆.md'), 'utf8'), /REAL_CUSTOM_MEMORY/)
  assert.equal((await h.execute('ordinary_tool')).isError, false)
})

test('plugin disposal and reload remove both tools and preserve custom binding state', async t => {
  const h = await fixture(t)
  await h.assemble()
  await h.execute('persona_manage', { action: 'bind', persona: 'qwen', use_current_model: true })
  await h.fork.dispose()
  const without = await h.assemble()
  assert.deepEqual(without.tools.map(x => x.name), ['ordinary_tool'])
  assert.equal(without.sections.some(x => x.name === 'whale:persona'), false)
  const reloaded = h.ctx.plugin(plugin, h.config); await reloaded
  const again = await h.assemble()
  assert.equal(again.sections.filter(x => x.name === 'whale:persona').length, 1)
  assert.match(again.sections.find(s => s.name === 'whale:persona').text, /人设层：Qwen/)
  assert.deepEqual(again.tools.map(x => x.name).sort(), ['ordinary_tool', 'persona_edit', 'persona_manage'])
  await reloaded.dispose()
  assert.deepEqual((await h.assemble()).tools.map(x => x.name), ['ordinary_tool'])
})
