import {AnimationPlayer} from './animation.js'
/** Native SVG fill hit regions. Merge identical vertical pixel runs without changing paint. */
export function alphaHitPath(pixels,width,height){
  const paths=[],active=new Map()
  const flush=box=>paths.push(`M${box.x} ${box.y}h${box.width}v${box.height}h-${box.width}z`)
  for(let y=0;y<height;y++){
    const seen=new Set();let start=-1
    for(let x=0;x<=width;x++){
      const painted=x<width&&pixels[(y*width+x)*4+3]>0
      if(painted&&start<0)start=x
      if(!painted&&start>=0){
        const key=start+':'+x;seen.add(key)
        if(active.has(key))active.get(key).height++
        else active.set(key,{x:start,y,width:x-start,height:1})
        start=-1
      }
    }
    for(const[key,box]of active)if(!seen.has(key)){flush(box);active.delete(key)}
  }
  for(const box of active.values())flush(box)
  return paths.join('')
}
/** Draw authored frames; only changes between actions crossfade. */
export class SpriteCanvas {
  constructor(canvas,manifest,urls,{onHitPath}={}) {
    this.canvas=canvas;this.manifest=manifest;this.player=new AnimationPlayer(manifest,{now:performance.now()})
    this.onHitPath=onHitPath;this.hitPaths=new Map();this.images={};this.loading=new Set();this.closed=false;this.loaded=false;this.timer=null;this.lastKey='';this.sessionId=null
    canvas.width=manifest.canvas[0];canvas.height=manifest.canvas[1]
    this.ready=Promise.all(Object.entries(urls).map(([name,url])=>new Promise((resolve,reject)=>{
      const image=new Image(),cancel=()=>{image.onload=null;image.onerror=null;image.src='';resolve()}
      const release=()=>{image.onload=null;image.onerror=null;this.loading.delete(cancel)}
      this.loading.add(cancel)
      image.onload=()=>{release();if(!this.closed)this.images[name]=image;resolve()}
      image.onerror=()=>{release();reject(new Error('Sprite sheet unavailable'))};image.src=url
    }))).then(()=>{if(!this.closed){this.loaded=true;this.render()}})
    this.visibility=()=>{clearTimeout(this.timer);if(!document.hidden)this.render()}
    document.addEventListener('visibilitychange',this.visibility)
  }
  update(task,config,sessionId){
    if(this.closed)return
    const now=performance.now()
    if(sessionId!==undefined&&sessionId!==this.sessionId){this.sessionId=sessionId;this.player=new AnimationPlayer(this.manifest,{now});this.lastKey='';this.hitPaths.clear()}
    this.player.update(task,config,now);this.render()
  }
  startDrag(){this.player.startDrag(performance.now());this.render()}
  endDrag(){this.player.endDrag(performance.now());this.render()}
  interact(name){this.player.interact(name,performance.now());this.render()}
  render(){
    clearTimeout(this.timer)
    if(this.closed||!this.loaded||document.hidden)return
    const state=this.player.tick(performance.now())
    if(state.key!==this.lastKey){
      const ctx=this.canvas.getContext('2d')
      ctx.clearRect(0,0,this.canvas.width,this.canvas.height)
      for(const {frame,opacity} of state.layers){
        const rect=frame.rect,at=frame.at??[0,0],size=frame.size??rect.slice(2)
        ctx.globalAlpha=opacity;ctx.drawImage(this.images[frame.sheet],...rect,...at,...size)
      }
      ctx.globalAlpha=1
      if(this.onHitPath){
        let path=this.hitPaths.get(state.key)
        if(path===undefined){
          path=alphaHitPath(ctx.getImageData(0,0,this.canvas.width,this.canvas.height).data,this.canvas.width,this.canvas.height)
          this.hitPaths.set(state.key,path)
          if(this.hitPaths.size>64)this.hitPaths.delete(this.hitPaths.keys().next().value)
        }
        this.onHitPath({path,width:this.canvas.width,height:this.canvas.height})
      }
      this.canvas.dataset.clip=state.clip;this.canvas.dataset.frame=String(state.index);this.lastKey=state.key
    }
    if(state.nextDelay!==null)this.timer=setTimeout(()=>this.render(),Math.ceil(state.nextDelay))
  }
  dispose(){this.closed=true;clearTimeout(this.timer);document.removeEventListener('visibilitychange',this.visibility);for(const cancel of this.loading)cancel();this.loading.clear();this.images={};this.hitPaths.clear();this.onHitPath?.({path:'',width:this.canvas.width,height:this.canvas.height})}
}

