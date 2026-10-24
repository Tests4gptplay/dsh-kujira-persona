import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'

// QA only. The generated playable itself needs no dependencies or server.
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.KUJIRA_PLAYWRIGHT_MODULE??'playwright')
const root=fileURLToPath(new URL('../../',import.meta.url))
const output=resolve(process.argv[2]??join(root,'../kujira-trial'))
const qa=join(output,'qa');await mkdir(qa,{recursive:true})
const report={kind:'offline-file-playable',checkedAt:new Date().toISOString(),checks:{},errors:[],networkRequests:[]}
const browser=await chromium.launch({headless:true,executablePath:process.env.KUJIRA_CHROMIUM_PATH||undefined,timeout:20000})
try {
  const context=await browser.newContext({viewport:{width:1280,height:960},locale:'zh-CN',reducedMotion:'no-preference'})
  await context.route(/^https?:/,route=>{report.networkRequests.push(route.request().url());return route.abort()})
  const page=await context.newPage();page.setDefaultTimeout(7000)
  page.on('pageerror',error=>report.errors.push(error.message))
  page.on('requestfailed',request=>report.errors.push(request.failure()?.errorText??'Resource failed'))
  await page.goto(pathToFileURL(join(output,'index.html')).href,{waitUntil:'load'})
  const clip=async name=>page.waitForFunction(name=>document.querySelector('#canvas')?.dataset.clip===name,name)
  const choose=async name=>{await page.locator('#characters [data-character="'+name+'"]').click();await page.waitForFunction(name=>document.querySelector('#canvas')?.dataset.character===name&&document.querySelector('#load-error')?.hidden,name)}
  await clip('idle')
  assert.equal(await page.locator('#characters [data-character]').count(),15)
  assert.equal(await page.locator('[data-state]').count(),9)
  report.checks.openedFromFile=true
  report.checks.availableCharacters=await page.locator('#characters [data-character]:not(:disabled)').count()
  report.checks.unavailableCharacters=await page.locator('#characters [data-character]:disabled').evaluateAll(buttons=>buttons.map(button=>button.textContent))
  assert.equal(report.checks.availableCharacters,15,'The final trial must enable every character option')
  assert.deepEqual(report.checks.unavailableCharacters,[])
  report.checks.loadedCharacters=[]
  const characterIds=await page.locator('#characters [data-character]').evaluateAll(buttons=>buttons.map(button=>button.dataset.character))
  for(const id of characterIds){
    await choose(id);await clip('idle')
    assert.equal(await page.locator('#load-error').isHidden(),true)
    report.checks.loadedCharacters.push(id)
  }
  await choose('gpt');await clip('idle')

  await page.locator('[data-state="editing"]').click();await clip('editing')
  const first=await page.locator('#canvas').getAttribute('data-frame')
  await page.waitForFunction(first=>document.querySelector('#canvas').dataset.frame!==first,first)
  report.checks.authoredFrameAdvance=true
  await page.locator('#pause').click()
  const frozen=await page.locator('#canvas').getAttribute('data-frame')
  await page.waitForTimeout(650)
  assert.equal(await page.locator('#canvas').getAttribute('data-frame'),frozen)
  await page.locator('#pause').click()
  await page.waitForFunction(frozen=>document.querySelector('#canvas').dataset.frame!==frozen,frozen)
  report.checks.pauseAndResume=true

  await choose('deepseek');await clip('idle')
  await choose('unknown');await clip('idle')
  assert.equal(await page.locator('#name').textContent(),'星璃')
  await choose('gpt');await clip('idle')
  report.checks.characterSwitch=true
  await page.locator('#canvas').click({position:{x:110,y:65}});await clip('head_pat');await clip('idle')
  report.checks.headTouch=true
  const before=await page.locator('#canvas').boundingBox()
  await page.mouse.move(before.x+before.width/2,before.y+before.height*.6)
  await page.mouse.down()
  await page.mouse.move(before.x+before.width/2+80,before.y+before.height*.6-45,{steps:8})
  await clip('dragging');await page.mouse.up();await clip('landing');await clip('idle')
  const after=await page.locator('#canvas').boundingBox()
  assert(Math.abs(after.x-before.x-80)<2);assert(Math.abs(after.y-before.y+45)<2)
  report.checks.dragLandingAndPosition=true
  await page.locator('#reset').click()
  await page.locator('#size').fill('280');await page.locator('#size').dispatchEvent('input')
  assert.equal((await page.locator('#canvas').boundingBox()).width,280)
  await page.locator('#size').fill('220');await page.locator('#size').dispatchEvent('input')
  report.checks.sizeControl=true

  await page.locator('#reduced').check();await page.locator('[data-state="error"]').click();await clip('idle')
  assert.equal(await page.locator('#canvas').getAttribute('data-frame'),'0')
  await page.waitForTimeout(250)
  assert.equal(await page.locator('#canvas').getAttribute('data-frame'),'0')
  assert.equal(await page.locator('[data-action="head_pat"]').isDisabled(),true)
  await page.locator('#reduced').uncheck();await page.locator('[data-state="idle"]').click()
  report.checks.reducedMotion=true
  await page.locator('#simulate').click();await clip('thinking')
  await page.waitForFunction(()=>document.querySelector('#simulate').getAttribute('aria-pressed')==='false',null,{timeout:18000})
  await clip('idle');report.checks.completeSimulatedRound=true
  await page.screenshot({path:join(qa,'playable-light.png'),fullPage:true})
  await page.locator('.theme [data-theme="dark"]').click()
  assert.equal(await page.locator('body').getAttribute('data-theme'),'dark')
  await page.screenshot({path:join(qa,'playable-dark.png'),fullPage:true})
  report.checks.lightAndDark=true
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:join(qa,'playable-mobile.png'),fullPage:true})
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  report.checks.mobileWidth=true
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.networkRequests,[])
  report.checks.noExternalRequests=true
} catch(error) {report.failure=error.message;throw error}
finally {await writeFile(join(qa,'playable-result.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report))}
