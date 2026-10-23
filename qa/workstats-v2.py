from pathlib import Path

# Patch the previously archived QA fixtures, never the product candidate.
p=Path('qa/run-dsh.mjs');s=p.read_text()
s=s.replace("send({role:'assistant'});if(calls.length)","send({role:'assistant'});await new Promise(r=>setTimeout(r,200));if(calls.length)")
s=s.replace("send({},calls.length?'tool_calls':'stop');res.end", "await new Promise(r=>setTimeout(r,200));send({},calls.length?'tool_calls':'stop');res.write('data: '+JSON.stringify({id:'mock_'+id,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:body.model,choices:[],usage:{prompt_tokens:12000,completion_tokens:600,total_tokens:12600,prompt_tokens_details:{cached_tokens:11160},completion_tokens_details:{reasoning_tokens:200}}})+'\\n\\n');res.end")
p.write_text(s,encoding='utf-8')
p=Path('qa/ui-test.mjs');s=p.read_text()
s=s.replace(" if(await page.getByRole('button',{name:'Continue',exact:true}).count())await page.getByRole('button',{name:'Continue',exact:true}).click()", " await page.getByRole('button',{name:'Continue',exact:true}).waitFor({timeout:12000});await page.getByRole('button',{name:'Continue',exact:true}).click()")
s=s.replace("assert.equal(completed.task.phase,'completed');record", """assert.equal(completed.task.phase,'completed');
 assert.ok(completed.stats.steps>=2);assert.ok(completed.stats.totalTokens>0);assert.equal(completed.stats.cacheHitPercent,'93');assert.ok(completed.stats.tokensPerSecond>0)
 const actualStats=await page.locator('[data-kujira-stats]').innerText()
 assert.ok(actualStats.includes('缓存命中 93%'));assert.ok(actualStats.includes('上下文已用'))
 const dockActivity=await page.locator('[data-composer-stat=activity]').innerText(),dockUsage=await page.locator('[data-composer-stat=usage]').innerText()
 const speed=completed.stats.lines[0].match(/([0-9.]+) tok\\/s/)[1]
 assert.ok(dockActivity.includes(speed+' tok/s'));assert.ok(dockActivity.includes(String(completed.stats.steps)+' steps'))
 assert.ok(dockUsage.includes(completed.stats.lines[1].split(' · ')[0]));assert.ok(dockUsage.includes('93%'))
 await writeFile('evidence/stats-parity.json',JSON.stringify({stats:completed.stats,petText:actualStats,dockActivity,dockUsage,usageSource:'simulated provider SSE usage; real DSH projections and real tools'},null,2))
 await shot('11-real-dsh-stats');record('DSH原生统计一致','与真实底栏的步骤/速度/Token/缓存一致；上下文不是完成进度')
 record""")
anchor=" await page.getByRole('checkbox',{name:'减少动态',exact:true}).click();"
s=s.replace(anchor,""" assert.equal((await rpc('state')).config.showStats,true)
 await page.getByRole('checkbox',{name:'显示工作统计',exact:true}).click();await page.waitForTimeout(400);assert.equal((await rpc('state')).stats,null);record('工作统计可独立关闭','关闭显示不影响角色、任务和余额')
 await page.getByRole('checkbox',{name:'显示工作统计',exact:true}).click();await page.waitForTimeout(300)
"""+anchor)
p.write_text(s,encoding='utf-8')
p=Path('qa/native-test-v2.ps1');s=p.read_text(encoding='utf-8')
s=s.replace("Add-Type -AssemblyName System.Drawing", "Add-Type -AssemblyName System.Drawing\nAdd-Type -AssemblyName UIAutomationClient,UIAutomationTypes")
s=s.replace("$p=Start-Pet;$pidBefore=$p.Id;Start-Sleep -Milliseconds 1300", "$p=Start-Pet;$ready=$p.StandardOutput.ReadLineAsync();if(-not $ready.Wait(20000)){throw 'Native ready timed out'};if($ready.Result -notmatch 'ready'){throw 'Unexpected startup'};$pidBefore=$p.Id")
s=s.replace('showUsage=$true;', 'showUsage=$true;showStats=$true;')
s=s.replace("usage=$quota;image=", "stats=@{lines=@('2 轮 59 步 · 1452 tok/s','4.1M tok · 缓存命中 93%','上下文已用 100%')};usage=$quota;image=")
s=s.replace(" $first=Capture $p 'native-deepseek.png';", """ $first=Capture $p 'native-deepseek.png';
 $element=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$first.handle)
 $texts=$element.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 $names=@();foreach($item in $texts){$names+=$item.Current.Name};$all=$names -join "`n"
 if($all -notmatch '1452 tok/s' -or $all -notmatch '缓存命中 93%' -or $all -notmatch '上下文已用 100%'){throw ('Native statistics not visible: '+$all)}
 $all|Set-Content -Encoding utf8 evidence/native-stats-text.txt
""")
p.write_text(s,encoding='utf-8')
p=Path('qa/native-bridge.test.mjs');s=p.read_text(encoding='utf-8')
s=s.replace('const first=native.child',"const first=native.child;let firstExited=false;first.once('exit',()=>{firstExited=true})")
s=s.replace('assert.notEqual(first.exitCode,null)','assert.equal(firstExited,true);assert.ok(first.exitCode!==null||first.signalCode!==null)')
p.write_text(s,encoding='utf-8')
