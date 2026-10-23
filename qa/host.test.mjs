import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createScope } from '@deepseek-ai/dsh-scope'
const plugin = await import(pathToFileURL(join(process.env.SOURCE_DIR, 'index.js')))

async function host(t) {
  const dir = mkdtempSync(join(tmpdir(), 'kujira-real-host-'))
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  ctx.systemPrompt.variable('provider', () => 'old-provider')
  ctx.systemPrompt.variable('model', () => 'deepseek-old-default')
  ctx.systemPrompt.section({ name: 'test:preserve', order: 42, text: 'HOST_INSTRUCTION_UNCHANGED' })
  ctx.systemPrompt.context({ name: 'test:context', order: 42, text: 'HOST_CONTEXT_UNCHANGED' })
  ctx.systemPrompt.tools(() => ({ schemas: [{ name: 'ordinary-tool', description: 'host tool', parameters: { type: 'object', properties: {} } }] }))
  await ctx.plugin(plugin, { personaDir: join(dir, 'legacy'), personasDir: join(dir, 'roles') })
  t.after(async () => { await ctx.fiber.dispose(); rmSync(dir, { recursive: true, force: true }) })
  function agent(id, provider, model) {
    const agent = { id, options: { provider: 'old-provider', model: 'deepseek-old-default' }, session: { requestHeader: () => undefined } }
    agent.ctx = createScope(ctx, agent).ctx
    const selection = { current: { provider, model }, assembled: undefined }
    installModelSelection(agent.ctx, selection)
    return { agent, selection }
  }
  async function assemble(a) {
    const value = await ctx.systemPrompt.assemble({ agent: a.agent, scope: a.agent })
    assert.equal(value.sections.find(s => s.name === 'test:preserve')?.text, 'HOST_INSTRUCTION_UNCHANGED')
    assert.equal(value.contexts.find(s => s.name === 'test:context')?.text, 'HOST_CONTEXT_UNCHANGED')
    assert.deepEqual(value.tools.map(t => t.name), ['ordinary-tool'])
    assert.equal(value.sections.filter(s => s.name === 'whale:persona').length, 1)
    return value
  }
  return { ctx, agent, assemble }
}

test('real DSH 0.2.1-rc.2 scoped selection overrides stale default before persona resolves', async t => {
  const h = await host(t), a = h.agent('gpt-session', 'gateway', 'gpt-6')
  const value = await h.assemble(a)
  assert.equal(value.variables.model, 'gpt-6')
  assert.match(value.sections.find(s => s.name === 'whale:persona').text, /人设层：GPT 白龙娘/)
  assert.match(renderPrompt(value), /HOST_INSTRUCTION_UNCHANGED/)
})

test('real DSH switches back and forth without registering another hook or section', async t => {
  const h = await host(t), a = h.agent('switching', 'deepseek-official', 'deepseek-chat')
  assert.match((await h.assemble(a)).sections.find(s => s.name === 'whale:persona').text, /人设层：DeepSeek 鲸鱼娘/)
  for (let i = 0; i < 25; i++) {
    a.selection.current = { provider: 'gateway', model: 'gpt-6' }
    assert.match((await h.assemble(a)).sections.find(s => s.name === 'whale:persona').text, /人设层：GPT 白龙娘/)
    a.selection.current = { provider: 'deepseek-official', model: 'deepseek-chat' }
    assert.match((await h.assemble(a)).sections.find(s => s.name === 'whale:persona').text, /人设层：DeepSeek 鲸鱼娘/)
  }
})

test('real DSH concurrent agents retain their own model and persona', async t => {
  const h = await host(t), whale = h.agent('whale', 'deepseek-account', 'deepseek-chat'), dragon = h.agent('dragon', 'codex-local', 'default')
  const [w, d] = await Promise.all([h.assemble(whale), h.assemble(dragon)])
  assert.match(w.sections.find(s => s.name === 'whale:persona').text, /人设层：DeepSeek 鲸鱼娘/)
  assert.match(d.sections.find(s => s.name === 'whale:persona').text, /人设层：GPT 白龙娘/)
  assert.equal(w.variables.provider, 'deepseek-account')
  assert.equal(d.variables.provider, 'codex-local')
})

test('real DSH snapshots selection even when picker changes during assembly', async t => {
  const h = await host(t), a = h.agent('racing', 'deepseek-official', 'deepseek-chat')
  a.agent.ctx.on('system-prompt/assemble', async (_value, _context, next) => {
    a.selection.current = { provider: 'gateway', model: 'gpt-6' }
    return next()
  })
  const first = await h.assemble(a)
  assert.equal(first.variables.model, 'deepseek-chat')
  assert.match(first.sections.find(s => s.name === 'whale:persona').text, /人设层：DeepSeek 鲸鱼娘/)
  const second = await h.assemble(a)
  assert.equal(second.variables.model, 'gpt-6')
  assert.match(second.sections.find(s => s.name === 'whale:persona').text, /人设层：GPT 白龙娘/)
})

test('real DSH complete-prompt ownership is not overridden', async t => {
  const h = await host(t), a = h.agent('complete', 'gateway', 'gpt-6')
  a.agent.ctx.systemPrompt.section({ name: 'test:complete', order: 0, complete: true, text: 'EXCLUSIVE_PROMPT' })
  const result = await h.ctx.systemPrompt.assemble({ agent: a.agent, scope: a.agent })
  assert.deepEqual(result.sections.map(s => s.text), ['EXCLUSIVE_PROMPT'])
})
