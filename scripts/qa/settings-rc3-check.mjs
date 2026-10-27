import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { createFolderBrowser } from '../../pet/folders.js'

// Focused settings regressions; this file is deliberately not packaged.
test('folder sizes, Stella, allowed paths and native folder launch', async () => {
  const base = await mkdtemp(join(tmpdir(), 'kujira-rc3-'))
  const world = join(base, 'world'), personas = join(base, 'personas')
  const visited = [], seeded = []
  const launch = (command, args) => {
    visited.push([command, args[0]])
    const child = new EventEmitter()
    child.unref = () => {}
    process.nextTick(() => child.emit('spawn'))
    return child
  }
  const browser = createFolderBrowser({
    worldDir: world, personasDir: personas, platform: 'win32', launch,
    ensureFolder: async id => seeded.push(id),
    catalog: { list: async () => ({ personas: [{id: 'custom-one', label: '我的角色'}], bindings: [] }) },
  })
  try {
    await mkdir(world); await mkdir(join(personas, 'stella'), {recursive:true}); await mkdir(join(personas, 'deepseek'), {recursive:true})
    await writeFile(join(world, 'world.md'), 'abc')
    await writeFile(join(personas, 'deepseek','character.md'), '12345')
    await writeFile(join(personas, 'stella', 'memory.md'), 'star')
    const outside = join(base, 'other-file')
    await writeFile(outside, 'private'.repeat(500))
    await symlink(outside, join(personas, 'stella', 'link'))
    const data = await browser.list()
    const size = data.characters.find(x => x.id === 'role:stella')?.bytes
    assert.equal(data.groups[0].bytes, 3)
    assert.equal(data.groups[1].bytes, 9)
    assert.equal(size, 4)
    assert.equal(data.totalBytes, 12)
    assert(data.characters.some(x => x.id === 'role:custom-one'))
    assert(data.characters.some(x => x.id === 'role:deepseek' && x.bytes === 5))
    await assert.rejects(browser.open('role:../other-file'), /无效/)
    await assert.rejects(browser.open('role:not-registered'), /角色目录/)
    assert.equal(visited.length, 0)
    await browser.open('role:stella')
    await browser.open('world')
    assert.deepEqual(seeded, ['stella','world'])
    assert.deepEqual(visited, [['explorer.exe',join(personas,'stella')],['explorer.exe',world]])
  } finally { await rm(base,{recursive:true,force:true}) }
})

test('settings navigation and whole-bubble CSS are wired in the client', async () => {
  const client=await readFile(new URL('../../pet/client.js',import.meta.url),'utf8')
  assert.match(client,/slots\.inject\('settings\.section'/)
  assert.doesNotMatch(client,/slots\.inject\('plugins\.bundle\.config'/)
  assert.match(client,/transform:'scale\('\+s\.config\.bubbleScale/)
  assert.match(client,/transformOrigin:'bottom right'/)
  assert.match(client,/整个气泡大小/)
  assert.match(client,/世界观与人物档案/)
  assert.match(client,/刷新文件夹大小/)
})

test('folder browser accepts catalog-valid IDs longer than 64 without weakening path validation',async()=>{
 const base=await mkdtemp(join(tmpdir(),'kujira-long-id-')),id='a'.repeat(65),opened=[]
 const browser=createFolderBrowser({worldDir:join(base,'world'),personasDir:join(base,'personas'),platform:'win32',catalog:{list:async()=>({personas:[{id,label:'long valid'}]})},launch:(_cmd,args)=>{opened.push(args[0]);const child=new EventEmitter();child.unref=()=>{};process.nextTick(()=>child.emit('spawn'));return child}})
 try{
  const rows=await browser.list();assert(rows.characters.some(row=>row.id==='role:'+id));await browser.open('role:'+id);assert.equal(opened[0],join(base,'personas',id))
  await assert.rejects(browser.open('role:../outside'),/无效/);await assert.rejects(browser.open('role:none'),/无效/)
 }finally{await rm(base,{recursive:true,force:true})}
})
