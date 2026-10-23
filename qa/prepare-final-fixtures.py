from pathlib import Path

def edit(name,old,new):
 p=Path(name);s=p.read_text(encoding='utf-8');assert s.count(old)==1,(name,old[:55],s.count(old));p.write_text(s.replace(old,new,1),encoding='utf-8',newline='\n')
# Existing test expectations now reflect the explicitly requested Stella default.
edit('qa/pet.test.mjs',"assert.equal(c.route.art,'unknown');c.dispose()", "assert.equal(c.route.art,'stella');c.dispose()")
edit('qa/run-dsh.mjs'," if(needsRead&&!afterTool&&tool)",""" const lastUser=[...body.messages].reverse().find(m=>m.role==='user');const userText=typeof lastUser?.content==='string'?lastUser.content:JSON.stringify(lastUser?.content??'')
 const manage=(body.tools??[]).find(t=>t.function?.name==='persona_manage')?.function
 if(!afterTool&&manage&&userText.includes('绑定当前模型到 GPT'))calls=[{index:0,id:'call_bind_'+id,type:'function',function:{name:manage.name,arguments:JSON.stringify({action:'bind',persona:'gpt',use_current_model:true})}}]
 else if(!afterTool&&manage&&userText.includes('解除当前模型的角色绑定'))calls=[{index:0,id:'call_unbind_'+id,type:'function',function:{name:manage.name,arguments:JSON.stringify({action:'unbind',use_current_model:true})}}]
 else if(needsRead&&!afterTool&&tool)""")
anchor=" await pick('deepseek-chat API [模拟]');await page.waitForTimeout(400);"
extra=""" await pick('private-model-v1 API [模拟]');await page.waitForFunction(()=>document.querySelector('[data-kujira-pet]')?.dataset.persona==='stella')
 assert.equal((await rpc('state')).route.name,'星璃');assert.equal(await page.evaluate(()=>window.__qaPet===document.querySelector('[data-kujira-pet]')),true);await shot('12-unknown-stella');record('未知模型默认星璃','同一只桌宠转为星璃；图片仍为未验收占位')
 await page.getByRole('button',{name:'New session',exact:true}).first().click();await page.waitForTimeout(700);await pick('private-model-v1 API [模拟]')
 async function task(text){await page.locator('[contenteditable=true]').fill(text);await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'visible',timeout:15000});await page.getByRole('button',{name:'Stop generating',exact:true}).waitFor({state:'hidden',timeout:45000});await page.waitForTimeout(500)}
 await task('介绍一下你自己。')
 const request=JSON.parse(await readFile('evidence/request-3.json','utf8'));assert.ok(JSON.stringify(request.messages).includes('我是星璃'))
 await writeFile('evidence/stella-prompt-check.json',JSON.stringify({ok:true,containsStella:true,model:request.model,note:'Real DSH prompt assembly; model reply is simulated; raw request is not published'},null,2));await shot('13-stella-prompt');record('星璃人设实际加载','真实请求中出现星璃基础档案；不是只改桌宠标题')
 await task('绑定当前模型到 GPT。');await page.waitForFunction(()=>document.querySelector('[data-kujira-pet]')?.dataset.persona==='gpt');assert.equal((await rpc('state')).route.model,'private-model-v1');await shot('14-live-binding');record('对话改绑定立即联动','真实 persona_manage 执行后直接换成 GPT，不手动切模型')
 await task('解除当前模型的角色绑定。');await page.waitForFunction(()=>document.querySelector('[data-kujira-pet]')?.dataset.persona==='stella');await shot('15-unbind-stella');record('解除绑定恢复星璃','未知模型恢复默认角色，仍只有一个宠物节点')
 assert.equal(await page.locator('[data-kujira-pet]').count(),1)
"""
edit('qa/ui-test.mjs',anchor,extra+anchor)
edit('qa/ui-test.mjs'," assert.equal((await rpc('state')).config.showStats,true)",""" await page.getByRole('combobox',{name:'余额刷新',exact:true}).selectOption('0');await page.waitForTimeout(300);assert.equal((await rpc('state')).config.refreshSeconds,0)
 await rpc('config',{x:45,y:140,desktopX:120,desktopY:60});await page.getByRole('button',{name:'重置桌宠位置',exact:true}).click();await page.waitForTimeout(300);const reset=(await rpc('state')).config;assert.equal(reset.x,null);assert.equal(reset.desktopX,null);await shot('16-settings-final');record('刷新与位置设置','可关闭余额定时刷新；页面与桌面位置可一起重置')
 assert.equal((await rpc('state')).config.showStats,true)""")
# Window size follows bubble text, so pin the character's lower-right anchor, not its old frame top.
edit('qa/native-test-v2.ps1',"if($first.left -ne $next.left -or $first.top -ne $next.top){throw 'Model or bubble update moved native window'}", "if(($first.left+$first.width) -ne ($next.left+$next.width) -or ($first.top+$first.height) -ne ($next.top+$next.height)){throw 'Model or bubble update moved the character anchor'}")
edit('qa/native-test-v2.ps1','function Send-State($p,$name,$art,$phase,$quota) {','function Send-State($p,$name,$art,$phase,$quota,$extra=@{}) {')
edit('qa/native-test-v2.ps1',' $p.StandardInput.WriteLine(($obj|ConvertTo-Json', ' foreach($key in $extra.Keys){$obj.config[$key]=$extra[$key]}\n $p.StandardInput.WriteLine(($obj|ConvertTo-Json')
anchor=" foreach($art in @('glm','gemini','claude','grok','kimi','qwen','minimax','llama','doubao','mistral','hunyuan','mimo'))"
extra=""" Send-State $p '星璃' 'stella' 'working' @{title='Usage (SIMULATED)';lines=@('Not provided')} @{scale=1.6;bubbleScale=1.4;desktopX=120;desktopY=30};Start-Sleep -Milliseconds 700
 $large=Capture $p 'native-stella-large.png'
 $root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$large.handle)
 $nodes=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $inside=$false;foreach($node in $nodes){if($node.Current.Name -match '1452 tok/s'){$r=$node.Current.BoundingRectangle;if($r.Top -lt $large.top-2 -or $r.Bottom -gt $large.top+$large.height+2){throw 'Native text clipped by window'};$inside=$true}}
 if(-not $inside){throw 'Large native stats not found'}
 @{ok=$true;largeLayout=$large;textInsideWindow=$inside;artwork='placeholder-not-approved'}|ConvertTo-Json -Depth 8|Set-Content -Encoding utf8 evidence/native-layout.json
"""
edit('qa/native-test-v2.ps1',anchor,extra+anchor.replace("'mimo'))","'mimo','stella'))"))
print('QA fixtures extended without adding fixtures to candidate')
