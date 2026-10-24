/** One native child. Shared animation timing; only changed frames cross stdin. */
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { AnimationPlayer } from './animation.js'
import { artFor } from './art.js'
export class NativePet {
  constructor(root,onStatus,onAction){
    this.root=root;this.onStatus=onStatus;this.onAction=onAction;this.child=null;this.starting=null;this.wanted=false;this.last=null;this.stopping=Promise.resolve()
    this.player=null;this.art=null;this.artId=null;this.sessionId=null;this.frameKey='';this.frameTimer=null;this.pendingState=null;this.pendingFrame=null
  }
  async show(state){
    this.wanted=true;this.last=state
    if(this.child){this.send(state);return}
    if(this.starting)return this.starting
    const start=(async()=>{
      await this.stopping
      const exe=join(this.root,'native','win-x64','KujiraPet.exe');await access(exe)
      if(!this.wanted)return
      const p=spawn(exe,[],{stdio:['pipe','pipe','pipe'],windowsHide:true,cwd:this.root})
      this.child=p;p.stderr.on('data',()=>{});p.stdin.on('error',()=>{})
      p.stdin.on('drain',()=>this.flush(p))
      const lines=createInterface({input:p.stdout})
      lines.on('line',line=>{if(this.child!==p)return;try{
        const m=JSON.parse(line)
        if(m.type==='ready'){this.onStatus('desktop','');this.send(this.last);this.frameKey='';this.frame()}
        else if(m.type==='already-open')this.onStatus('none','另一个 DSH 窗口已打开桌宠，请先在那里关闭')
        else if(m.type==='action'){
          if(m.action==='drag-start'){this.player?.startDrag(performance.now());this.frame()}
          else if(m.action==='drag-end'){this.player?.endDrag(performance.now());this.frame()}
          else if(m.action==='interact'){this.player?.interact(m.clip,performance.now());this.frame()}
          else this.onAction(m)
        }
      }catch{}})
      p.once('error',()=>{if(this.child===p){this.child=null;this.stopFrames()}this.onStatus('none','桌面窗口暂时无法启动；可选择页面内显示')})
      p.once('exit',()=>{lines.close();if(this.child===p){this.child=null;this.stopFrames();this.onStatus('none',this.wanted?'桌宠窗口已关闭，可重新启用':'')}})
      this.send(this.last)
    })()
    this.starting=start
    try{await start}catch{this.onStatus('none','未找到 Windows 桌宠程序；请使用完整安装包或选择页面内显示')}finally{if(this.starting===start)this.starting=null}
  }
  write(value){
    const pipe=this.child?.stdin;if(!pipe?.writable)return
    if(pipe.writableNeedDrain){if(value.type==='frame')this.pendingFrame=value;else this.pendingState=value;return}
    pipe.write(JSON.stringify(value)+'\n')
  }
  flush(child){
    if(this.child!==child)return
    const state=this.pendingState,frame=this.pendingFrame;this.pendingState=null;this.pendingFrame=null
    if(state)this.write(state)
    if(frame)this.write(frame)
  }
  send(state){
    if(!state)return
    this.last=state
    if(!this.child?.stdin.writable)return
    if(state.route.art!==this.artId){
      this.stopFrames();this.artId=state.route.art;this.art=artFor(this.artId)
      this.player=this.art?new AnimationPlayer(this.art,{now:performance.now()}):null;this.frameKey=''
    }
    if(state.route.sessionId!==this.sessionId){
      this.sessionId=state.route.sessionId
      this.player=this.art?new AnimationPlayer(this.art,{now:performance.now()}):null;this.frameKey=''
    }
    this.write({...state,image:'',animated:!!this.player})
    if(this.player){this.player.update(state.task,state.config,performance.now());this.frame()}
  }
  frame(){
    clearTimeout(this.frameTimer);this.frameTimer=null
    if(!this.player||!this.child?.stdin.writable)return
    const value=this.player.tick(performance.now())
    if(value.key!==this.frameKey){
      const encode=frame=>({image:join(this.root,'assets',this.art.sheets[frame.sheet]),rect:frame.rect,at:frame.at??[0,0],size:frame.size??frame.rect.slice(2)})
      this.write({type:'frame',...encode(value.frame),layers:value.layers.map(layer=>({...encode(layer.frame),opacity:layer.opacity})),canvas:this.art.canvas,clip:value.clip,index:value.index})
      this.frameKey=value.key
    }
    if(value.nextDelay!==null){this.frameTimer=setTimeout(()=>this.frame(),Math.ceil(value.nextDelay));this.frameTimer.unref?.()}
  }
  stopFrames(){clearTimeout(this.frameTimer);this.frameTimer=null;this.player=null;this.art=null;this.artId=null;this.sessionId=null;this.frameKey='';this.pendingState=null;this.pendingFrame=null}
  hide(){
    this.wanted=false;this.stopFrames();const p=this.child;this.child=null
    if(p){this.stopping=new Promise(resolve=>{if(p.exitCode!==null){resolve();return}p.once('exit',resolve);p.once('error',resolve);p.stdin.end();p.kill()})}
    this.onStatus('none','')
  }
  dispose(){this.hide()}
}

