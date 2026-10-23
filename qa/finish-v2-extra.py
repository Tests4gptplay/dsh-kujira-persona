from pathlib import Path
p=Path('candidate/pet/controller.js')
s=p.read_text(encoding='utf-8')
a="this.usage=this.usage.status==='ready'?"
b="this.usage=['ready','stale'].includes(this.usage.status)?"
assert s.count(a)==1
p.write_text(s.replace(a,b),encoding='utf-8',newline='\n')
