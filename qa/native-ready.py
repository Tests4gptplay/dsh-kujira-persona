from pathlib import Path
p=Path('qa/native-test-v2.ps1');s=p.read_text(encoding='utf-8')
a='$p=Start-Pet;$ready=$p.StandardOutput.ReadLineAsync();$pidBefore=$p.Id;'
b='$p=Start-Pet;$ready=$p.StandardOutput.ReadLineAsync();if(-not $ready.Wait(20000)){throw "Native ready handshake timed out"};if($ready.Result -notmatch "ready"){throw ("Unexpected startup message: "+$ready.Result)};$pidBefore=$p.Id;'
assert a in s;s=s.replace(a,b)
s=s.replace('secondWindowPrevented=$true;exitOnEOF=$true;', 'secondWindowPrevented=$true;exitOnEOF=$true;readyHandshake=$true;')
p.write_text(s,encoding='utf-8')
p=Path('qa/native-bridge.test.mjs');s=p.read_text(encoding='utf-8')
a='const first=native.child';b="const first=native.child;let firstExited=false;first.once('exit',()=>{firstExited=true})";assert a in s;s=s.replace(a,b)
a='assert.notEqual(first.exitCode,null)';b='assert.equal(firstExited,true);assert.ok(first.exitCode!==null||first.signalCode!==null)';assert a in s;s=s.replace(a,b)
s=s.replace('rapidOffOn:true,closed:true,statuses','rapidOffOn:true,closed:true,oldProcessExitObserved:firstExited,oldExitCode:first.exitCode,oldSignalCode:first.signalCode,statuses')
p.write_text(s,encoding='utf-8')
