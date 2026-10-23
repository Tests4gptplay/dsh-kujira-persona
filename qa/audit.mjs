import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const root=resolve(process.argv[2]), packPath=resolve(process.argv[3])
const pack=JSON.parse(readFileSync(packPath,'utf8'))[0], manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
assert.equal(manifest.version,'1.6.0')
for(const field of ['scripts','dependencies','devDependencies','peerDependencies','optionalDependencies']) assert.ok(!manifest[field],field)
const allowed=/^(?:package\.json|index\.js|catalog\.js|dossier\.js|cordis\.patch\.yml|README\.md|NOTICE\.md|CHANGELOG\.md|LICENSE|icon\.svg|assets\/hero\.svg|locale\/(?:zh|en)\.json|persona\/[^/]+\.md|personas\/[^/]+\/[^/]+\.md|world\/[^/]+\.md|instructions\/README\.md)$/
for(const file of pack.files) assert.match(file.path,allowed)
assert.equal(pack.entryCount,51)
assert.deepEqual(pack.files.filter(f=>f.path.endsWith('.js')).map(f=>f.path).sort(),['catalog.js','dossier.js','index.js'])
const tracked=execFileSync('git',['-C',root,'ls-tree','-r','--name-only','HEAD'],{encoding:'utf8'}).split('\n')
assert.ok(!tracked.some(p=>/^(?:qa|tests?|scripts|\.github|node_modules)\//.test(p)))
execFileSync('git',['-C',root,'diff','--exit-code','5da33e609395a0366f3405bf067ca65cd8b6db29','HEAD','--','persona','personas','cordis.patch.yml','LICENSE','NOTICE.md'])
const expected={
  'index.js':'143120a9cf8d8c5480361ca4472547af96a193088f4f240b9de93f31552c7e5b',
  'dossier.js':'2d7f6d578427b6566de07eb08668f40ae79e8dd007b7772379ca5bd3407736cf',
  'catalog.js':'b54958f5fa98aed2cae4c28b18463518ccb7019a80253c1a1544b0e27f9b5af4',
  'instructions/README.md':'f5d8ecc761ee4894ea7d67943ea37b34415f449eaea6387077d87271ff1da762',
  'world/00-共同世界观.md':'477b5911a13d7c763120ccd027a86b4d59ca23d4a13a4a0b98af901011493a4f',
  'world/10-公开角色名录.md':'929c521e5484dec83ad1270822552ee064f3d7072a8906bd075f05cd5d316884',
}
for(const [file,sha] of Object.entries(expected)) assert.equal(createHash('sha256').update(readFileSync(join(root,file))).digest('hex'),sha,file)
const bytes=readFileSync(join(dirname(packPath),pack.filename)), sha256=createHash('sha256').update(bytes).digest('hex')
writeFileSync(join(dirname(packPath),'SHA256SUMS'),`${sha256}  ${pack.filename}\n`)
console.log(JSON.stringify({source:process.env.SOURCE_SHA,version:manifest.version,files:pack.files.map(f=>f.path),fileCount:pack.entryCount,bytes:bytes.length,sha256,runtimeJS:3,runtimeDependencies:0,lifecycleScripts:0,qaInProduction:false,originalPresetsUnchanged:true},null,2))
