from pathlib import Path
import sys,json,hashlib,tarfile,gzip,io
root=Path(sys.argv[1]).resolve();outdir=Path(sys.argv[2]).resolve();here=Path(__file__).resolve().parent
manifest=json.loads((here/'manifest.json').read_text());layout=json.loads((here/'payload-layout.json').read_text());outdir.mkdir(parents=True,exist_ok=True);target=outdir/manifest['archive']
assert len(layout)==247 and len({x['path'] for x in layout})==247
with target.open('wb') as f,gzip.GzipFile(fileobj=f,mode='wb',mtime=0) as gz,tarfile.open(fileobj=gz,mode='w') as t:
 for item in layout:
  n=item['path'];assert not n.startswith('/') and '..' not in Path(n).parts
  data=(here/'package-README.md').read_bytes() if n=='README.md' else (root/n).read_bytes()
  assert hashlib.sha256(data).hexdigest()==manifest['payloadSHA256'][n],n
  info=tarfile.TarInfo('package/'+n);info.mode=item['mode'];info.size=len(data);t.addfile(info,io.BytesIO(data))
assert target.stat().st_size==manifest['bytes']
assert hashlib.sha256(target.read_bytes()).hexdigest()==manifest['sha256']
print(json.dumps({'archive':target.name,'bytes':target.stat().st_size,'sha256':manifest['sha256'],'payloadFiles':247,'exactOriginalBytes':True}))
