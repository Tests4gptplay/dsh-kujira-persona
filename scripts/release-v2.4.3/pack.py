"""Build and inspect the 2.4.3 prerelease using the production npm whitelist."""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tarfile

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
version = json.loads((root / 'package.json').read_text())['version']
assert version == '2.4.3-rc.1', version
readme = root / 'README.md'
original = readme.read_text()
clean, count = re.subn(
    r'<!-- ACCOUNT-VALIDATION-WEB-ONLY:START -->.*?<!-- ACCOUNT-VALIDATION-WEB-ONLY:END -->\n?',
    '', original, flags=re.S,
)
assert count == 1, 'Expected exactly one website-only note'
try:
    readme.write_text(clean)
    result = subprocess.run(
        ['npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', str(out)],
        cwd=root, check=True, capture_output=True, text=True,
    )
finally:
    readme.write_text(original)
package = json.loads(result.stdout)[0]
assert package['version'] == version
packed = out / package['filename']
target = out / f'dsh-kujira-persona-{version}.tgz'
assert not target.exists(), 'Refusing to overwrite an existing candidate'
packed.rename(target)
with tarfile.open(target) as archive:
    names = set(archive.getnames())
    required = {
        'package/package.json', 'package/migration-state.js',
        'package/pet/account-options.js', 'package/pet/client.js',
        'package/pet/controller.js', 'package/pet/index.js',
        'package/pet/ui-messages.js', 'package/pet/usage.js',
        'package/pet/usage-western.js', 'package/pet/companion/launch-spec.mjs',
        'package/pet/native/win-x64/KujiraPet.exe',
    }
    assert required <= names, sorted(required - names)
    for member in archive.getmembers():
        assert member.name.startswith('package/'), member.name
        name = member.name.removeprefix('package/')
        assert '..' not in pathlib.PurePosixPath(name).parts, name
        assert member.isfile() or member.isdir(), name
        if not member.isfile():
            continue
        assert not name.startswith(('scripts/', 'docs/testing/', 'node_modules/', 'work/', '.git/')), name
        assert not re.search(r'(^|/)(\.env(?:\..*)?|\.credentials.*)$|\.(?:test\.[cm]?js|tmp|log|bak)$', name), name
        actual = archive.extractfile(member).read()
        expected = clean.encode() if name == 'README.md' else (root / name).read_bytes()
        assert actual == expected, name
        if name.endswith(('.js', '.mjs', '.cjs', '.md', '.json')):
            assert b'ACCOUNT-VALIDATION-WEB-ONLY' not in actual, name
    assert json.loads(archive.extractfile('package/package.json').read())['version'] == version
digest = hashlib.file_digest(target.open('rb'), 'sha256').hexdigest()
(out / 'SHA256SUMS.txt').write_text(f'{digest}  {target.name}\n')
print(json.dumps({'file': str(target), 'bytes': target.stat().st_size, 'sha256': digest, 'files': len(package['files'])}))
