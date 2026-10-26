/** Diary prompt/tool wiring only. Does not rewrite chat history or start model requests. */
export const DIARY_SECTION = 'whale:diary'

const copyEntry = entry => entry ? { id: entry.id, label: entry.label } : null

export function applyDiaryIntegration(ctx, { diary, requests, forInvocation }) {
  let disposed = false
  const cleanups = new Set()
  const warn = error => { try { ctx.logger?.warn?.('Kujira AI 日记暂不可用：' + (error?.message ?? String(error))) } catch {} }
  // Handle initialization even when the optional tools service is absent.
  const readiness = diary.ready.then(() => true, error => { warn(error); return false })

  ctx.systemPrompt.section({ name: DIARY_SECTION, order: 2, interpolate: false, text: '' })
  // Registered after the persona listener with prepend: the inner listener finishes
  // resolving/capturing this assembly's role before its diary is read here.
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    let text = ''
    try {
      if (await readiness && !disposed && diary.settings().enabled && context.agent) {
        const captured = requests.get(context.agent)
        const entry = captured ? copyEntry(captured.entry) : copyEntry((await forInvocation(context.agent, false)).entry)
        if (entry) text = await diary.context(entry)
      }
    } catch (error) { warn(error) }
    // A setting may have changed during I/O. Never put newly disabled content back.
    if (disposed || !diary.settings().enabled) text = ''
    return { ...assembled, sections: assembled.sections.map(section => section.name === DIARY_SECTION
      ? { ...section, text, interpolate: false } : section) }
  }, { global: true, prepend: true })

  ctx.inject(['tools'], scope => {
    let closed = false, release = null
    function removeTool() { const stop = release; release = null; stop?.() }
    function update() {
      if (closed || disposed || !diary.settings().enabled) { removeTool(); return }
      if (release) return
      const lifetime = { active: true }
      const requireActive = () => {
        if (!lifetime.active || closed || disposed || !diary.settings().enabled) throw new Error('AI 写日记已关闭或该工具调用已失效；原日记文件保留')
      }
      try {
        const unregister = scope.tools.register({
          name: 'ai_diary',
          description: '当前角色自己的 Diary.md 详细日记与 Persona_diary.md 个性摘要。主动决定写作时机和内容；read 按需读取自己的两份记录。append 必须同时提供正文 text 和立即整理好的完整简短 summary，先写详细日记再覆盖摘要；update_summary 可独立修订、删减或清空自己的摘要。摘要待补时只用 update_summary 恢复，不重复 append。不能指定其它角色或任意路径。',
          parameters: { type: 'object', properties: {
            action: { type: 'string', enum: ['read', 'append', 'update_summary'] },
            text: { type: 'string', description: 'append 时由当前角色自行选择的详细 Diary 正文，形式与篇幅自由。' },
            summary: { type: 'string', description: 'append 或 update_summary 必填：完整而简短的 Persona_diary 摘要；覆盖旧摘要，可删减、更正，空字符串表示清空。' },
          }, required: ['action'], additionalProperties: false },
          output: { schema: { type: 'object', properties: {
            action: { type: 'string', enum: ['read', 'append', 'update_summary'] }, owner: { type: 'string' }, label: { type: 'string' },
            text: { type: 'string' }, summary: { type: 'string' }, written: { type: 'boolean' }, time: { type: 'string' },
            summary_updated: { type: 'boolean' }, summary_pending: { type: 'boolean' }, status: { type: 'string' }, recovery_saved: { type: 'boolean' }, note: { type: 'string' },
          }, required: ['action', 'owner', 'label'] },
          render(_args, value) { return [{ type: 'text', text: value.action === 'read'
            ? `${value.label}自己的 Diary.md\n${value.text || '（详细日记为空）'}\n\nPersona_diary.md\n${value.summary || '（摘要为空）'}${value.summary_pending ? '\n\n摘要待补，请用 update_summary 整理，不重复 append。' : ''}`
            : value.status === 'summary_pending' ? value.note : value.action === 'update_summary' ? `${value.label}的 Persona_diary 摘要已更新。` : `${value.label}的 Diary 已写入，Persona_diary 摘要已立即更新。` }] } },
          async execute(args, exec) {
            requireActive()
            if (!exec?.agent) throw new Error('ai_diary 需要所属会话')
            if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !['action', 'text', 'summary'].includes(key)) || !['read', 'append', 'update_summary'].includes(args.action)) throw new Error('日记工具只接受 read/append/update_summary、正文与摘要，不接受角色或路径参数')
            // Capture BEFORE any await: model switches in another session or a later
            // assembly must not retarget a tool that has already started.
            const captured = requests.get(exec.agent)
            const entry = captured ? copyEntry(captured.entry) : copyEntry((await forInvocation(exec.agent, false)).entry)
            requireActive()
            if (!entry) throw new Error('当前请求未绑定角色，不能读取或写入日记')
            const result = args.action === 'read' ? await diary.readOwn(entry) : args.action === 'update_summary' ? await diary.updateSummary(entry, args.summary) : await diary.appendOwn(entry, args.text, args.summary)
            return { action: args.action, ...result }
          },
        })
        release = () => { lifetime.active = false; unregister?.() }
      } catch (error) { lifetime.active = false; warn(error) }
    }
    const unsubscribe = diary.subscribe(update)
    const cleanup = () => { if (closed) return; closed = true; unsubscribe(); removeTool(); cleanups.delete(cleanup) }
    cleanups.add(cleanup)
    scope.on('dispose', cleanup)
    // This is initialization, not a poll or a request-generating continuation.
    readiness.then(ready => { if (ready) update() }).catch(warn)
  })
  const dispose = () => { if (disposed) return; disposed = true; for (const cleanup of [...cleanups]) cleanup() }
  ctx.on('dispose', dispose)
  return { dispose }
}
