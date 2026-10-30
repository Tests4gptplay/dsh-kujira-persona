import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {petLaunchSpec,desktopPlatform} from '../../pet/companion/launch-spec.mjs'
const en=JSON.parse(await readFile(new URL('../../locale/en.json',import.meta.url))),zh=JSON.parse(await readFile(new URL('../../locale/zh.json',import.meta.url)))
test('English and Chinese retain identical UI keys',()=>assert.deepEqual(Object.keys(en.ui).sort(),Object.keys(zh.ui).sort()))
test('locale descriptions explain user capabilities and refer to platform installation requirements',()=>{for(const d of [en,zh]){assert.match(d.meta.description,/cross-platform|跨平台/);assert.match(d.meta.description,/installation instructions|安装说明/);assert.match(d.meta.description,/tokens|token/);assert.match(d.meta.description,/customizations|自定义/);assert.match(d.ui['pet.display.desktop'],/Windows.*Linux.*macOS/);assert.match(d.ui['pet.display.auto'],/Windows.*Linux.*macOS/);assert.ok(!d.ui['pet.display.auto'].includes('Windows desktop / in-page'))}})
test('description platform list matches actual launch routing without starting any desktop',()=>{for(const p of ['win32','linux','darwin']){assert.equal(desktopPlatform(p),true);assert.ok(petLaunchSpec({platform:p,petRoot:'/fixture'}))}assert.equal(desktopPlatform('other'),false);assert.equal(petLaunchSpec({platform:'linux',petRoot:'/fixture'}).file,'electron');assert.equal(petLaunchSpec({platform:'darwin',petRoot:'/fixture',electronExecutable:'/Applications/Electron.app'}).file,'/Applications/Electron.app/Contents/MacOS/Electron')})
