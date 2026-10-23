import {chromium} from 'playwright'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
await mkdir('evidence',{recursive:true})
const proc=spawn(resolve('payload/node-bin/node'),['qa/run-dsh.mjs'],{stdio:['ignore','pipe','pipe']})
let log='';proc.stdout.on('data',b=>log+=b);proc.stderr.on('data',b=>log+=b)
let browser,page;const cases=[],errors=[],events=[]
try{
 let url
 for(let i=0;i<60;i++){url=log.match(/http:\/\/127\.0\.0\.1:3080\/\?token=\S+/)?.[0];if(url)break;if(proc.exitCode!==null)throw new Error(log);await new Promise(r=>setTimeout(r,500))}
 if(!url)throw new Error('DSH did not start: '+log)
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']})
 const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage()
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')events.push(m.text())})
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800)
 async function shot(name){await page.screenshot({path:`evidence/${name}.png`,fullPage:true});await writeFile(`evidence/${name}.txt`,await page.locator('body').innerText())}
 async function rpc(method,payload={}){return page.evaluate(async({method,payload})=>{const response=await fetch('/kujira-pet/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'qa-'+Date.now(),method,payload})});const v=await response.json();if(!v.result?.ok)throw new Error(JSON.stringify(v));return v.result.value},{method,payload})}
 const record=(name,detail)=>cases.push({name,detail,status:'pass'})
 if(await page.getByRole('button',{name:'Continue',exact:true}).count())await page.getByRole('button',{name:'Continue',exact:true}).click()
 await page.getByRole('button',{name:'Choose workspace',exact:true}).click()
 await page.getByRole('button',{name:'Edit path',exact:true}).click()
 await page.getByRole('textbox').last().fill(resolve('trial/workspace'));await page.getByRole('textbox').last().press('Enter');await page.waitForTimeout(500)
 await page.getByRole('button',{name:'Open',exact:true}).click();await page.waitForTimeout(1000)
 await page.getByRole('button',{name:'Plugins',exact:true}).click()
 await page.getByRole('button',{name:'View AI Gijinka · Shared World, Individual Personas',exact:true}).click()
 await page.getByRole('checkbox',{name:'启用桌宠',exact:true}).waitFor({timeout:15000})
 assert.equal((await rpc('state')).config.enabled,false);assert.equal(await page.locator('[data-kujira-pet]').count(),0);await shot('01-settings-off');record('默认关闭','真实插件详情页显示桌宠设置；没有宠物节点')
 await page.getByRole('combobox',{name:'显示位置',exact:true}).selectOption('page');await page.waitForTimeout(300)
 await page.getByRole('checkbox',{name:'启用桌宠',exact:true}).check();await page.waitForTimeout(800);await shot('02-settings-on')
 await page.getByRole('button',{name:'New session',exact:true}).first().click();await page.waitForTimeout(1000)
 await page.waitForFunction(()=>document.querySelector('[data-kujira-pet]')?.dataset.persona==='deepseek')
 const first=await rpc('state');await page.waitForTimeout(1000);const balance=await rpc('state');await shot('03-deepseek-balance')
 assert.equal(await page.locator('[data-kujira-pet]').count(),1);assert.equal(balance.usage.kind,'balance');assert.equal(balance.usage.status,'ready');assert.equal(balance.usage.balances[0].total,'57.25');record('DeepSeek 余额','真实设置/凭据路径接入 QA 假服务 ¥57.25，不是真实账户')
 await page.evaluate(()=>{window.__qaPet=document.querySelector('[data-kujira-pet]')})
 await page.locator('[contenteditable=true]').fill('读取 sample.txt 并用一句话告诉我里面的内容。')
 await page.getByRole('button',{name:'Send message',exact:true}).click();await page.waitForTimeout(600);await shot('04-task-running')
 await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:45000});await page.waitForTimeout(500);await shot('05-task-complete')
 const completed=await rpc('state');assert.equal(completed.task.phase,'completed');record('真实任务状态','模拟推理请求实际执行 DSH read 工具；完成后宠物显示 completed')
 async function pick(label){await page.getByRole('button',{name:/Select model, current/}).click();await page.getByRole('menuitem',{name:/^Model/}).click();await page.getByText(label,{exact:true}).click();await page.waitForTimeout(800)}
 await pick('gpt-4o Codex [模拟]');await page.waitForFunction(()=>document.querySelector('[data-kujira-pet]')?.dataset.persona==='gpt');await page.waitForTimeout(500)
 const codex=await rpc('state');assert.equal(codex.usage.kind,'codex');assert.deepEqual(codex.usage.windows.map(w=>w.remainingPercent),[65,33]);assert.equal(await page.evaluate(()=>window.__qaPet===document.querySelector('[data-kujira-pet]')),true);await shot('06-gpt-codex-quota');record('单只宠物和套餐联动','通过真实模型选择器切换；同一DOM节点换白龙图，套餐显示模拟65%/33%')
 await pick('gpt-4.1 Codex [模拟]');assert.equal((await rpc('state')).route.art,'gpt');await shot('07-gpt-same-family');record('同家族版本','gpt-4o→gpt-4.1不另建形象或宠物')
 await pick('glm-4.6 API [模拟]');assert.equal((await rpc('state')).route.art,'glm');assert.equal((await rpc('state')).usage.kind,'usage');await shot('08-glm');record('GLM与未知用量','切狐形象；不继承Codex套餐或DeepSeek金额')
 await pick('gemini-2.5-pro API [模拟]');assert.equal((await rpc('state')).route.art,'gemini');await shot('09-gemini');record('Gemini形象','通过真实选择器切换为猫耳形象')
 await pick('deepseek-chat API [模拟]');await page.waitForTimeout(400);assert.equal((await rpc('state')).route.art,'deepseek');assert.equal(await page.locator('[data-kujira-pet]').count(),1)
 await page.getByRole('button',{name:'Plugins',exact:true}).click();await page.getByRole('button',{name:'View AI Gijinka · Shared World, Individual Personas',exact:true}).click()
 await page.getByRole('checkbox',{name:'减少动态',exact:true}).check();await page.waitForTimeout(300);assert.equal(await page.locator('[data-kujira-pet] img').evaluate(el=>getComputedStyle(el).animationName),'none');record('减少动态','实际UI修改立即停止CSS动画')
 await page.getByRole('checkbox',{name:'启用桌宠',exact:true}).uncheck();await page.waitForTimeout(500);assert.equal(await page.locator('[data-kujira-pet]').count(),0);assert.equal((await rpc('state')).renderer,'none');await shot('10-disabled');record('关闭与持久化','实际UI关闭；宠物节点移除，配置文件可读回')
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1500);assert.equal((await rpc('state')).config.enabled,false);assert.equal(await page.locator('[data-kujira-pet]').count(),0);record('重载后保持关闭','重新载入真实DSH仍不生成宠物')
 const config=JSON.parse(await readFile('trial/home/kujira-pet.json','utf8'));assert.equal(config.enabled,false);assert.equal(config.reducedMotion,true)
 await writeFile('evidence/ui-result.json',JSON.stringify({ok:true,cases,pageErrors:errors,consoleErrors:events,config,finalState:await rpc('state'),simulation:'Inference and balance/quota data mocked outside package; DSH UI, model selection, tool execution and files are real.'},null,2));assert.equal(errors.length,0)
}catch(e){if(page){await page.screenshot({path:'evidence/failure.png',fullPage:true}).catch(()=>{});await writeFile('evidence/failure-body.txt',await page.locator('body').innerText()).catch(()=>{})}await writeFile('evidence/ui-result.json',JSON.stringify({ok:false,error:e.stack,cases,pageErrors:errors,consoleErrors:events},null,2));process.exitCode=1}
finally{await browser?.close();proc.kill('SIGTERM');await writeFile('evidence/launcher.log',log)}
