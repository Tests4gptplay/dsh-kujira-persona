"""Build isolated GitHub and npm packages, preserving each channel's identity."""
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
legacy_name = 'dsh-kujira-persona'
npm_name = '@tests4gptplay/dsh-kujira-persona'
metadata = json.loads((root / 'package.json').read_text(encoding='utf-8'))
version = metadata['version']
assert version == '2.4.4', version
assert metadata['name'] == legacy_name, 'Source must retain the original GitHub package identity'
targets = [out / f'{legacy_name}-{version}.tgz', out / f'tests4gptplay-{legacy_name}-{version}.tgz']
assert not any(target.exists() for target in targets), 'Refusing to overwrite an existing candidate'
assert not (out / 'SHA256SUMS.txt').exists(), 'Refusing to overwrite existing checksums'
original = (root / 'README.md').read_text(encoding='utf-8')
clean, count = re.subn(
    r'<!-- ACCOUNT-VALIDATION-WEB-ONLY:START -->.*?<!-- ACCOUNT-VALIDATION-WEB-ONLY:END -->\n?',
    '', original, flags=re.S,
)
assert count == 1, 'Expected exactly one website-only note'
patch_identity = re.compile(r'''(?m)^(\s*name:\s*)(?:'dsh-kujira-persona'|"dsh-kujira-persona"|dsh-kujira-persona)(\s*)$''')
client_identity = re.compile(r'''(window\.__ModuleLoader__\.load\(\{id:)(['"])dsh-kujira-persona\2''')
assert len(patch_identity.findall((root / 'cordis.patch.yml').read_text(encoding='utf-8'))) == 1
assert len(client_identity.findall((root / 'pet/client.js').read_text(encoding='utf-8'))) == 1
# Ask npm for its production whitelist, then copy only those files. Each channel
# gets its own temporary package directory; no checkout file is rewritten.
listing = subprocess.run(
    ['npm.cmd' if os.name == 'nt' else 'npm', 'pack', '--ignore-scripts', '--dry-run', '--json'],
    cwd=root, check=True, capture_output=True, text=True, encoding='utf-8',
)
source_files = {item['path'] for item in json.loads(listing.stdout)[0]['files']}
required = {
    'package.json', 'migration-state.js',
    'pet/account-options.js', 'pet/client.js',
    'pet/controller.js', 'pet/index.js',
    'pet/ui-messages.js', 'pet/usage.js',
    'pet/usage-western.js', 'pet/companion/launch-spec.mjs',
    'pet/native/win-x64/KujiraPet.exe',
}
assert required <= source_files, sorted(required - source_files)
checksums = []
for identity, target in zip((legacy_name, npm_name), targets):
    with tempfile.TemporaryDirectory(prefix='kujira-release-') as temporary:
        stage = pathlib.Path(temporary) / 'package'
        stage.mkdir()
        for name in sorted(source_files):
            assert not pathlib.PurePosixPath(name).is_absolute()
            assert '..' not in pathlib.PurePosixPath(name).parts, name
            source = root / name
            assert source.is_file() and not source.is_symlink(), name
            destination = stage / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        (stage / 'README.md').write_text(clean, encoding='utf-8')
        if identity == npm_name:
            scoped = dict(metadata, name=npm_name)
            (stage / 'package.json').write_text(json.dumps(scoped, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            patch, count = patch_identity.subn(lambda match: match[1] + "'" + npm_name + "'" + match[2], (stage / 'cordis.patch.yml').read_text(encoding='utf-8'))
            assert count == 1
            (stage / 'cordis.patch.yml').write_text(patch)
            client, count = client_identity.subn(lambda match: match[1] + match[2] + npm_name + match[2], (stage / 'pet/client.js').read_text(encoding='utf-8'))
            assert count == 1
            (stage / 'pet/client.js').write_text(client)
        result = subprocess.run(
            ['npm.cmd' if os.name == 'nt' else 'npm', 'pack', '--ignore-scripts', '--json', '--pack-destination', str(stage.parent)],
            cwd=stage, check=True, capture_output=True, text=True, encoding='utf-8',
        )
        package = json.loads(result.stdout)[0]
        assert package['name'] == identity and package['version'] == version
        packed = stage.parent / package['filename']
        with tarfile.open(packed) as archive:
            assert {member.name.removeprefix('package/') for member in archive.getmembers() if member.isfile()} == source_files
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
                expected = (stage / name).read_bytes()
                assert actual == expected, name
                if name.endswith(('.js', '.mjs', '.cjs', '.md', '.json')):
                    assert b'ACCOUNT-VALIDATION-WEB-ONLY' not in actual, name
            manifest = json.loads(archive.extractfile('package/package.json').read())
            assert manifest['name'] == identity and manifest['version'] == version
            patch = archive.extractfile('package/cordis.patch.yml').read().decode()
            assert re.search(r'(?m)^\s*name:\s*[\'\"]?' + re.escape(identity) + r'[\'\"]?\s*$', patch)
            client = archive.extractfile('package/pet/client.js').read().decode()
            assert re.search(r'''window\.__ModuleLoader__\.load\(\{id:(['"])''' + re.escape(identity) + r'\1', client)
        shutil.copy2(packed, target)
    with target.open('rb') as package_file:
        digest = hashlib.file_digest(package_file, 'sha256').hexdigest()
    checksums.append(f'{digest}  {target.name}\n')
    print(json.dumps({'file': str(target), 'name': identity, 'bytes': target.stat().st_size, 'sha256': digest, 'files': len(package['files'])}))
(out / 'SHA256SUMS.txt').write_text(''.join(checksums))
