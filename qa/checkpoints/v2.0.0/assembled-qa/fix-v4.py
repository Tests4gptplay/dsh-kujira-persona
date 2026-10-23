from pathlib import Path
p=Path('qa/pet-source/native.js');s=p.read_text();s=s.replace('this.last=null}', 'this.last=null;this.stopping=Promise.resolve()}')
s=s.replace("      const exe=join", "      await this.stopping\n      const exe=join")
s=s.replace("if(p){p.stdin.end();p.kill()}this.onStatus", "if(p){this.stopping=new Promise(resolve=>{if(p.exitCode!==null){resolve();return}p.once('exit',resolve);p.once('error',resolve);p.stdin.end();p.kill()})}this.onStatus")
p.write_text(s)
