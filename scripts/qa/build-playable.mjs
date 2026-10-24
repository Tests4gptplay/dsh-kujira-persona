import {readFile,writeFile,mkdir,copyFile,readdir,rm} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {resolve,join,basename} from 'node:path'
import {createHash} from 'node:crypto'

const root=fileURLToPath(new URL('../../',import.meta.url))
const output=resolve(process.argv[2]??join(root,'../kujira-trial'))
const marker=join(output,'trial-manifest.json')
let previous
try{previous=JSON.parse(await readFile(marker,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
const existing=await readdir(output).catch(error=>{if(error.code==='ENOENT')return [];throw error})
if(existing.length&&previous?.kind!=='kujira-offline-action-trial')throw new Error('Output directory is not an existing Kujira trial; choose an empty directory')
const {ART}=await import(pathToFileURL(join(root,'pet/art.js')).href)
const characters=[['gpt','GPT'],['deepseek','DeepSeek'],['gemini','Gemini'],['claude','Claude'],['grok','Grok'],['glm','GLM'],['kimi','Kimi'],['qwen','Qwen'],['minimax','MiniMax'],['llama','Llama'],['doubao','豆包'],['mistral','Mistral'],['hunyuan','混元'],['mimo','MiMo'],['unknown','未定义模型']].map(([id,name])=>({id,name,art:id==='unknown'?'stella':id}))
const art=Object.fromEntries(characters.filter(c=>ART[c.art]).map(c=>{
  const value=ART[c.art],used=new Set(Object.values(value.clips).flatMap(clip=>clip.frames.map(frame=>frame.sheet)))
  return [c.art,{...value,sheets:Object.fromEntries(Object.entries(value.sheets).filter(([name])=>used.has(name)))}]
}))
const files=[...new Set(Object.values(art).flatMap(value=>Object.values(value.sheets)))].sort()
if(files.some(name=>basename(name)!==name||!name.endsWith('.png')))throw new Error('Trial sheets must be local PNG file names')
const originalPlayer=await readFile(join(root,'pet/animation.js'),'utf8')
const player=originalPlayer.replace(/^export class AnimationPlayer/m,'class AnimationPlayer')
if(/^\s*(?:import|export)\s/m.test(player))throw new Error('AnimationPlayer now has module dependencies; update the offline builder before shipping')
await mkdir(join(output,'assets'),{recursive:true})
for(const name of files)await copyFile(join(root,'pet/assets',name),join(output,'assets',name))
for(const name of previous?.sheets??[])if(!files.includes(name)&&basename(name)===name)await rm(join(output,'assets',name),{force:true})
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c')
const html=String.raw`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kujira · 动作试玩</title>
<meta name="description" content="Kujira 离线动作试玩与状态模拟。">
<style>
:root{color-scheme:light;--page:#f3f0e8;--panel:#fffdf8;--ink:#243d3b;--muted:#6b7d77;--line:#dedfd3;--accent:#466d5a;--soft:#e8efdf;--stage:#edf2e6;--shadow:0 14px 42px #384a3b0a;--dot:#768b6826}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.55}body[data-theme=dark]{color-scheme:dark;--page:#17231f;--panel:#22302a;--ink:#edf1df;--muted:#acbbaa;--line:#3f5044;--accent:#b9d694;--soft:#394b36;--stage:#1b2923;--shadow:0 14px 42px #0002;--dot:#a5bc8b23}button,input{font:inherit}button{cursor:pointer;border:1px solid var(--line);border-radius:11px;color:var(--ink);background:var(--panel);padding:9px 12px;font-size:13px}button:hover:not(:disabled){border-color:var(--accent);background:var(--soft)}button:focus-visible,input:focus-visible,canvas:focus-visible{outline:3px solid var(--accent);outline-offset:3px}button[aria-pressed=true]{background:var(--soft);border-color:var(--accent);font-weight:650}button:disabled{opacity:.43;cursor:default}.wrap{max-width:1110px;margin:0 auto;padding:34px 28px 24px}.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}header{display:flex;align-items:center;justify-content:space-between;gap:22px;margin-bottom:25px}h1{font-size:31px;font-weight:600;letter-spacing:-.05em;margin:4px 0 5px}h1 span{font-size:16px;font-weight:450;letter-spacing:0;margin-left:13px;color:var(--muted)}.intro{font-size:13px;color:var(--muted);margin:0}.offline{white-space:nowrap;font-size:12px;padding:8px 13px;border:1px solid var(--line);border-radius:999px;background:var(--panel)}.offline:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:8px}.layout{display:grid;grid-template-columns:285px minmax(0,1fr);gap:20px}.panel,.viewer{background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow)}.panel{padding:21px}h2{font-size:13px;letter-spacing:.02em;margin:0 0 13px;font-weight:650}.label-row{display:flex;align-items:center;justify-content:space-between}.small{font-size:11px;color:var(--muted)}.characters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.characters button{padding:8px 3px;font-size:12px;min-width:0}.characters button:last-child{grid-column:1/-1}.divider{height:1px;background:var(--line);margin:21px 0}.states{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.states button{padding:8px 3px;font-size:12px}.primary{width:100%;margin-top:13px;background:var(--ink);color:var(--panel);border-color:var(--ink);font-weight:600}.primary:hover:not(:disabled){background:var(--accent);color:var(--page)}.primary[aria-pressed=true]{color:var(--ink)}.helper{color:var(--muted);font-size:11px;margin:11px 0 0}.viewer{overflow:hidden;display:flex;flex-direction:column}.viewer-head{padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:15px}.name{font-size:18px;font-weight:650}.status{font-size:12px;color:var(--muted);margin-top:2px}.theme{display:flex;gap:5px}.theme button{font-size:11px;padding:5px 10px;border-radius:9px}.stage{height:440px;min-height:350px;background-color:var(--stage);background-image:radial-gradient(var(--dot) .8px,transparent .8px);background-size:19px 19px;position:relative;overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);touch-action:none}.stage:before{content:"动作试玩 · 状态模拟";position:absolute;top:16px;left:20px;color:var(--muted);font-size:10px;letter-spacing:.08em}.ground{position:absolute;bottom:39px;left:18%;right:18%;height:1px;background:linear-gradient(90deg,transparent,var(--line),transparent)}#pet{position:absolute;width:220px;height:261.25px;user-select:none;touch-action:none;cursor:grab}#pet.dragging{cursor:grabbing}canvas{display:block;width:100%;height:100%;touch-action:none}.stage-message{position:absolute;bottom:11px;left:18px;right:18px;min-height:18px;text-align:center;font-size:11px;color:var(--muted);pointer-events:none}.load-error{position:absolute;inset:80px 30px auto;text-align:center;color:var(--muted);font-size:13px}.playback{display:flex;align-items:center;gap:17px;flex-wrap:wrap;padding:16px 21px}.playback button{font-size:12px;padding:7px 13px}.size{display:flex;align-items:center;gap:10px;flex:1;min-width:175px;font-size:12px;color:var(--muted)}.size span{white-space:nowrap}.size input{width:100%;min-width:60px;accent-color:var(--accent)}.size output{font-variant-numeric:tabular-nums;min-width:37px}.reduced{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;white-space:nowrap}.reduced input{accent-color:var(--accent)}.actions{padding:0 21px 18px;display:flex;gap:7px;flex-wrap:wrap}.actions button{font-size:12px;padding:7px 11px}.actions button:last-child{margin-left:auto}.foot{display:flex;justify-content:space-between;gap:20px;font-size:11px;color:var(--muted);margin-top:18px}.foot p{margin:0;max-width:690px}.step-label{color:var(--accent);font-size:11px;font-weight:500}.available-note{min-height:34px}.sr-only{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden} @media(max-width:760px){.wrap{padding:20px 15px}.layout{grid-template-columns:1fr}.panel{padding:18px}.characters{grid-template-columns:repeat(4,minmax(0,1fr))}.characters button:last-child{grid-column:span 2}.states{grid-template-columns:repeat(3,minmax(0,1fr))}.divider{margin:17px 0}header{align-items:flex-start}.offline{font-size:10px;padding:7px 10px}h1{font-size:27px}h1 span{display:block;margin:0;font-size:13px}.stage{height:390px}.foot{flex-direction:column;gap:5px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style></head><body data-theme="light"><div class="wrap">
<header><div><div class="eyebrow">A little company</div><h1>Kujira<span>动作试玩</span></h1><p class="intro">挑一个角色，看她进入工作；点一下、拖一拖，试试她的反应。</p></div><div class="offline">离线 · 状态模拟</div></header>
<main class="layout"><section class="panel" aria-label="试玩控制"><div class="label-row"><h2>选择角色</h2><span class="small">01</span></div><div class="characters" id="characters"></div><p class="helper available-note" id="availability"></p>
<div class="divider"></div><div class="label-row"><h2>任务阶段</h2><span class="small">02</span></div><div class="states" id="states"></div><button class="primary" id="simulate" aria-pressed="false">▷ 模拟一轮工作</button><p class="helper">这是动作与状态的模拟播放，不会执行 DSH 任务。</p></section>
<section class="viewer" aria-label="角色动作预览"><div class="viewer-head"><div><div class="name" id="name">GPT</div><div class="status"><span id="status">待机中</span><span class="step-label" id="sequence"></span></div></div><div class="theme" role="group" aria-label="背景颜色"><button data-theme="light" aria-pressed="true">浅色</button><button data-theme="dark" aria-pressed="false">深色</button></div></div>
<div class="stage" id="stage"><div class="ground"></div><div id="pet"><canvas id="canvas" width="320" height="380" tabindex="0" role="button" aria-label="角色；按空格戳一下，可以拖动摆放"></canvas></div><div class="load-error" id="load-error" hidden></div><div class="stage-message" id="message" aria-live="polite">点击头部摸摸她，拖动可以换个位置。</div></div>
<div class="playback"><button id="pause" aria-pressed="false">Ⅱ 暂停</button><label class="size" for="size"><span>大小</span><input id="size" type="range" min="160" max="300" value="220" step="10"><output id="size-value">220</output></label><label class="reduced"><input type="checkbox" id="reduced">减少动态</label></div>
<div class="actions"><button data-action="head_pat">摸摸头</button><button data-action="poke">戳一下</button><button data-action="tail">碰尾巴</button><button id="reset">放回中间</button></div></section></main>
<footer class="foot"><p>部分任务阶段共用已绘制的中性动作。触摸和拖放反应按当前角色已有的动作开放。</p><p>双击打开 · 无需登录</p></footer></div>
<script>
'use strict';
/* PLAYER_SOURCE */
const ART=/* ART_DATA */;
const CHARACTERS=/* CHARACTER_DATA */;
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d'),pet=$('pet'),stage=$('stage');
const STATES=[['idle','待机'],['thinking','思考'],['searching','查找'],['editing','编辑'],['commanding','执行'],['testing','检查'],['waiting','等待'],['success','完成'],['error','出错']];
const LABELS={idle:'待机中',thinking:'正在思考',searching:'查找和阅读',editing:'正在编辑',commanding:'执行命令',testing:'检查结果',waiting:'等你确认',success:'工作完成',error:'遇到了问题',working:'通用工作动作',dragging:'拖动中',landing:'站稳啦',head_pat:'摸摸头',poke:'戳一下',tail:'碰到尾巴了',stretch:'伸个懒腰',yawn:'打个哈欠',neutral_success:'完成 · 中性动作',neutral_error:'出错 · 中性动作'};
let character,manifest,player,images={},loadId=0,loaded=false,lastKey='',selectedState='idle',signal=0,pulse=0;
let timer=null,clock=0,wall=performance.now(),playing=true,simulation=null,pointer=null;
const config={activity:'normal',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
$('reduced').checked=config.reducedMotion;
const now=()=>clock+(playing?performance.now()-wall:0);
const button=(text,attrs={})=>{const el=document.createElement('button');el.textContent=text;for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el};
for(const item of CHARACTERS){const el=button(item.name,{'data-character':item.id,'aria-pressed':'false'});el.disabled=!ART[item.art];if(el.disabled)el.title='素材准备中';el.onclick=()=>selectCharacter(item);$('characters').append(el)}
for(const [id,label] of STATES){const el=button(label,{'data-state':id,'aria-pressed':'false'});el.onclick=()=>setState(id);$('states').append(el)}
function cancelSimulation(){simulation=null;$('simulate').setAttribute('aria-pressed','false');$('simulate').textContent='▷ 模拟一轮工作';$('sequence').textContent=''}
function taskFor(id){if(id==='success')return{phase:'completed',activity:'idle',signal:++signal,pulse:{id:++pulse,kind:'success'}};return{phase:['searching','editing','commanding','testing'].includes(id)?'working':id,activity:id,signal:++signal,pulse:null}}
function applyState(id){selectedState=id;player.update(taskFor(id),config,now());document.querySelectorAll('[data-state]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.state===id)));$('status').textContent=LABELS[id];updateMessage()}
function setState(id){if(!player)return;cancelSimulation();applyState(id);render()}
function updateMessage(){if(!manifest)return;const source=manifest.fallbackSources?.[selectedState];$('message').textContent=source?(source==='idle'?'此状态使用已有的中性待机动作。':'此状态使用已有的通用工作动作。'):(manifest.clips.head_pat?'点击头部摸摸她，拖动可以换个位置。':'可以拖动摆放，也可以切换任务阶段。')}
async function selectCharacter(item){
  cancelSimulation();clearTimeout(timer);if(pointer)finishPointer(null,true);const id=++loadId;loaded=false;lastKey='';character=item;manifest=ART[item.art];player=new AnimationPlayer(manifest,{now:now()});images={};
  canvas.width=manifest.canvas[0];canvas.height=manifest.canvas[1];ctx.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.character=item.id;delete canvas.dataset.clip;delete canvas.dataset.frame;
  $('name').textContent=item.name;$('load-error').hidden=false;$('load-error').textContent='正在载入角色…';
  document.querySelectorAll('#characters [data-character]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.character===item.id)));
  $('availability').textContent=manifest.clips.head_pat?'已有任务动作、触摸反应与拖放动作。':'已有标准任务动作；未完成的触摸反应暂不开放。';
  document.querySelectorAll('[data-action]').forEach(el=>el.disabled=!manifest.clips[el.dataset.action]||config.reducedMotion);
  resetPosition();applyState('idle');
  try{const entries=await Promise.all(Object.entries(manifest.sheets).map(([name,file])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([name,image]);image.onerror=()=>reject(new Error('图片没有载入，请将 index.html 和 assets 文件夹保留在一起。'));image.src='assets/'+encodeURIComponent(file)})));if(id!==loadId)return;images=Object.fromEntries(entries);loaded=true;$('load-error').hidden=true;render()}
  catch(error){if(id===loadId){$('load-error').textContent=error.message;$('load-error').hidden=false}}
}
function render(){
  clearTimeout(timer);if(!loaded||!player)return;const time=now();
  if(simulation&&time>=simulation.nextAt){simulation.index++;if(simulation.index>=simulation.steps.length){cancelSimulation();applyState('idle')}else{applyState(simulation.steps[simulation.index]);simulation.nextAt=time+2000;$('sequence').textContent=' · '+(simulation.index+1)+' / '+simulation.steps.length}}
  const state=player.tick(time);if(state.key!==lastKey){ctx.clearRect(0,0,canvas.width,canvas.height);for(const {frame,opacity} of state.layers){ctx.globalAlpha=opacity;ctx.drawImage(images[frame.sheet],...frame.rect,...(frame.at??[0,0]),...(frame.size??frame.rect.slice(2)))}ctx.globalAlpha=1;lastKey=state.key;canvas.dataset.clip=state.clip;canvas.dataset.frame=String(state.index);$('status').textContent=LABELS[state.clip]??LABELS[selectedState]}
  const delay=Math.min(state.nextDelay??Infinity,simulation?Math.max(1,simulation.nextAt-time):Infinity);if(playing&&Number.isFinite(delay))timer=setTimeout(render,Math.max(1,Math.ceil(delay)))
}
$('pause').onclick=()=>{clock=now();wall=performance.now();playing=!playing;$('pause').setAttribute('aria-pressed',String(!playing));$('pause').textContent=playing?'Ⅱ 暂停':'▷ 播放';render()};
$('simulate').onclick=()=>{if(!player)return;if(simulation){cancelSimulation();return}const steps=['thinking','searching','editing','commanding','testing','waiting','success'];simulation={steps,index:0,nextAt:now()+2000};$('simulate').textContent='■ 停止模拟';$('simulate').setAttribute('aria-pressed','true');$('sequence').textContent=' · 1 / '+steps.length;applyState(steps[0]);if(!playing)$('pause').click();render()};
$('reduced').onchange=()=>{config.reducedMotion=$('reduced').checked;player.update(taskFor(selectedState),config,now());document.querySelectorAll('[data-action]').forEach(el=>el.disabled=!manifest.clips[el.dataset.action]||config.reducedMotion);render()};
document.querySelectorAll('[data-theme]').forEach(el=>{if(el===document.body)return;el.onclick=()=>{document.body.dataset.theme=el.dataset.theme;document.querySelectorAll('.theme [data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)))}});
function interact(name){if(!player)return;if(player.interact(name,now())){render();$('message').textContent=LABELS[name]}else $('message').textContent=config.reducedMotion?'减少动态已开启。':'先等当前动作结束，再试一次。'}
document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>interact(el.dataset.action));
function place(x,y){const w=pet.offsetWidth,h=pet.offsetHeight;pet.style.left=Math.max(0,Math.min(stage.clientWidth-w,x))+'px';pet.style.top=Math.max(18,Math.min(stage.clientHeight-h-20,y))+'px'}
function resetPosition(){pet.style.width=$('size').value+'px';pet.style.height=(Number($('size').value)*380/320)+'px';place((stage.clientWidth-pet.offsetWidth)/2,stage.clientHeight-pet.offsetHeight-38)}
$('reset').onclick=resetPosition;$('size').oninput=()=>{$('size-value').value=$('size').value;resetPosition()};new ResizeObserver(resetPosition).observe(stage);
canvas.addEventListener('pointerdown',event=>{if(event.button!==0||pointer)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,left:parseFloat(pet.style.left)||0,top:parseFloat(pet.style.top)||0,dragged:false};canvas.setPointerCapture(event.pointerId);event.preventDefault()});
canvas.addEventListener('pointermove',event=>{if(!pointer||event.pointerId!==pointer.id)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;if(!pointer.dragged&&Math.hypot(dx,dy)>4){pointer.dragged=true;pet.classList.add('dragging');player.startDrag(now())}if(pointer.dragged){place(pointer.left+dx,pointer.top+dy);render()}});
function finishPointer(event,cancelled=false){if(!pointer||(event&&event.pointerId!==pointer.id))return;const old=pointer;pointer=null;pet.classList.remove('dragging');if(canvas.hasPointerCapture(old.id))canvas.releasePointerCapture(old.id);if(old.dragged){player.endDrag(now());render()}else if(!cancelled&&event){const box=canvas.getBoundingClientRect(),x=(event.clientX-box.x)/box.width,y=(event.clientY-box.y)/box.height;interact(y<.45?'head_pat':x>.72&&y>.55?'tail':'poke')}}
canvas.addEventListener('pointerup',event=>finishPointer(event));canvas.addEventListener('pointercancel',event=>finishPointer(event,true));canvas.addEventListener('lostpointercapture',event=>finishPointer(event,true));canvas.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();interact('poke')}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else render()});
selectCharacter(CHARACTERS.find(item=>item.id==='gpt'&&ART[item.art])??CHARACTERS.find(item=>ART[item.art]));
</script></body></html>`
  .replace('/* PLAYER_SOURCE */',player)
  .replace('/* ART_DATA */',json(art))
  .replace('/* CHARACTER_DATA */',json(characters))
await writeFile(join(output,'index.html'),html,'utf8')
await copyFile(join(root,'LICENSE'),join(output,'LICENSE'))
await copyFile(join(root,'NOTICE.md'),join(output,'NOTICE.md'))
await mkdir(join(output,'pet'),{recursive:true})
await copyFile(join(root,'pet/NOTICE.md'),join(output,'pet/NOTICE.md'))
await mkdir(join(output,'docs/development'),{recursive:true})
await copyFile(join(root,'docs/development/NATIVE_QA_20261024.json'),join(output,'docs/development/NATIVE_QA_20261024.json'))
await copyFile(join(root,'pet/dsh-dafeiyu-LICENSE.txt'),join(output,'dsh-dafeiyu-LICENSE.txt'))
await writeFile(join(output,'使用说明.txt'),'Kujira 动作试玩\n\n双击 index.html 打开。请保留旁边的 assets 文件夹。无需 npm、服务器、登录或网络。\n\n可以切换角色和任务阶段、模拟一轮工作、暂停、调整大小及背景、点击或拖动角色。触摸反应只在角色已有相应动作时开放。\n\n这是动作试玩与状态模拟，不会调用模型或执行 DSH 任务。正式插件的任务联动在 DSH 内使用。部分功能阶段共用已有中性动作，不代表每一阶段都有独立原画。\n\n图片为候选美术。来源与第三方角色使用条件见 NOTICE.md 和 pet/NOTICE.md；项目许可见 LICENSE，播放器行为参考部分的 MIT 许可见 dsh-dafeiyu-LICENSE.txt。\n','utf8')
const result={kind:'kujira-offline-action-trial',builtAt:new Date().toISOString(),characters:characters.map(c=>({id:c.id,name:c.name,available:!!art[c.art]})),sheets:files,playerSha256:createHash('sha256').update(originalPlayer).digest('hex')}
await writeFile(marker,JSON.stringify(result,null,2)+'\n','utf8')
console.log(JSON.stringify({output,characters:result.characters.filter(c=>c.available).length,sheets:files.length,playerSha256:result.playerSha256}))
