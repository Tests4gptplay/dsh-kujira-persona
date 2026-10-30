from pathlib import Path
import hashlib,json,sys,tarfile
here=Path(__file__).resolve().parent
m=json.loads((here/'manifest.json').read_text())
p=Path(sys.argv[1])/m['archive']
assert p.stat().st_size==m['bytes'], 'archive size differs from the tested local package'
assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sha256'], 'archive SHA256 differs; do not publish an unreviewed replacement'
with tarfile.open(p) as t:
    actual={f.name.removeprefix('package/'):hashlib.sha256(t.extractfile(f).read()).hexdigest() for f in t if f.isfile()}
assert actual==m['payloadSHA256'], 'payload changed'
assert len(actual)==m['payloadFiles']
print(json.dumps({'version':m['version'],'sha256':m['sha256'],'bytes':m['bytes'],'payloadFiles':len(actual),'exactTestedPackage':True}))
