import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const root = resolve(process.argv[2]), packPath = resolve(process.argv[3])
const pack = JSON.parse(readFileSync(packPath, 'utf8'))[0]
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(manifest.name, 'dsh-kujira-persona'); assert.equal(manifest.version, '1.5.0')
for (const key of ['scripts','dependencies','devDependencies','peerDependencies','optionalDependencies','bundledDependencies']) assert.ok(!manifest[key], key)
const roles = ['gpt','gemini','claude','grok','glm','kimi','qwen','minimax','llama','doubao']
const allowed = new RegExp('^(?:package\\.json|index\\.js|dossier\\.js|catalog\\.js|cordis\\.patch\\.yml|LICENSE|NOTICE\\.md|README\\.md|CHANGELOG\\.md|icon\\.svg|assets/hero\\.svg|locale/(?:en|zh)\\.json|persona/[^/]+\\.md|personas/(?:'+roles.join('|')+')/[^/]+\\.md)$')
for (const entry of pack.files) assert.match(entry.path, allowed)
assert.deepEqual(pack.files.filter(x => x.path.endsWith('.js')).map(x => x.path).sort(), ['catalog.js','dossier.js','index.js'])
assert.equal(pack.files.filter(x => x.path.startsWith('persona/')).length, 11)
for (const id of roles) assert.ok(pack.files.some(x => x.path === `personas/${id}/90-记忆.md`), id)
const tracked = execFileSync('git', ['-C', root, 'ls-tree', '-r', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split('\n')
assert.ok(!tracked.some(x => /^(?:\.github|qa|tests?|scripts|node_modules)\//.test(x)), 'test or workflow in production')
execFileSync('git', ['-C', root, 'diff', '--exit-code', '36dea487a07bdb54d825abff456c6f8cbd2c2cf2', 'HEAD', '--', 'persona', 'personas/gpt', 'dossier.js', 'cordis.patch.yml', 'LICENSE'])
for (const file of ['index.js','dossier.js','catalog.js']) {
  const text = readFileSync(join(root, file), 'utf8')
  assert.doesNotMatch(text, /node:test|node:assert|setInterval\s*\(|setTimeout\s*\(|AbortController\s*\(|child_process|watchFile\s*\(|tools\/pre-execute|agent\/pre-step|agent\/request/)
}
const bytes = readFileSync(join(dirname(packPath), pack.filename)), sha256 = createHash('sha256').update(bytes).digest('hex')
writeFileSync(join(dirname(packPath), 'SHA256SUMS'), `${sha256}  ${pack.filename}\n`)
console.log(JSON.stringify({ source: process.env.SOURCE_SHA, package: `${manifest.name}@${manifest.version}`, files: pack.files.map(x => x.path), fileCount: pack.entryCount, bytes: bytes.length, sha256, runtimeJavaScriptFiles: 3, dependencies: 0, lifecycleScripts: 0, productionTreeHasTestCode: false, legacyPresetsUnchanged: true }, null, 2))
