"""Build the release tarball without website-only account validation notes."""
import json, pathlib, re, subprocess, sys, tarfile, hashlib
root=pathlib.Path(__file__).resolve().parents[2]
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'dist').resolve();out.mkdir(parents=True,exist_ok=True)
readme=root/'README.md'; original=readme.read_text()
pattern=r'<!-- ACCOUNT-VALIDATION-WEB-ONLY:START -->.*?<!-- ACCOUNT-VALIDATION-WEB-ONLY:END -->\n?'
clean,count=re.subn(pattern,'',original,flags=re.S)
assert count==1, 'Expected one website-only note'
try:
    readme.write_text(clean)
    result=subprocess.run(['npm','pack','--ignore-scripts','--json','--pack-destination',str(out)],cwd=root,check=True,capture_output=True,text=True)
finally:
    readme.write_text(original)
package=json.loads(result.stdout)[0]; path=out/package['filename']
assert package['version']=='2.4.1'
with tarfile.open(path) as archive:
    for member in archive.getmembers():
        if not member.isfile(): continue
        name=member.name.removeprefix('package/')
        actual=archive.extractfile(member).read()
        expected=clean.encode() if name=='README.md' else (root/name).read_bytes()
        assert actual==expected, name
        assert not name.startswith(('scripts/','docs/testing/','node_modules/')),name
        if name.endswith(('.js','.md','.json')):
            assert b'ACCOUNT-VALIDATION-WEB-ONLY' not in actual,name
            assert '其他来源待用户验证反馈'.encode() not in actual,name
    assert 'package/pet/usage-cloud-vendors.js' not in archive.getnames()
digest=hashlib.sha256(path.read_bytes()).hexdigest()
(out/'SHA256SUMS.txt').write_text(f'{digest}  {path.name}\n')
print(json.dumps({'file':str(path),'bytes':path.stat().st_size,'sha256':digest,'files':len(package['files'])}))
