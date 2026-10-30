const{EventEmitter}=require('node:events');
const{windowOptions,prepareWindow,mouseOptions}=require('./platform.cjs');
function constrain(b,a){const width=Math.min(b.width,a.width),height=Math.min(b.height,a.height);return{x:Math.round(Math.max(a.x,Math.min(b.x,a.x+a.width-width))),y:Math.round(Math.max(a.y,Math.min(b.y,a.y+a.height-height))),width:Math.ceil(width),height:Math.ceil(height)}}
const contains=(r,p)=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height;
function applyPosition(pet,config,lastPosition=''){const x=config?.desktopX,y=config?.desktopY,key=Number.isFinite(x)&&Number.isFinite(y)?x+','+y:'default';if(key!==lastPosition){if(key==='default')pet?.resetPosition();else pet?.position(x,y)}return key}
class PetWindow extends EventEmitter{
 constructor({BrowserWindow,screen,preload,url,platform=process.platform,clock={setInterval,clearInterval}}){super();Object.assign(this,{screen,clock,platform});this.regions=[];this.drag=null;this.closed=false;this.ignore=null;
 this.window=new BrowserWindow({...windowOptions(platform),width:320,height:380,transparent:true,frame:false,show:false,alwaysOnTop:true,skipTaskbar:true,resizable:false,hasShadow:false,webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true}});
 const initial=this.window.getBounds(),area=this.screen.getDisplayMatching(initial).workArea;this.defaultAnchor={x:initial.x+initial.width-area.x-area.width/2,y:initial.y+initial.height-area.y-area.height/2};
 this.window.webContents.on('render-process-gone',(_e,d)=>this.emit('fault',{kind:'renderer',reason:d.reason,exitCode:d.exitCode}));
 this.window.webContents.on('did-fail-load',(_e,code,description)=>this.emit('fault',{kind:'load',code,description}));this.window.on('closed',()=>this.dispose());
 prepareWindow(this.window,platform);
 this.shaped=platform==='linux'&&typeof this.window.setShape==='function';
 this.displayChanged=()=>this.relocate(this.window.getBounds());for(const e of ['display-removed','display-metrics-changed'])screen.on(e,this.displayChanged);
 // Linux lacks ignoreMouseEvents forward:true; cursor polling restores interaction.
 this.poll=clock.setInterval(()=>this.tick(),25);this.poll.unref?.();this.ready=this.window.loadURL(url);}
 relocate(b){if(!this.closed)this.window.setBounds(constrain(b,this.screen.getDisplayMatching(b).workArea))}
 layout({width,height,regions,paintRegions=regions}){if(this.closed)return;const b=this.window.getBounds();this.regions=regions;if(this.shaped)this.window.setShape(paintRegions.map(r=>({x:Math.floor(r.x),y:Math.floor(r.y),width:Math.max(1,Math.ceil(r.x+r.width)-Math.floor(r.x)),height:Math.max(1,Math.ceil(r.y+r.height)-Math.floor(r.y))})));if(!width||!height){this.window.hide();return}const p=this.pendingPosition,reset=this.pendingReset;this.pendingPosition=null;this.pendingReset=false;const next={x:p?.x??b.x+b.width-width,y:p?.y??b.y+b.height-height,width,height};this.relocate(reset?this.defaultBounds(next):next);this.window.showInactive();this.tick()}
 defaultBounds(b){const a=this.screen.getDisplayMatching(b).workArea;return{...b,x:a.x+a.width/2+this.defaultAnchor.x-b.width,y:a.y+a.height/2+this.defaultAnchor.y-b.height}}
 resetPosition(){this.drag=null;this.pendingPosition=null;this.pendingReset=true;if(this.window.isVisible?.()){this.relocate(this.defaultBounds(this.window.getBounds()));this.pendingReset=false}}
 position(x,y){this.pendingReset=false;this.pendingPosition={x,y};if(this.window.isVisible?.()){this.relocate({...this.window.getBounds(),x,y});this.pendingPosition=null}}
 beginDrag(){if(this.closed)return;this.drag={cursor:this.screen.getCursorScreenPoint(),bounds:this.window.getBounds()};this.emit('action',{action:'drag-start'})}
 endDrag(){if(!this.drag)return;this.drag=null;this.relocate(this.window.getBounds());this.emit('action',{action:'drag-end',bounds:this.window.getBounds()})}
 tick(){if(this.closed)return;const p=this.screen.getCursorScreenPoint();if(this.drag){const d=this.drag;this.window.setPosition(Math.round(d.bounds.x+p.x-d.cursor.x),Math.round(d.bounds.y+p.y-d.cursor.y))}const b=this.window.getBounds(),q={x:p.x-b.x,y:p.y-b.y},ignore=!this.shaped&&!this.drag&&!this.regions.some(r=>contains(r,q));if(ignore!==this.ignore){this.ignore=ignore;this.window.setIgnoreMouseEvents(ignore,mouseOptions(this.platform))}}
 update(s){if(!this.closed)this.window.webContents.send('kujira:state',s)}
 dispose(){if(this.closed)return;this.closed=true;this.clock.clearInterval(this.poll);for(const e of ['display-removed','display-metrics-changed'])this.screen.removeListener(e,this.displayChanged);this.removeAllListeners()}
 close(){if(!this.closed)this.window.close()}
}module.exports={PetWindow,constrain,contains,applyPosition};
