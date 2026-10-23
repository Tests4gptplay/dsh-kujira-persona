/** One native child, updated over stdin. No restart loop and no model processes. */
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
export class NativePet {
  constructor(root,onStatus,onAction){this.root=root;this.onStatus=onStatus;this.onAction=onAction;this.child=null;this.starting=null;this.wanted=false;this.last=null}
  async show(state){
    this.wanted=true;this.last=state
    if(this.child){this.send(state);return}
    if(this.starting)return this.starting
    const start=(async()=>{
      const exe=join(this.root,'native','win-x64','KujiraPet.exe');await access(exe)
      if(!this.wanted)return
      const p=spawn(exe,[],{stdio:['pipe','pipe','pipe'],windowsHide:true,cwd:this.root})
      this.child=p;p.stderr.on('data',()=>{});p.stdin.on('error',()=>{})
      const lines=createInterface({input:p.stdout})
      lines.on('line',line=>{try{const m=JSON.parse(line);if(m.type==='ready'){this.onStatus('desktop','');this.send(this.last)}else if(m.type==='already-open'){this.onStatus('none','另一个 DSH 窗口已打开桌宠，请先在那里关闭')}else if(m.type==='action')this.onAction(m)}catch{}})
      p.once('error',()=>{if(this.child===p)this.child=null;this.onStatus('none','桌面窗口暂时无法启动；可选择页面内显示')})
      p.once('exit',()=>{lines.close();if(this.child===p){this.child=null;this.onStatus('none',this.wanted?'桌宠窗口已关闭，可重新启用':'')}})
      this.send(state)
    })()
    this.starting=start
    try{await start}catch{this.onStatus('none','未找到 Windows 桌宠程序；请使用完整安装包或选择页面内显示')}finally{if(this.starting===start)this.starting=null}
  }
  send(state){if(!state||!this.child?.stdin.writable)return;const image=join(this.root,'assets',`${state.route.art}.png`);this.child.stdin.write(JSON.stringify({...state,image})+'\n')}
  hide(){this.wanted=false;const p=this.child;this.child=null;if(p){p.stdin.end();p.kill()}this.onStatus('none','')}
  dispose(){this.hide()}
}
