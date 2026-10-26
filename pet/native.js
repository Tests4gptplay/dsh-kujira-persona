/** One native child. Shared animation timing; only changed frames cross stdin. */
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { AnimationPlayer } from './animation.js'
import { artFor } from './art.js'
export class NativePet {
  constructor(root,onStatus,onAction){
    this.disposed=false;this.root=root;this.onStatus=onStatus;this.onAction=onAction;this.child=null;this.starting=null;this.stopRequest=null;this.wanted=false;this.last=null;this.stopping=Promise.resolve()
    this.player=null;this.art=null;this.artId=null;this.sessionId=null;this.frameKey='';this.frameTimer=null;this.pendingState=null;this.pendingFrame=null
  }
  async show(state){
    if(this.disposed)return
    this.wanted=true;this.last=state
    if(this.child&&!this.stopRequest){this.send(state);return}
    if(this.starting)return this.starting
    const start=(async()=>{
      await this.stopping
      if(this.child){if(this.wanted&&!this.disposed)this.send(this.last);return}
      const exe=join(this.root,'native','win-x64','KujiraPet.exe');await access(exe)
      if(!this.wanted||this.disposed)return
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
      p.once('error',()=>{if(this.child===p&&(p.pid==null||p.exitCode!=null||p.signalCode!=null)){this.child=null;this.stopFrames()}this.onStatus('none','桌面窗口暂时无法启动；可选择页面内显示')})
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
    if(!this.player||!this.child?.stdin.writable||this.last?.config.showPet===false)return
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
    this.wanted=false;this.stopFrames()
    if(this.stopRequest)return this.stopRequest
    const p=this.child
    if(!p){this.onStatus('none','');return this.stopping}
    this.onStatus('none','')
    const stop=new Promise((resolve,reject)=>{
      const exited=()=>p.exitCode!=null||p.signalCode!=null
      const finish=error=>{
        p.removeListener('exit',onExit);p.removeListener('error',onError)
        if(exited()&&this.child===p)this.child=null
        error?reject(error):resolve()
      }
      const onExit=()=>{if(this.child===p)this.child=null;finish()},onError=error=>finish(error)
      if(exited()){finish();return}
      p.once('exit',onExit);p.once('error',onError)
      // EOF is cooperative; a pipe error does not prove the process survived.
      try{p.stdin.end()}catch(error){this.onStatus('none',error?.message??String(error))}
      try{const killed=p.kill();if(exited())finish();else if(!killed)finish(new Error('无法结束 Windows 桌宠进程，请关闭桌宠后重试'))}catch(error){finish(error)}
    })
    this.stopRequest=stop
    // The returned request rejects on failure; the internal barrier recovers so
    // a later hide/show can retry, still owning a child that did not exit.
    this.stopping=stop.then(()=>{if(this.stopRequest===stop)this.stopRequest=null},error=>{
      if(this.stopRequest===stop)this.stopRequest=null
      this.onStatus('none',error?.message??String(error))
    })
    return stop
  }
  dispose(){this.disposed=true;return this.hide()}
}
