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

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'kujira-real-tools-'))
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose(); rmSync(dir, { recursive: true, force: true }) })
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime, { mode: 'native' })
  ctx.tools.register({
    name: 'ordinary_tool', description: 'An unrelated existing tool',
    parameters: { type: 'object', properties: {} },
    output: { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }, render: () => [{ type: 'text', text: 'HOST_TOOL_WORKS' }] },
    execute: async () => ({ ok: true }),
  })
  const options = { provider: 'gateway', model: 'gpt-6' }
  const agent = { id: 'tool-owner', options, session: { requestHeader: () => ({ config: options }) } }
  agent.ctx = createScope(ctx, agent).ctx
  const selection = { current: options, assembled: undefined }
  installModelSelection(agent.ctx, selection)
  const config = { personaDir: join(dir, 'legacy'), personasDir: join(dir, 'roles') }
  const fork = ctx.plugin(plugin, config)
  await fork
  const assemble = () => ctx.systemPrompt.assemble({ agent, scope: agent })
  let call = 0
  const execute = (name, args = {}) => ctx.tools.execute({ callId: `qa-call-${++call}`, name, arguments: args, agent, signal: new AbortController().signal })
  return { ctx, dir, fork, config, agent, assemble, execute }
}

test('real DSH ToolRuntime accepts persona_edit and existing tools still execute', async t => {
  const h = await fixture(t)
  const assembly = await h.assemble()
  assert.deepEqual(assembly.tools.map(x => x.name).sort(), ['ordinary_tool', 'persona_edit'])
  const normal = await h.execute('ordinary_tool')
  assert.equal(normal.isError, false, JSON.stringify(normal))
  assert.deepEqual(normal.value, { ok: true })
  const result = await h.execute('persona_edit', { action: 'append', category: 'memory', text: 'REAL_TOOL_PIPELINE_MEMORY' })
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.equal(result.value.persona, 'gpt')
  assert.match(readFileSync(join(h.config.personasDir, 'gpt/90-记忆.md'), 'utf8'), /REAL_TOOL_PIPELINE_MEMORY/)
  const list = await h.execute('persona_edit', { action: 'list' })
  assert.equal(list.isError, false, JSON.stringify(list))
  assert.ok(list.value.files.length >= 5)
  assert.equal((await h.execute('ordinary_tool')).isError, false)
})

test('real DSH plugin disposal and reload leave no stale persona tool or section', async t => {
  const h = await fixture(t)
  await h.assemble()
  await h.fork.dispose()
  const without = await h.assemble()
  assert.deepEqual(without.tools.map(x => x.name), ['ordinary_tool'])
  assert.equal(without.sections.some(x => x.name === 'whale:persona'), false)
  assert.equal((await h.execute('ordinary_tool')).isError, false)
  const reloaded = h.ctx.plugin(plugin, h.config)
  await reloaded
  const again = await h.assemble()
  assert.equal(again.sections.filter(x => x.name === 'whale:persona').length, 1)
  assert.deepEqual(again.tools.map(x => x.name).sort(), ['ordinary_tool', 'persona_edit'])
  await reloaded.dispose()
  assert.deepEqual((await h.assemble()).tools.map(x => x.name), ['ordinary_tool'])
})
