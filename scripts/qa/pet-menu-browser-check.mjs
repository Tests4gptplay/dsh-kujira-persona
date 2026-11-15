/** Real React + unmodified public DSH Menu browser QA. Not shipped in npm package. */
import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {artFor} from '../../pet/art.js'
const root=fileURLToPath(new URL('../../',import.meta.url))
const deps=resolve(process.env.DSH_BROWSER_TEST_ROOT??root),require=createRequire(join(deps,'package.json'))
const {build}=require('esbuild'),{chromium}=require('playwright')
const output=resolve(process.env.DSH_BROWSER_TEST_OUTPUT??join(root,'../evidence/browser-menu'));await mkdir(output,{recursive:true})
await build({entryPoints:[fileURLToPath(new URL('./pet-menu-browser-fixture.js',import.meta.url))],bundle:true,format:'iife',platform:'browser',outfile:join(output,'fixture.js'),nodePaths:[join(deps,'node_modules')],loader:{'.module.css':'local-css','.woff':'file','.woff2':'file','.ttf':'file'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'warning'})
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><style>
html,body{margin:0;width:100%;height:100%;font:14px system-ui}html{--dsh-frame-top-clearance:28px;--dsh-frame-overlay-top:48px}body{background:#eee;--dsw-radius-lg:12px;--dsw-radius-md:8px;--dsw-radius-sm:4px;--dsw-menu-backdrop-filter:none;--dsw-alias-bg-base:#fff;--dsw-menu-surface-fill:rgb(248,249,250);--dsw-alias-label-primary:rgb(22,24,28);--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#bbb;--dsw-alias-interactive-bg-hover:#e3e5e7;--dsw-elevation-prominent:0 3px 15px #0003}body[data-theme=dark]{--dsw-alias-bg-base:#25262a;--dsw-menu-surface-fill:rgb(67,69,74);--dsw-alias-label-primary:rgb(240,242,245);--dsw-alias-border-l1:#555;--dsw-alias-interactive-bg-hover:#606267}button{font:inherit;color:inherit}
</style><div id="root"></div><script src="/fixture.js"></script><script src="/client.js"></script>`
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');let data,type='text/javascript'
 if(u.pathname==='/'){data=html;type='text/html'}
 else if(u.pathname==='/client.js')data=await readFile(join(root,'pet/client.js'))
 else if(u.pathname==='/fixture.js'||u.pathname==='/fixture.css'){data=await readFile(join(output,u.pathname.slice(1)));if(u.pathname.endsWith('.css'))type='text/css'}
 else if(u.pathname==='/api/kujira-pet/art'){const manifest=artFor(u.searchParams.get('id'));data=JSON.stringify({manifest,urls:Object.fromEntries(Object.keys(manifest.sheets).map(sheet=>[sheet,'/api/kujira-pet/sprite?id='+encodeURIComponent(u.searchParams.get('id'))+'&sheet='+encodeURIComponent(sheet)]))});type='application/json'}
 else if(u.pathname==='/api/kujira-pet/sprite'){const manifest=artFor(u.searchParams.get('id'));data=await readFile(join(root,'pet/assets',manifest.sheets[u.searchParams.get('sheet')]));type='image/png'}
 else if(['/api/kujira-pet/sprite-canvas.js','/api/kujira-pet/animation.js','/api/kujira-pet/ui-messages.js','/api/kujira-pet/account-credentials.js','/api/kujira-pet/account-options.js'].includes(u.pathname))data=await readFile(join(root,'pet',u.pathname.split('/').at(-1)))
 else {res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':type});res.end(data)
 }catch(error){res.writeHead(500);res.end(String(error))}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const report={kind:'real-react-public-dsh-menu',packageVersion:require('@deepseek-ai/dsh-client-ui-primitives/package.json').version,checks:[],positions:[],trackingFrames:[],pageErrors:[],limits:['A standalone host fixture, not a running full DSH application','Windows WPF not exercised by this browser check']}
let browser,page
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.KUJIRA_CHROMIUM_PATH||undefined,args:['--no-sandbox']})
 page=await browser.newPage({viewport:{width:900,height:720},locale:'zh-CN'});page.setDefaultTimeout(6000);page.on('pageerror',e=>report.pageErrors.push(e.message))
 await page.goto('http://127.0.0.1:'+server.address().port)
 const pet=page.locator('[data-kujira-pet]'),bubble=page.locator('[data-kujira-drag=bubble]'),sprite=page.locator('[data-kujira-drag=sprite]'),menu=page.getByRole('menu')
 const settle=async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
 const patch=async config=>{if(Object.hasOwn(config,'x')||Object.hasOwn(config,'y'))config={...config,pageRight:null,pageBottom:null};await page.evaluate(config=>window.QA.patch(config),config);await settle()}
 const box=locator=>locator.boundingBox()
 const fits=async()=>{const r=await box(pet),v=page.viewportSize();assert(r&&r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,JSON.stringify({r,v}))}
 const open=async(position={x:16,y:18})=>{
  await bubble.click({button:'right',position});await menu.waitFor({state:'visible'});await settle();assert.equal(await menu.getByRole('menuitem').count(),3)
  const point=await page.evaluate(()=>QA.contextPoint),rect=await box(menu),viewport=page.viewportSize()
  const below=Math.max(point.y+4,48),maxTop=viewport.height-rect.height-12
  // Older Menu clamps its JS placement; the current CSS anchor contract may
  // flip above the same click when the below placement cannot fit.
  const expected={x:Math.min(Math.max(point.x,12),viewport.width-rect.width-12),tops:[Math.min(below,maxTop)]}
  if(below>maxTop)expected.tops.push(Math.max(48,point.y-rect.height-4))
  assert(Math.abs(rect.x-expected.x)<=1&&expected.tops.some(y=>Math.abs(rect.y-y)<=1),JSON.stringify({message:'Menu must follow the right-click point and clamp or flip at viewport edges',point,expected,rect}))
  return {point,rect}
 }
 const drag=async(dx,dy)=>{const r=await box(bubble);await page.mouse.move(r.x+18,r.y+18);await page.mouse.down();await page.mouse.move(r.x+18+dx,r.y+18+dy,{steps:8});await page.mouse.up();await settle()}
 const positions=async()=>{
  const initial=await page.evaluate(()=>QA.state.config),contract=report.packageVersion
  for(const [name,config] of [['middle',{x:250,y:220}],['bottom-right',{x:900,y:720}],['top-left',{x:0,y:0}]]){
   await patch({...config,showPet:false,bubble:'always'});const opened=await open(name==='bottom-right'?{x:(await box(bubble)).width-12,y:18}:undefined);report.positions.push({contract,name,...opened})
   if(name==='bottom-right')await page.screenshot({path:join(output,'menu-'+contract+'.png')})
   await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'})
  }
  await patch({showPet:false,bubble:'always',x:170,y:180});const before=await box(pet);await drag(190,150);const after=await box(pet)
  assert(after.x>before.x+100&&after.y>before.y+100,'Position check must move the pet before opening its menu')
  report.positions.push({contract,name:'after-drag',...await open()});await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'})
  await patch(initial)
 }
 const followDrag=async(source)=>{
  const initial=await page.evaluate(()=>QA.state.config),config={showPet:source==='sprite',bubble:'always',x:140,y:source==='sprite'?100:180}
  const hitPoint=async()=>{
   if(source==='bubble'){const rect=await box(bubble);return {x:rect.x+18,y:rect.y+18}}
   await sprite.locator('canvas').waitFor({state:'visible'})
   return sprite.evaluate(element=>{
    const rect=element.getBoundingClientRect()
    for(const y of [.35,.45,.55,.65,.75])for(const x of [.5,.4,.6,.3,.7]){
     const point={x:rect.x+rect.width*x,y:rect.y+rect.height*y},target=document.elementFromPoint(point.x,point.y)
     if(target?.tagName.toLowerCase()==='path'&&element.contains(target))return point
    }
    throw Error('The real sprite silhouette must expose a pointer hit area')
   })
  }
  await patch(config);await open()
  const before=await box(pet),outside=await hitPoint();await page.mouse.move(outside.x,outside.y);await page.mouse.down();await menu.waitFor({state:'hidden'})
  await page.mouse.move(outside.x+20,outside.y+20);await page.mouse.up();await settle()
  assert((await box(pet)).x>before.x+10,'Ordinary pointerdown must close the menu and still allow dragging')
  report.checks.push(source+' outside pointerdown closes the menu before a new pet drag')
  await patch(config);const start=await hitPoint()
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+20,start.y+20);await settle()
  try{
   // Open while the existing real left-button drag remains active. Starting a
   // new drag outside an already open menu intentionally closes it, as above.
   await page.mouse.down({button:'right'});await menu.waitFor({state:'visible'});await settle()
   const basePet=await box(pet),baseMenu=await box(menu),point=await page.evaluate(()=>QA.contextPoint)
   assert(Math.abs(baseMenu.x-point.x)<=1&&Math.abs(baseMenu.y-point.y-4)<=1,'Open drag menu at the actual current pointer')
   let previous=basePet
   for(let frame=1;frame<=8;frame++){
    await page.mouse.move(start.x+20+frame*12,start.y+20+frame*10);await settle();assert.equal(await menu.isVisible(),true)
    const currentPet=await box(pet),currentMenu=await box(menu)
    assert(currentPet.x>previous.x+8&&currentPet.y>previous.y+6,'Each checked frame must actually move the pet')
    assert(Math.abs((currentMenu.x-baseMenu.x)-(currentPet.x-basePet.x))<=1&&Math.abs((currentMenu.y-baseMenu.y)-(currentPet.y-basePet.y))<=1,JSON.stringify({message:'An open menu must move with its pet on every drag frame',frame,basePet,baseMenu,currentPet,currentMenu}))
    report.trackingFrames.push({source,frame,pet:currentPet,menu:currentMenu});previous=currentPet
   }
   await page.screenshot({path:join(output,'menu-follow-drag-'+source+'-'+report.packageVersion+'.png')})
  }finally{await page.mouse.up({button:'right'});await page.mouse.up();await settle()}
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await patch(initial)
  report.checks.push(source+' menu opened during an active pointer drag follows all eight subsequent movement frames')
 }
 await pet.waitFor();await settle();await positions();report.checks.push('public Menu follows exact pointer coordinates, moved pet and viewport edges')
 await followDrag('bubble');await followDrag('sprite')
 const beforeRightClick=await box(pet);await open();assert.deepEqual(await box(pet),beforeRightClick)
 assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),['隐藏桌宠','隐藏气泡','全部关闭'])
 await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await open();await page.mouse.click(5,5);await menu.waitFor({state:'hidden'})
 report.checks.push('three public Menu items; Escape and outside click close')
 await open();await menu.getByRole('menuitem',{name:'隐藏桌宠',exact:true}).click();await sprite.waitFor({state:'detached'});await settle()
 let p=await box(pet),b=await box(bubble);assert(Math.abs(p.height-b.height)<1);assert(Math.abs(p.width-b.width)<1)
 await drag(0,1000);p=await box(pet);assert(Math.abs(p.y+p.height-720)<1)
 await open();const mr=await box(menu);assert(mr.x>=0&&mr.y>=0&&mr.x+mr.width<=900&&mr.y+mr.height<=720)
 await menu.getByRole('menuitem',{name:'显示桌宠',exact:true}).click();await sprite.waitFor();await settle();await fits()
 report.checks.push('hidden sprite absent from DOM/hit/layout; bubble reaches bottom; restoration and edge menu fit')
 await patch({showPet:false,bubble:'tasks'});await page.evaluate(()=>QA.task('working'));await open();await menu.getByRole('menuitem',{name:'隐藏气泡',exact:true}).click();await pet.waitFor({state:'detached'})
 await patch({showPet:true});await sprite.click({button:'right',position:{x:80,y:80}});await menu.getByRole('menuitem',{name:'显示气泡',exact:true}).click();assert.equal(await page.evaluate(()=>QA.state.config.bubble),'tasks')
 await patch({showPet:false});await page.evaluate(()=>QA.task('working'));await settle();b=await box(bubble);await page.mouse.move(b.x+18,b.y+18);await page.mouse.down();await page.mouse.move(b.x+30,b.y+30);await page.evaluate(()=>QA.task('idle'));await pet.waitFor({state:'detached'});await page.mouse.up();await page.evaluate(()=>QA.task('working'));await pet.waitFor();await settle();await drag(0,1000);p=await box(pet);assert(Math.abs(p.y+p.height-720)<1)
 report.checks.push('tasks mode survives hide/show; both hidden leaves no root; interrupted bubble drag recovers')
 await patch({x:null,y:null,bubble:'always',showPet:false,bubbleScale:1.4});await page.setViewportSize({width:320,height:260});await page.evaluate(()=>QA.task('working','LongUnbrokenWord'.repeat(150)));await settle();await fits();await drag(0,1000);p=await box(pet);assert(Math.abs(p.y+p.height-260)<1)
 await page.setViewportSize({width:320,height:150});await patch({showPet:true});assert(Math.abs((await box(sprite)).width-190*await page.evaluate(()=>QA.state.config.scale))<1,'Small viewport must not silently shrink the configured pet');await patch({showPet:false});await fits();assert((await box(bubble)).height>20,'Bubble-only mode remains usable in the tiny viewport');
 report.checks.push('scaled long bubble fits small viewport; tiny viewport preserves requested sprite scale and bubble-only layout')
 await page.setViewportSize({width:900,height:720});await page.evaluate(()=>QA.task('working','主题检查'));await patch({bubbleScale:1,x:40,y:40});await open()
 const textColor=()=>menu.getByRole('menuitem').first().evaluate(el=>getComputedStyle(el).color)
 const light=await textColor();await page.evaluate(()=>QA.theme(true));await settle();const dark=await textColor();assert.notEqual(light,dark);assert.equal(dark,'rgb(240, 242, 245)')
 await page.waitForFunction(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1)?.payload.foreground==='#f0f2f5');const themeCount=await page.evaluate(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').length);await page.evaluate(()=>QA.reconnect());await page.waitForFunction(count=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').length>count,themeCount);
 await page.evaluate(()=>document.body.style.setProperty('--dsw-alias-label-primary','#ddeeff'));await page.waitForFunction(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1)?.payload.foreground==='#ddeeff');await page.evaluate(()=>document.body.style.removeProperty('--dsw-alias-label-primary'));await page.waitForFunction(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1)?.payload.foreground==='#f0f2f5');
 // Color 4 alpha must remain translucent in the public Menu, but composite to opaque RGB for WPF.
 const beforeAlphaTheme=await page.evaluate(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').length)
 await page.evaluate(()=>{document.body.style.setProperty('--dsw-alias-bg-base','#102030');document.body.style.setProperty('--dsw-menu-surface-fill','color-mix(in srgb, white 25%, transparent)')})
 await page.waitForFunction(count=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').length>count,beforeAlphaTheme)
 const alphaBackground=await page.evaluate(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1).payload.background)
 assert.match(alphaBackground,/^#[0-9a-f]{6}$/i)
 const channels=alphaBackground.slice(1).match(/../g).map(hex=>parseInt(hex,16))
 assert(channels.every((channel,i)=>Math.abs(channel-[76,88,100][i])<=1),'Color 4 alpha composite: '+alphaBackground)
 assert(await menu.evaluate(el=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d')
   return Array.from(el.querySelectorAll('*')).some(node=>{context.clearRect(0,0,1,1);context.fillStyle=getComputedStyle(node).backgroundColor;context.fillRect(0,0,1,1);const rgba=context.getImageData(0,0,1,1).data;return rgba[0]===255&&rgba[1]===255&&rgba[2]===255&&Math.abs(rgba[3]-64)<=1})
 }),'Public Menu must retain the same 25%-alpha white surface token')
 await page.evaluate(()=>{document.body.style.removeProperty('--dsw-alias-bg-base');document.body.style.removeProperty('--dsw-menu-surface-fill')})
 await page.waitForFunction(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1)?.payload.background==='#43454a')
 report.checks.push('Color 4 color-mix alpha stays translucent in Menu and composites correctly to opaque native palette')
 await page.screenshot({path:join(output,'dark-menu.png')});await page.keyboard.press('Escape');await open();await menu.getByRole('menuitem',{name:'全部关闭',exact:true}).click();await pet.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>QA.state.config.enabled),false)
 await patch({enabled:true,showPet:true});await pet.waitFor();await settle();await fits()
 report.checks.push('public Menu inherits light/dark host tokens; native palette re-sent after reconnect; close all disables only companion; settings restore')
 assert.deepEqual(report.pageErrors,[]);report.passed=true
}catch(error){report.passed=false;report.error=error.stack;if(page)try{await page.screenshot({path:join(output,'failure.png')});await writeFile(join(output,'failure.html'),await page.content())}catch{}throw error}finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(report,null,2))}
