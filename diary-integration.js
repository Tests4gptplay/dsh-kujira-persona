/** Diary prompt/tool wiring only. Does not rewrite chat history or start model requests. */
export const DIARY_SECTION = 'whale:diary'

const copyEntry = entry => entry ? { id: entry.id, label: entry.label } : null
const actionKeys = {
  read: ['action', 'date', 'kind', 'start_line', 'end_line', 'start_column', 'max_chars', 'full'],
  search: ['action', 'query', 'date', 'cursor', 'start_line', 'start_column', 'max_results'],
  append: ['action', 'text', 'summary'],
  update_summary: ['action', 'summary'],
}
function renderResult(value) {
  if(value.action==='search')return `${value.label}自己的日记搜索\n${value.matches.length?value.matches.map(m=>`${m.date??'legacy'} / ${m.kind??'long'} L${m.line}:C${m.column}${m.source_file?'（源 '+m.source_file+' L'+m.source_line+'）':''} ${m.excerpt}`).join('\n'):'无命中。'}\n${value.has_more?value.next_cursor?`还有命中：保持 query，使用 cursor=${value.next_cursor} 继续。`:`还有命中：保持 query，使用 start_line=${value.next_start_line}、start_column=${value.next_start_column} 继续。`:'本次搜索已到末尾。'}`
  if(value.action==='read')return `${value.label}自己的 ${value.date??'legacy'} / ${value.kind??'long'}${value.full?'（明确请求的完整读取）':''}\n${value.text||'（此范围没有正文）'}\n${value.has_more?`继续：date=${value.date??'legacy'} kind=${value.kind??'long'} start_line=${value.next_start_line}、start_column=${value.next_start_column}`:'已到正文末尾。'}\n\n最新简短摘要\n${value.summary||'（摘要为空）'}${value.summary_pending?'\n摘要待立即合并：'+JSON.stringify(value.pending_summaries??[]):''}`
  if(value.status==='summary_pending')return `${value.note}\n最新 summary：${value.summary??''}\npending_summaries=${JSON.stringify(value.pending_summaries??[])}`
  return `${value.label}的${value.date??''}长日记/短摘要已保存。`
}

export function applyDiaryIntegration(ctx, { diary, requests, forInvocation }) {
  let disposed = false
  const basisByAgent = new WeakMap()
  const cleanups = new Set()
  const warn = error => { try { ctx.logger?.warn?.('Kujira AI 日记暂不可用：' + (error?.message ?? String(error))) } catch {} }
  // Handle initialization even when the optional tools service is absent.
  const readiness = diary.ready.catch(warn)

  ctx.systemPrompt.section({ name: DIARY_SECTION, order: 2, interpolate: false, text: '' })
  // Registered after the persona listener with prepend: the inner listener finishes
  // resolving/capturing this assembly's role before its diary is read here.
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    let text = ''
    try {
      await readiness
      if (!disposed && diary.settings().enabled && context.agent) {
        const captured = requests.get(context.agent)
        const entry = captured ? copyEntry(captured.entry) : copyEntry((await forInvocation(context.agent, false)).entry)
        if (entry) {
          if (diary.contextSnapshot) { const value = await diary.contextSnapshot(entry); text = value.text; basisByAgent.set(context.agent, value.summary_pending && basisByAgent.get(context.agent) !== value.basis ? null : value.basis) }
          else text = await diary.context(entry)
        }
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
          description: '当前角色按天续写的独立日记。任何会话同角色同一天共用同一本长/短日记。长写入必须立刻同时提交 summary，在当次写入时完成。summary_pending 表示正文已保存：立即合并返回的最新 summary 和 pending_summaries，再 update_summary，不重复 append。read 的 date 可用 YYYY-MM-DD 或 legacy，kind 为 long/short/sleep；search 按日期可选、使用返回 cursor 翻页。自主决定何时检索、写什么，不必每轮查阅。search 按区分大小写的单行字面关键词查找，默认返回 20 处非重叠命中的行列与短摘录，同一行也可按 next_start_line/next_start_column 翻页。read 默认最多 80 行、8000 个字符，按同样的行列游标继续展开；full:true 可明确读取完整正文。日期仅作为原文关键词。append 必须同时提供正文 text 和立即整理好的完整简短 summary；update_summary 独立覆盖、修订或清空摘要。摘要待补时只补 summary，不重复 append。不能指定其它角色或任意路径。',
          parameters: { type: 'object', properties: {
            action: { type: 'string', enum: ['read', 'search', 'append', 'update_summary'] },
            date: { type: 'string', description: 'read 默认今天，search 省略搜索全部；YYYY-MM-DD 或 legacy（未分日期的旧原文）。' },
            kind: { type: 'string', enum: ['long', 'short', 'sleep'], description: 'read 的文件类别，默认 long；检索结果会给出类别。' },
            cursor: { type: 'string', description: 'search 翻页：原样传回 next_cursor，保持 query/date。' },
            query: { type: 'string', description: 'search 必填：非空单行字面关键词，区分大小写，不是正则；日期可作普通文本查询。' },
            start_line: { type: 'integer', description: 'read/search 从第几行开始，默认 1。行号包含空行，从 1 起。' },
            end_line: { type: 'integer', description: 'read 的末行（包含）；省略则最多读取从 start_line 起的 80 行。' },
            start_column: { type: 'integer', description: 'read/search 起始行的 Unicode 字符列，从 1 起；续读时使用 next_start_column。' },
            max_chars: { type: 'integer', description: 'read 本次最多返回的 Unicode 字符数，默认 8000；换行计一个字符，仅为返回分页，不限制文件大小。' },
            max_results: { type: 'integer', description: 'search 本次最多返回多少处非重叠命中，默认 20。' },
            full: { type: 'boolean', description: '仅 read：true 明确读取全部正文；不能同时指定行、列或 max_chars。默认 false。' },
            text: { type: 'string', description: 'append 时由当前角色自行选择的详细 Diary 正文，形式与篇幅自由。' },
            summary: { type: 'string', description: 'append 或 update_summary 必填：完整而简短的日记摘要（Persona_diary）；只更新日记摘要，与原有 persona 档案并存、不替换它。可删减、更正，空字符串表示清空摘要。' },
          }, required: ['action'], additionalProperties: false },
          output: { schema: { type: 'object', properties: {
            action: { type: 'string', enum: ['read', 'search', 'append', 'update_summary'] }, owner: { type: 'string' }, label: { type: 'string' },
            date: { type: 'string' }, kind: { type: 'string' }, summary_date: { type: 'string' }, replayed: { type: 'boolean' },
            next_cursor: { oneOf: [{ type: 'string' }, { type: 'null' }] },
            pending_summaries: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, id: { type: 'string' }, text: { type: 'string' }, summary: { type: 'string' }, time: { type: 'string' } }, required: ['id','text','summary','time'] } },
            text: { type: 'string' }, summary: { type: 'string' }, written: { type: 'boolean' }, time: { type: 'string' },
            summary_updated: { type: 'boolean' }, summary_pending: { type: 'boolean' }, status: { type: 'string' }, recovery_saved: { type: 'boolean' }, note: { type: 'string' },
            query: { type: 'string' }, full: { type: 'boolean' }, start_line: { type: 'integer' }, start_column: { type: 'integer' },
            end_line: { oneOf: [{ type: 'integer' }, { type: 'null' }] }, end_column: { oneOf: [{ type: 'integer' }, { type: 'null' }] }, returned_chars: { type: 'integer' },
            total_lines: { type: 'integer' }, scanned_through_line: { type: 'integer' }, has_more: { type: 'boolean' },
            next_start_line: { oneOf: [{ type: 'integer' }, { type: 'null' }] }, next_start_column: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
            matches: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, kind: { type: 'string' }, source_file: { type: 'string' }, source_line: { type: 'integer' }, line: { type: 'integer' }, column: { type: 'integer' }, excerpt: { type: 'string' } }, required: ['line', 'column', 'excerpt'] } },
          }, required: ['action', 'owner', 'label'] },
          render(_args, value) { return [{ type: 'text', text: renderResult(value) }] } },
          async execute(args, exec) {
            requireActive()
            if (!exec?.agent) throw new Error('ai_diary 需要所属会话')
            if (!args || typeof args !== 'object' || Array.isArray(args) || !Object.hasOwn(actionKeys, args.action) || Object.keys(args).some(key => ['owner','role','roleId','path','file','directory'].includes(key))) throw new Error('日记工具只接受 read/search/append/update_summary 及该操作的参数，不接受角色或路径参数')
            // Capture BEFORE any await: model switches in another session or a later
            // assembly must not retarget a tool that has already started.
            const basis = basisByAgent.get(exec.agent) ?? null
            const captured = requests.get(exec.agent)
            const entry = captured ? copyEntry(captured.entry) : copyEntry((await forInvocation(exec.agent, false)).entry)
            requireActive()
            if (!entry) throw new Error('当前请求未绑定角色，不能读取或写入日记')
            const action = args.action
            const options = Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'action' && actionKeys[action].includes(key)))
            const result = action === 'read' ? await diary.readRangeOwn(entry, options) : action === 'search' ? await diary.searchOwn(entry, options) : action === 'update_summary' ? await diary.updateSummary(entry, args.summary, { basis }) : await diary.appendOwn(entry, args.text, args.summary, { basis, ...(exec.callId ? { operationId: `${exec.agent.id}:${exec.callId}` } : {}) })
            if (action !== 'search' && result.basis) basisByAgent.set(exec.agent, result.basis)
            if (action === 'read' || action === 'search') requireActive()
            const { basis: _internalBasis, ...visible } = result
            return { action: args.action, ...visible }
          },
        })
        release = () => { lifetime.active = false; unregister?.() }
      } catch (error) { lifetime.active = false; warn(error) }
    }
    const unsubscribe = diary.subscribe(update)
    const cleanup = () => { if (closed) return; closed = true; unsubscribe(); removeTool(); cleanups.delete(cleanup) }
    cleanups.add(cleanup)
    scope.effect(() => cleanup)
    // This is initialization, not a poll or a request-generating continuation.
    readiness.then(update).catch(warn)
  })
  const dispose = () => { if (disposed) return; disposed = true; for (const cleanup of [...cleanups]) cleanup() }
  ctx.effect(() => dispose)
  return { dispose }
}
