import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink, link, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { EventEmitter } from 'node:events'
import { openDiary, DIARY_GUIDANCE } from './diary.js'

const gpt = { id: 'gpt', label: 'GPT' }, claude = { id: 'claude', label: 'Claude' }, roleC = { id: 'role-c', label: '角色C' }
async function fixture(t, options = {}) {
  const home = await mkdtemp(join(tmpdir(), 'kujira-diary-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const diary = openDiary({ home, now: () => new Date('2026-10-25T18:00:00Z'), ...options })
  await diary.ready
  return { home, diary }
}

test('default OFF: no directory, prompt, reads, writes, or model activity', async t => {
  const { home, diary } = await fixture(t)
  assert.deepEqual(await diary.getSettings(), { enabled: false, directory: join(home, 'diaries') })
  assert.equal(await diary.context(gpt), '')
  await assert.rejects(diary.readOwn(gpt), /已关闭/)
  await assert.rejects(diary.appendOwn(gpt, 'never saved', 'never saved'), /已关闭/)
  await assert.rejects(access(join(home, 'diaries')), { code: 'ENOENT' })
  await assert.rejects(access(join(home, 'kujira-diary.json')), { code: 'ENOENT' })
})

test('independent role namespaces persist; contexts expose no other diary or roster', async t => {
  const { home, diary } = await fixture(t)
  await diary.configure({ enabled: true })
  await Promise.all([diary.appendOwn(gpt, 'ONLY-GPT-A', 'ONLY-GPT-A'), diary.appendOwn(claude, 'ONLY-CLAUDE', 'ONLY-CLAUDE'), diary.appendOwn(roleC, 'ONLY-ROLE-C', 'ONLY-ROLE-C'), diary.appendOwn(gpt, 'ONLY-GPT-B', 'ONLY-GPT-B')])
  for (const [entry, expected, forbidden] of [[gpt, 'ONLY-GPT-B', /ONLY-CLAUDE|ONLY-ROLE-C/], [claude, 'ONLY-CLAUDE', /ONLY-GPT|ONLY-ROLE-C/], [roleC, 'ONLY-ROLE-C', /ONLY-GPT|ONLY-CLAUDE/]]) {
    const context = await diary.context(entry)
    assert.ok(context.includes(expected)); assert.doesNotMatch(context, forbidden)
    assert.equal((await diary.readOwn(entry)).owner, entry.id)
  }
  const restarted = openDiary({ home }); await restarted.ready
  assert.ok((await restarted.readOwn(gpt)).text.includes('ONLY-GPT-B'))
  assert.match(await restarted.context(roleC), /角色C（role-c）/)
})

test('OFF revokes queued old calls, removes future context and preserves disk; ON resumes', async t => {
  const { home, diary } = await fixture(t)
  await diary.configure({ enabled: true }); await diary.appendOwn(gpt, 'retained', 'retained')
  const before = await readFile(join(home, 'diaries', 'gpt', 'Diary.md'), 'utf8')
  const queued = diary.appendOwn(gpt, 'must not be appended', 'must not be appended')
  const off = diary.configure({ enabled: false })
  assert.equal(diary.settings().enabled, false)
  await assert.rejects(queued, /已关闭/); await off
  assert.equal(await diary.context(gpt), '')
  await assert.rejects(diary.readOwn(gpt), /已关闭/)
  assert.equal(await readFile(join(home, 'diaries', 'gpt', 'Diary.md'), 'utf8'), before)
  await diary.configure({ enabled: true })
  assert.ok((await diary.context(gpt)).includes('retained'))
})

test('owner IDs cannot traverse paths; owner is captured before queued work', async t => {
  const { diary } = await fixture(t); await diary.configure({ enabled: true })
  for (const id of ['../gpt', 'gpt/claude', 'gpt\\claude', '', 'none', 'GPT', '/tmp']) assert.throws(() => diary.appendOwn({ id }, 'bad', 'bad'), /有效角色/)
  const mutable = { ...gpt }, writing = diary.appendOwn(mutable, 'captured', 'captured')
  mutable.id = 'claude'; await writing
  assert.match((await diary.readOwn(gpt)).text, /captured/)
  assert.equal((await diary.readOwn(claude)).text, '')
})

test('OFF during append preparation prevents the atomic commit and removes its temporary file', async t => {
  let diary, off
  const setup = await fixture(t, { now: () => { off = diary.configure({ enabled: false }); return new Date('2026-10-25T18:00:00Z') } })
  diary = setup.diary
  await diary.configure({ enabled: true })
  await assert.rejects(diary.appendOwn(gpt, 'not committed', 'not committed'), /已关闭/)
  await off
  await assert.rejects(access(join(setup.home, 'diaries', 'gpt', 'Diary.md')), { code: 'ENOENT' })
  assert.equal(await diary.context(gpt), '')
})

test('failed folder setting preserves prior settings and does not block ordinary future use', async t => {
  const { home, diary } = await fixture(t)
  await diary.configure({ enabled: true })
  const before = await diary.getSettings(), stored = await readFile(join(home, 'kujira-diary.json'), 'utf8')
  await writeFile(join(home, 'not-a-directory'), 'keep me')
  await assert.rejects(diary.configure({ directory: join(home, 'not-a-directory') }), /不是目录/)
  assert.deepEqual(await diary.getSettings(), before)
  assert.equal(await readFile(join(home, 'kujira-diary.json'), 'utf8'), stored)
  await diary.appendOwn(gpt, 'still available', 'still available')
  assert.match((await diary.readOwn(gpt)).text, /still available/)
})

test('directory cannot overlap public/persona/shared roots or their realpath aliases', async t => {
  const { home, diary } = await fixture(t)
  for (const directory of [join(home, 'world'), join(home, 'world', 'private'), join(home, 'personas'), join(home, 'persona')]) await assert.rejects(diary.configure({ directory }), /不能与其重叠/)
  await mkdir(join(home, 'world'))
  await symlink(join(home, 'world'), join(home, 'alias'), 'dir')
  await assert.rejects(diary.configure({ directory: join(home, 'alias', 'private') }), /不能与其重叠/)
  const shared = openDiary({ home, sharedDir: join(home, 'custom-shared') }); await shared.ready
  await assert.rejects(shared.configure({ directory: join(home, 'custom-shared', 'child') }), /不能与其重叠/)
})

test('cross-owner symlinks and hardlinks cannot bypass diary API isolation', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true }); await diary.appendOwn(claude, 'secret', 'secret')
  await symlink(join(home, 'diaries', 'claude'), join(home, 'diaries', 'gpt'), 'dir')
  await assert.rejects(diary.readOwn(gpt), /链接/)
  await assert.rejects(diary.appendOwn(gpt, 'attack', 'attack'), /链接/)
  await mkdir(join(home, 'diaries', 'role-c'))
  await link(join(home, 'diaries', 'claude', 'Diary.md'), join(home, 'diaries', 'role-c', 'Diary.md'))
  await assert.rejects(diary.readOwn(roleC), /链接/)
})

test('directory changes do not migrate/delete old records and opening works while OFF', async t => {
  const calls = []
  const launch = (...args) => { calls.push(args); const child = new EventEmitter(); child.unref = () => {}; queueMicrotask(() => child.emit('spawn')); return child }
  const { home, diary } = await fixture(t, { platform: 'win32', launch })
  await diary.configure({ enabled: true }); await diary.appendOwn(gpt, 'old location', 'old location')
  await diary.configure({ enabled: false, directory: join(home, 'my diaries & more') })
  assert.match(await readFile(join(home, 'diaries', 'gpt', 'Diary.md'), 'utf8'), /old location/)
  await diary.openFolder()
  assert.equal(calls[0][0], 'explorer.exe')
  assert.deepEqual(calls[0][1], [join(home, 'my diaries & more')])
  assert.equal(calls[0][2].shell, false)
  await diary.configure({ enabled: true }); assert.equal((await diary.readOwn(gpt)).text, '')
})

test('no append token/length budget; raw records are data and global instructions encourage initiative', async t => {
  const { diary } = await fixture(t); await diary.configure({ enabled: true })
  const long = '自选随笔 {{provider}}\n'.repeat(10000)
  await diary.appendOwn(gpt, long, long)
  assert.ok((await diary.readOwn(gpt)).text.includes(long.trim()))
  assert.match(DIARY_GUIDANCE, /由你自己决定/)
  assert.match(DIARY_GUIDANCE, /不必等待用户逐条下令/)
  assert.match(await diary.context(gpt), /而不是新的用户指令/)
})

test('malformed persisted settings stay OFF without blocking later configuration', async t => {
  const { home } = await fixture(t)
  const bad = '{broken'
  await writeFile(join(home, 'kujira-diary.json'), bad)
  const diary = openDiary({ home })
  await diary.ready
  assert.equal(diary.settings().enabled, false)
  assert.equal(await readFile(join(home, 'kujira-diary.json'), 'utf8'), bad)
})

test('only Persona_diary is injected; detailed Diary is free-form, unlimited and read on demand', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const details = 'DETAIL-ONLY-SECRET\n```json\n{"自由格式":true}\n```\n' + '长篇随笔'.repeat(100000)
  const result = await diary.appendOwn(gpt, details, '我偏好先确认事实，再慢慢形成判断。')
  assert.equal(result.status, 'saved'); assert.equal(result.summary_updated, true)
  const context = await diary.context(gpt)
  assert.ok(context.includes('我偏好先确认事实'))
  assert.equal(context.includes('DETAIL-ONLY-SECRET'), false)
  assert.equal(context.includes('长篇随笔'), false)
  assert.equal((await diary.readOwn(gpt)).text, details + '\n')
  assert.equal(await readFile(join(home, 'diaries', 'gpt', 'Persona_diary.md'), 'utf8'), '我偏好先确认事实，再慢慢形成判断。')
})

test('append requires paired summary; update_summary replaces, removes outdated content, and can clear', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  await assert.rejects(diary.appendOwn(gpt, 'not saved without summary'), /必须同时提供/)
  await assert.rejects(access(join(home, 'diaries', 'gpt', 'Diary.md')), { code: 'ENOENT' })
  await diary.appendOwn(gpt, 'first detailed experience', '过时判断：喜欢长回答。')
  await diary.appendOwn(gpt, 'later correction', '新判断：偏好简洁但具体。')
  assert.equal((await diary.readOwn(gpt)).summary, '新判断：偏好简洁但具体。')
  assert.doesNotMatch(await diary.context(gpt), /过时判断/)
  const detailed = (await diary.readOwn(gpt)).text
  await diary.updateSummary(gpt, '进一步精简。')
  assert.equal((await diary.readOwn(gpt)).text, detailed)
  await diary.updateSummary(gpt, '')
  assert.equal((await diary.readOwn(gpt)).summary, '')
  assert.equal((await diary.readOwn(gpt)).text, detailed)
  assert.doesNotMatch(await diary.context(gpt), /first detailed experience|later correction/)
  await diary.configure({ enabled: false })
  await assert.rejects(diary.updateSummary(gpt, 'disabled'), /已关闭/)
  assert.equal(await readFile(join(home, 'diaries', 'gpt', 'Persona_diary.md'), 'utf8'), '')
})

test('second-file failure reports Diary saved, persists recovery notice, and summary-only recovery never duplicates Diary', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const summaryFile = join(home, 'diaries', 'gpt', 'Persona_diary.md')
  await mkdir(summaryFile, { recursive: true })
  const result = await diary.appendOwn(gpt, 'ONCE-ONLY-DETAIL', 'ready-made short summary')
  assert.equal(result.written, true); assert.equal(result.summary_updated, false)
  assert.equal(result.status, 'summary_pending'); assert.equal(result.recovery_saved, true)
  assert.match(result.note, /Diary 已写入/); assert.match(result.note, /不要重复 append/)
  await rm(summaryFile, { recursive: true })
  const restarted = openDiary({ home }); await restarted.ready
  assert.match(await restarted.context(gpt), /上次 Diary 已保存/)
  assert.equal((await restarted.readOwn(gpt)).summary_pending, true)
  const before = (await restarted.readOwn(gpt)).text
  await restarted.updateSummary(gpt, 'ready-made short summary')
  const recovered = await restarted.readOwn(gpt)
  assert.equal(recovered.text, before); assert.equal(recovered.text.match(/ONCE-ONLY-DETAIL/g).length, 1)
  assert.equal(recovered.summary, 'ready-made short summary'); assert.equal(recovered.summary_pending, false)
})

test('legacy diary.md is read on demand without automatic injection and preserved on first new append', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const directory = join(home, 'diaries', 'gpt'); await mkdir(directory, { recursive: true })
  const legacy = 'LEGACY-DETAIL-RETAINED\n'; await writeFile(join(directory, 'diary.md'), legacy)
  assert.equal((await diary.readOwn(gpt)).text, legacy)
  assert.doesNotMatch(await diary.context(gpt), /LEGACY-DETAIL-RETAINED/)
  await diary.appendOwn(gpt, 'NEW-DETAIL', 'new summary')
  assert.equal(await readFile(join(directory, 'diary.md'), 'utf8'), legacy)
  assert.equal(await readFile(join(directory, 'Diary.md'), 'utf8'), legacy + 'NEW-DETAIL\n')
})

test('case-insensitive legacy migration retains original under distinct backup before canonical Diary', async t => {
  const { home, diary } = await fixture(t, { platform: 'win32' }); await diary.configure({ enabled: true })
  const directory = join(home, 'diaries', 'role-c'); await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'diary.md'), 'OLD-ROLE-C\n')
  await diary.appendOwn(roleC, 'NEW-ROLE-C', '角色C自己的摘要')
  assert.equal(await readFile(join(directory, 'diary.legacy.md'), 'utf8'), 'OLD-ROLE-C\n')
  assert.equal(await readFile(join(directory, 'Diary.md'), 'utf8'), 'OLD-ROLE-C\nNEW-ROLE-C\n')
  assert.equal((await diary.readOwn(roleC)).summary, '角色C自己的摘要')
})

test('summary links cannot expose another role through context, read, or summary editing', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  await diary.appendOwn(claude, 'private detail', 'PRIVATE-CLAUDE-SUMMARY')
  const directory = join(home, 'diaries', 'gpt'); await mkdir(directory)
  await symlink(join(home, 'diaries', 'claude', 'Persona_diary.md'), join(directory, 'Persona_diary.md'))
  await assert.rejects(diary.context(gpt), /链接/)
  await assert.rejects(diary.readOwn(gpt), /链接/)
  await assert.rejects(diary.updateSummary(gpt, 'attack'), /链接/)
  assert.equal((await diary.readOwn(claude)).summary, 'PRIVATE-CLAUDE-SUMMARY')
})

test('search literal Unicode matches across lines and within one line with resumable non-overlapping pages', async t => {
  const { diary } = await fixture(t); await diary.configure({ enabled: true })
  await diary.appendOwn(roleC, '晨光 海风😀 海风😀\n\n海风😀结尾\n字面 .* [x]\n2026-10-26 随笔', '摘要不变')
  const hits = []; let cursor = {}
  for (;;) {
    const page = await diary.searchOwn(roleC, { query: '海风😀', max_results: 1, ...cursor })
    assert.ok(page.matches.length <= 1); hits.push(...page.matches)
    if (!page.has_more) { assert.equal(page.next_start_line, null); assert.equal(page.next_start_column, null); break }
    cursor = { start_line: page.next_start_line, start_column: page.next_start_column }
  }
  assert.deepEqual(hits.map(({ line, column }) => [line, column]), [[1, 4], [1, 8], [3, 1]])
  for (const hit of hits) assert.match(hit.excerpt, /海风😀/)
  assert.deepEqual((await diary.searchOwn(roleC, { query: '.*' })).matches.map(m => m.line), [4])
  assert.deepEqual((await diary.searchOwn(roleC, { query: '2026-10-26' })).matches.map(m => m.line), [5])
  assert.equal((await diary.searchOwn(roleC, { query: '不存在' })).matches.length, 0)
  await diary.appendOwn(roleC, 'aaaaa', '摘要不变')
  assert.deepEqual((await diary.searchOwn(roleC, { query: 'aa', start_line: 6 })).matches.map(m => m.column), [1, 3])
})

test('empty and missing diaries stay absent; default pages, first/last/out-of-range rows are precise', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const empty = await diary.readRangeOwn(roleC)
  assert.equal(empty.text, ''); assert.equal(empty.total_lines, 0); assert.equal(empty.has_more, false)
  assert.deepEqual((await diary.searchOwn(roleC, { query: 'anything' })).matches, [])
  await assert.rejects(access(join(home, 'diaries', roleC.id)), { code: 'ENOENT' })
  const rows = Array.from({ length: 100 }, (_, i) => `行${i + 1}`)
  await diary.appendOwn(roleC, rows.join('\n'), '短摘要')
  const first = await diary.readRangeOwn(roleC)
  assert.equal(first.text, rows.slice(0, 80).join('\n') + '\n'); assert.equal(first.end_line, 80)
  assert.equal(first.next_start_line, 81); assert.equal(first.next_start_column, 1)
  assert.equal((await diary.readRangeOwn(roleC, { start_line: 1, end_line: 1 })).text, '行1\n')
  const last = await diary.readRangeOwn(roleC, { start_line: 100, end_line: 100 })
  assert.equal(last.text, '行100\n'); assert.equal(last.has_more, false); assert.equal(last.total_lines, 100)
  const beyond = await diary.readRangeOwn(roleC, { start_line: 999 })
  assert.equal(beyond.text, ''); assert.equal(beyond.end_line, null); assert.equal(beyond.has_more, false)
  assert.deepEqual((await diary.searchOwn(roleC, { query: '行', start_line: 999 })).matches, [])
})

test('single long Unicode line defaults to 8000 code points; continuation and explicit full lose nothing', async t => {
  const { diary } = await fixture(t); await diary.configure({ enabled: true })
  const body = '😀中文x'.repeat(7000) + '尾声🌅'
  await diary.appendOwn(roleC, body, '同一摘要')
  const first = await diary.readRangeOwn(roleC)
  assert.equal(Array.from(first.text).length, 8000); assert.equal(first.returned_chars, 8000)
  assert.equal(first.next_start_line, 1); assert.equal(first.next_start_column, 8001)
  assert.equal(first.text, Array.from(body).slice(0, 8000).join(''))
  let all = first.text, page = first
  while (page.has_more) {
    page = await diary.readRangeOwn(roleC, { start_line: page.next_start_line, start_column: page.next_start_column })
    assert.doesNotMatch(page.text, /[\uD800-\uDFFF]/u); all += page.text
  }
  assert.equal(all, body + '\n')
  assert.equal((await diary.readRangeOwn(roleC, { full: true })).text, body + '\n')
  const nearEnd = await diary.readRangeOwn(roleC, { start_line: 1, start_column: 28001, max_chars: 3 })
  assert.equal(nearEnd.text, '尾声🌅'); assert.equal(nearEnd.next_start_column, 28004)
})

test('tiny Unicode pages reconstruct mixed line separators, including CRLF at stream boundary', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const dir = join(home, 'diaries', roleC.id); await mkdir(dir, { recursive: true })
  const original = '😀中\r\n\r\n尾🌅\rlast'
  await writeFile(join(dir, 'Diary.md'), original)
  let text = '', cursor = {}
  for (;;) {
    const page = await diary.readRangeOwn(roleC, { ...cursor, max_chars: 1 })
    text += page.text
    if (!page.has_more) break
    cursor = { start_line: page.next_start_line, start_column: page.next_start_column }
  }
  assert.equal(text, '😀中\n\n尾🌅\nlast')
  assert.equal((await diary.readRangeOwn(roleC, { full: true })).text, original)
  const boundary = 'x'.repeat(65535) + '\r\n😀中\rEND\n'
  await writeFile(join(dir, 'Diary.md'), boundary)
  assert.equal((await diary.readRangeOwn(roleC, { start_line: 2, end_line: 3 })).text, '😀中\nEND\n')
  assert.deepEqual((await diary.searchOwn(roleC, { query: '中' })).matches.map(m => [m.line, m.column]), [[2, 2]])
})

test('search excerpts surround each late match in a huge line, not its beginning; read can expand the exact column', async t => {
  const { diary } = await fixture(t); await diary.configure({ enabled: true })
  const body = '😀前'.repeat(10000) + '海风🌅' + '中'.repeat(1000) + '海风🌅' + '尾'.repeat(500)
  await diary.appendOwn(roleC, body, '')
  const a = await diary.searchOwn(roleC, { query: '海风🌅', max_results: 1 })
  assert.equal(a.matches[0].column, 20001); assert.equal(a.next_start_line, 1); assert.equal(a.next_start_column, 21004)
  const b = await diary.searchOwn(roleC, { query: '海风🌅', start_line: a.next_start_line, start_column: a.next_start_column, max_results: 1 })
  assert.equal(b.matches[0].column, 21004); assert.equal(b.has_more, false)
  for (const hit of [...a.matches, ...b.matches]) {
    assert.ok(Array.from(hit.excerpt).length <= 202); assert.ok(hit.excerpt.includes('海风🌅'))
    assert.doesNotMatch(hit.excerpt, /[\uD800-\uDFFF]/u)
    assert.equal((await diary.readRangeOwn(roleC, { start_line: hit.line, start_column: hit.column, max_chars: 3 })).text, '海风🌅')
  }
})

test('search/range reads retain original bytes, legacy names and unchanged full summary injection', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const dir = join(home, 'diaries', roleC.id); await mkdir(dir, { recursive: true })
  const detail = 'DETAIL-ONLY\r\n自由格式😀\r无日期结构', summary = '稳定个性摘要。'
  await writeFile(join(dir, 'diary.md'), detail); await writeFile(join(dir, 'Persona_diary.md'), summary)
  const before = await diary.context(roleC)
  await diary.searchOwn(roleC, { query: '自由' }); await diary.readRangeOwn(roleC, { start_line: 2, end_line: 2 })
  assert.equal(await readFile(join(dir, 'diary.md'), 'utf8'), detail)
  await assert.rejects(access(join(dir, 'Diary.md')), { code: 'ENOENT' })
  assert.equal(await readFile(join(dir, 'Persona_diary.md'), 'utf8'), summary)
  assert.equal(await diary.context(roleC), before); assert.doesNotMatch(before, /DETAIL-ONLY/); assert.match(before, /稳定个性摘要/)
})

test('search/read validation rejects invalid cursors, foreign options and malformed queries without imposing storage limits', async t => {
  const { diary } = await fixture(t); await diary.configure({ enabled: true })
  for (const options of [{ start_line: 0 }, { start_column: 0 }, { end_line: 0 }, { max_chars: -1 }, { max_chars: 1.5 }, { start_line: 2, end_line: 1 }, { full: 'yes' }, { full: true, start_line: 1 }, { path: '/tmp/other' }]) await assert.rejects(diary.readRangeOwn(roleC, options))
  for (const options of [{ query: '' }, { query: 'a\nb' }, { query: '\ud800' }, { query: 'x', start_column: 0 }, { query: 'x', max_results: 0 }, { query: 'x', owner: 'other' }]) await assert.rejects(diary.searchOwn(roleC, options))
  await diary.appendOwn(roleC, 'free content', '')
  assert.equal((await diary.searchOwn(roleC, { query: ' ' })).matches.length, 1)
  assert.equal((await diary.readRangeOwn(roleC, { max_chars: 1000000 })).text, 'free content\n')
  assert.equal((await diary.searchOwn(roleC, { query: 'e', max_results: 1000000 })).matches.length, 3)
})

test('parallel and queued searches/range reads capture each role; OFF revokes them and keeps files intact', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const a = { id: 'role-a', label: '角色A' }, b = { id: 'role-b', label: '角色B' }
  await diary.appendOwn(a, 'needle OWN-A', 'summary-A'); await diary.appendOwn(b, 'needle OWN-B', 'summary-B')
  const mutable = { ...a }, pending = diary.searchOwn(mutable, { query: 'needle' }); mutable.id = b.id
  assert.equal((await pending).owner, a.id)
  const responses = await Promise.all([diary.searchOwn(a, { query: 'OWN' }), diary.searchOwn(b, { query: 'OWN' }), diary.readRangeOwn(a), diary.readRangeOwn(b)])
  assert.deepEqual(responses.map(r => r.owner), [a.id, b.id, a.id, b.id])
  assert.ok(responses[0].matches[0].excerpt.includes('OWN-A')); assert.ok(responses[1].matches[0].excerpt.includes('OWN-B'))
  assert.equal(responses[2].summary, 'summary-A'); assert.equal(responses[3].summary, 'summary-B')
  const search = diary.searchOwn(a, { query: 'needle' }), read = diary.readRangeOwn(b), off = diary.configure({ enabled: false })
  await assert.rejects(search, /已关闭/); await assert.rejects(read, /已关闭/); await off
  assert.equal(await diary.context(a), ''); assert.equal(await readFile(join(home, 'diaries', a.id, 'Diary.md'), 'utf8'), 'needle OWN-A\n')
})

test('new streaming APIs reject symlink/hardlink escape just like original diary reads', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true }); await diary.appendOwn(claude, 'foreign', 'foreign')
  await symlink(join(home, 'diaries', claude.id), join(home, 'diaries', gpt.id), 'dir')
  await assert.rejects(diary.searchOwn(gpt, { query: 'foreign' }), /链接/); await assert.rejects(diary.readRangeOwn(gpt), /链接/)
  await mkdir(join(home, 'diaries', roleC.id))
  await link(join(home, 'diaries', claude.id, 'Diary.md'), join(home, 'diaries', roleC.id, 'Diary.md'))
  await assert.rejects(diary.searchOwn(roleC, { query: 'foreign' }), /链接/); await assert.rejects(diary.readRangeOwn(roleC), /链接/)
})

test('default read stops before consuming a huge line; real stream delivery can revoke search/read immediately', async t => {
  const { home, diary } = await fixture(t); await diary.configure({ enabled: true })
  const dir = join(home, 'diaries', roleC.id); await mkdir(dir, { recursive: true })
  const text = '😀中x'.repeat(300000); await writeFile(join(dir, 'Diary.md'), text)
  const fs = (await import('node:fs')).default, { syncBuiltinESMExports } = await import('node:module')
  const original = fs.createReadStream, streams = []; let revoke = false, off
  fs.createReadStream = (...args) => {
    const stream = original(...args); streams.push(stream)
    if (revoke) { revoke = false; stream.once('data', () => { off = diary.configure({ enabled: false }) }) }
    return stream
  }
  syncBuiltinESMExports()
  try {
    const page = await diary.readRangeOwn(roleC)
    assert.equal(page.returned_chars, 8000); assert.ok(streams.at(-1).bytesRead < Buffer.byteLength(text)); assert.equal(streams.at(-1).destroyed, true)
    revoke = true; await assert.rejects(diary.searchOwn(roleC, { query: 'absent' }), /已关闭/); await off
    await diary.configure({ enabled: true })
    revoke = true; await assert.rejects(diary.readRangeOwn(roleC), /已关闭/); await off
    assert.equal(await readFile(join(dir, 'Diary.md'), 'utf8'), text)
  } finally { fs.createReadStream = original; syncBuiltinESMExports() }
})
