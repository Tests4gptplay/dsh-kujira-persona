from pathlib import Path
p=Path('qa/ui-test.mjs');s=p.read_text();s=s.replace("await page.getByRole('checkbox',{name:'启用桌宠',exact:true}).check();", "await page.getByRole('checkbox',{name:'启用桌宠',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label=\"启用桌宠\"]')?.checked===true);")
s=s.replace("await page.getByRole('checkbox',{name:'减少动态',exact:true}).check();", "await page.getByRole('checkbox',{name:'减少动态',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label=\"减少动态\"]')?.checked===true);")
s=s.replace("await page.getByRole('checkbox',{name:'启用桌宠',exact:true}).uncheck();", "await page.getByRole('checkbox',{name:'启用桌宠',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label=\"启用桌宠\"]')?.checked===false);")
p.write_text(s)
p=Path('qa/native-test.ps1');s=p.read_text();s=s.replace("} catch { @{ok=$false;error=$_.ToString()}", "} catch { $problem=$_.ToString();$diag=@{};if($null -ne $p -and $p.HasExited){$diag=@{exitCode=$p.ExitCode;stdout=$p.StandardOutput.ReadToEnd();stderr=$p.StandardError.ReadToEnd()}}; @{ok=$false;error=$problem;diagnostics=$diag}");p.write_text(s)
