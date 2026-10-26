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
  for (const directory of [home, join(home, 'world'), join(home, 'world', 'private'), join(home, 'personas'), join(home, 'persona')]) await assert.rejects(diary.configure({ directory }), /不能与其重叠/)
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

test('malformed persisted settings fail closed without rewriting or reading any diary', async t => {
  const { home } = await fixture(t)
  const bad = '{broken'
  await writeFile(join(home, 'kujira-diary.json'), bad)
  const diary = openDiary({ home })
  await assert.rejects(diary.ready, /未启用或覆盖/)
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
