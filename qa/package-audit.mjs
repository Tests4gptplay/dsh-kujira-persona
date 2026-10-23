import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const root = resolve(process.argv[2])
const packPath = resolve(process.argv[3])
const pack = JSON.parse(readFileSync(packPath, 'utf8'))[0]
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(manifest.name, 'dsh-kujira-persona')
assert.equal(manifest.version, '1.4.0')
for (const key of ['scripts','dependencies','devDependencies','peerDependencies','optionalDependencies','bundledDependencies']) assert.ok(!manifest[key], key)
const allowed = /^(?:package\.json|index\.js|dossier\.js|cordis\.patch\.yml|LICENSE|NOTICE\.md|README\.md|CHANGELOG\.md|icon\.svg|assets\/hero\.svg|locale\/(?:en|zh)\.json|persona\/[^/]+\.md|personas\/gpt\/[^/]+\.md)$/
for (const entry of pack.files) assert.match(entry.path, allowed)
assert.deepEqual(pack.files.filter(x => x.path.endsWith('.js')).map(x => x.path).sort(), ['dossier.js','index.js'])
assert.equal(pack.files.filter(x => x.path.startsWith('persona/')).length, 11)
assert.equal(pack.files.filter(x => x.path.startsWith('personas/gpt/')).length, 6)
const tracked = execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split('\n')
assert.ok(!tracked.some(x => /^(?:\.github|qa|tests?|scripts|node_modules)\//.test(x)), 'test or workflow file in production tree')
execFileSync('git', ['-C', root, 'diff', '--exit-code', '2e328492021d3476064f6c013ef1f409afdd778d', 'HEAD', '--', 'persona', 'cordis.patch.yml', 'LICENSE'])
for (const file of ['index.js','dossier.js']) {
  const text = readFileSync(join(root, file), 'utf8')
  assert.doesNotMatch(text, /node:test|node:assert|setInterval\s*\(|setTimeout\s*\(|AbortController\s*\(|child_process|watchFile\s*\(|tools\/pre-execute|agent\/pre-step|agent\/request/)
}
const bytes = readFileSync(join(dirname(packPath), pack.filename))
const sha256 = createHash('sha256').update(bytes).digest('hex')
writeFileSync(join(dirname(packPath), 'SHA256SUMS'), `${sha256}  ${pack.filename}\n`)
console.log(JSON.stringify({ source: process.env.SOURCE_SHA, package: `${manifest.name}@${manifest.version}`, files: pack.files.map(x => x.path), fileCount: pack.entryCount, bytes: bytes.length, sha256, runtimeJavaScriptFiles: 2, dependencies: 0, lifecycleScripts: 0, productionTreeHasTestCode: false, legacyPresetUnchanged: true }, null, 2))
