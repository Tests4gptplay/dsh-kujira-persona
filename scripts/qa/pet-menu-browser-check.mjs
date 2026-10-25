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
html,body{margin:0;width:100%;height:100%;font:14px system-ui}body{background:#eee;--dsw-radius-lg:12px;--dsw-radius-md:8px;--dsw-radius-sm:4px;--dsw-menu-backdrop-filter:none;--dsw-alias-bg-base:#fff;--dsw-menu-surface-fill:rgb(248,249,250);--dsw-alias-label-primary:rgb(22,24,28);--dsw-alias-border-l1:#ddd;--dsw-alias-border-l2:#bbb;--dsw-alias-interactive-bg-hover:#e3e5e7;--dsw-elevation-prominent:0 3px 15px #0003}body[data-theme=dark]{--dsw-alias-bg-base:#25262a;--dsw-menu-surface-fill:rgb(67,69,74);--dsw-alias-label-primary:rgb(240,242,245);--dsw-alias-border-l1:#555;--dsw-alias-interactive-bg-hover:#606267}button{font:inherit;color:inherit}
</style><div id="root"></div><script src="/fixture.js"></script><script src="/client.js"></script>`
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');let data,type='text/javascript'
 if(u.pathname==='/'){data=html;type='text/html'}
 else if(u.pathname==='/client.js')data=await readFile(join(root,'pet/client.js'))
 else if(u.pathname==='/fixture.js'||u.pathname==='/fixture.css'){data=await readFile(join(output,u.pathname.slice(1)));if(u.pathname.endsWith('.css'))type='text/css'}
 else if(u.pathname==='/api/kujira-pet/art'){const manifest=artFor(u.searchParams.get('id'));data=JSON.stringify({manifest,urls:Object.fromEntries(Object.keys(manifest.sheets).map(sheet=>[sheet,'/api/kujira-pet/sprite?id='+encodeURIComponent(u.searchParams.get('id'))+'&sheet='+encodeURIComponent(sheet)]))});type='application/json'}
 else if(u.pathname==='/api/kujira-pet/sprite'){const manifest=artFor(u.searchParams.get('id'));data=await readFile(join(root,'pet/assets',manifest.sheets[u.searchParams.get('sheet')]));type='image/png'}
 else if(['/api/kujira-pet/sprite-canvas.js','/api/kujira-pet/animation.js'].includes(u.pathname))data=await readFile(join(root,'pet',u.pathname.split('/').at(-1)))
 else {res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':type});res.end(data)
 }catch(error){res.writeHead(500);res.end(String(error))}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const report={kind:'real-react-public-dsh-menu',packageVersion:require('@deepseek-ai/dsh-client-ui-primitives/package.json').version,checks:[],pageErrors:[],limits:['A standalone host fixture, not a running full DSH application','Windows WPF not exercised by this browser check']}
let browser
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.KUJIRA_CHROMIUM_PATH||undefined,args:['--no-sandbox']})
 const page=await browser.newPage({viewport:{width:900,height:720},locale:'zh-CN'});page.setDefaultTimeout(6000);page.on('pageerror',e=>report.pageErrors.push(e.message))
 await page.goto('http://127.0.0.1:'+server.address().port)
 const pet=page.locator('[data-kujira-pet]'),bubble=page.locator('[data-kujira-drag=bubble]'),sprite=page.locator('[data-kujira-drag=sprite]'),menu=page.getByRole('menu')
 const settle=async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
 const patch=async config=>{await page.evaluate(config=>window.QA.patch(config),config);await settle()}
 const box=locator=>locator.boundingBox()
 const fits=async()=>{const r=await box(pet),v=page.viewportSize();assert(r&&r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,JSON.stringify({r,v}))}
 const open=async()=>{await bubble.click({button:'right',position:{x:16,y:18}});await menu.waitFor({state:'visible'});assert.equal(await menu.getByRole('menuitem').count(),3)}
 const drag=async(dx,dy)=>{const r=await box(bubble);await page.mouse.move(r.x+18,r.y+18);await page.mouse.down();await page.mouse.move(r.x+18+dx,r.y+18+dy,{steps:8});await page.mouse.up();await settle()}
 await pet.waitFor();await settle();const beforeRightClick=await box(pet);await open();assert.deepEqual(await box(pet),beforeRightClick)
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
 await page.setViewportSize({width:320,height:150});await patch({showPet:true});await fits();assert((await box(bubble)).height>20,'Tiny viewport must retain a usable bubble');await patch({showPet:false});
 report.checks.push('scaled long bubble fits small viewport; 150px-height viewport restores sprite without overflow')
 await page.setViewportSize({width:900,height:720});await page.evaluate(()=>QA.task('working','主题检查'));await patch({bubbleScale:1,x:40,y:40});await open()
 const textColor=()=>menu.getByRole('menuitem').first().evaluate(el=>getComputedStyle(el).color)
 const light=await textColor();await page.evaluate(()=>QA.theme(true));await settle();const dark=await textColor();assert.notEqual(light,dark);assert.equal(dark,'rgb(240, 242, 245)')
 await page.waitForFunction(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1)?.payload.foreground==='#f0f2f5');const themeCount=await page.evaluate(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').length);await page.evaluate(()=>QA.reconnect());await page.waitForFunction(count=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').length>count,themeCount);
 await page.evaluate(()=>document.body.style.setProperty('--dsw-alias-label-primary','#ddeeff'));await page.waitForFunction(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1)?.payload.foreground==='#ddeeff');await page.evaluate(()=>document.body.style.removeProperty('--dsw-alias-label-primary'));await page.waitForFunction(()=>QA.calls.filter(x=>x.method==='kujira-pet/menu-theme').at(-1)?.payload.foreground==='#f0f2f5');
 await page.screenshot({path:join(output,'dark-menu.png')});await page.keyboard.press('Escape');await open();await menu.getByRole('menuitem',{name:'全部关闭',exact:true}).click();await pet.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>QA.state.config.enabled),false)
 await patch({enabled:true,showPet:true});await pet.waitFor();await settle();await fits()
 report.checks.push('public Menu inherits light/dark host tokens; native palette re-sent after reconnect; close all disables only companion; settings restore')
 assert.deepEqual(report.pageErrors,[]);report.passed=true
}catch(error){report.passed=false;report.error=error.stack;throw error}finally{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify(report,null,2))}
