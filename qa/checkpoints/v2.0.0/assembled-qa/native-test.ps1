$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force evidence | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PetCapture {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
}
'@
$exe=Join-Path $PWD 'candidate/pet/native/win-x64/KujiraPet.exe'
function Start-Pet {
 $i=[System.Diagnostics.ProcessStartInfo]::new($exe);$i.UseShellExecute=$false;$i.RedirectStandardInput=$true;$i.RedirectStandardOutput=$true;$i.RedirectStandardError=$true;$i.CreateNoWindow=$true
 return [System.Diagnostics.Process]::Start($i)
}
function Send-State($p,$name,$art,$phase,$quota) {
 $obj=@{config=@{enabled=$true;scale=1;bubbleScale=1;reducedMotion=$true;showUsage=$true;bubble='always';sound=$false};route=@{name=$name;art=$art};task=@{phase=$phase;text=$(if($phase -eq 'completed'){'做完啦'}else{'正在处理任务'})};usage=$quota;image=(Join-Path $PWD ('candidate/pet/assets/'+$art+'.png'))}
 $p.StandardInput.WriteLine(($obj|ConvertTo-Json -Depth 12 -Compress));$p.StandardInput.Flush()
}
function Capture($p,$file) {
 $p.Refresh();$h=$p.MainWindowHandle;if($h -eq 0){throw 'Native window handle missing'}
 $r=[PetCapture+RECT]::new();[void][PetCapture]::GetWindowRect($h,[ref]$r)
 $bmp=[Drawing.Bitmap]::new(($r.R-$r.L),($r.B-$r.T));$g=[Drawing.Graphics]::FromImage($bmp);$dc=$g.GetHdc()
 try{$ok=[PetCapture]::PrintWindow($h,$dc,2)}finally{$g.ReleaseHdc($dc)}
 $g.Dispose();$bmp.Save((Join-Path $PWD ('evidence/'+$file)),[Drawing.Imaging.ImageFormat]::Png);$bmp.Dispose()
 return @{handle=$h.ToInt64();left=$r.L;top=$r.T;width=($r.R-$r.L);height=($r.B-$r.T);printWindow=$ok}
}
$p=$null;$second=$null
try {
 $p=Start-Pet;$pidBefore=$p.Id;Start-Sleep -Milliseconds 1300
 Send-State $p 'DeepSeek' 'deepseek' 'thinking' @{title='DeepSeek API 余额（模拟）';lines=@('¥57.25')};Start-Sleep -Milliseconds 700
 $first=Capture $p 'native-deepseek.png';$p.Refresh();if($p.MainWindowTitle -notmatch 'DeepSeek'){throw ('Unexpected title: '+$p.MainWindowTitle)}
 $second=Start-Pet;if(-not $second.WaitForExit(5000)){throw 'Second helper did not exit'};$secondOutput=$second.StandardOutput.ReadToEnd();if($secondOutput -notmatch 'already-open'){throw 'Single-window mutex not observed'}
 Send-State $p 'GPT' 'gpt' 'completed' @{title='Codex pro（模拟）';lines=@('5 小时剩余 65%','7 天剩余 33%')};Start-Sleep -Milliseconds 700
 $next=Capture $p 'native-gpt.png';$p.Refresh();if($p.MainWindowTitle -notmatch 'GPT'){throw 'Model skin update not applied'}
 if($p.Id -ne $pidBefore -or $first.handle -ne $next.handle){throw 'Window was replaced instead of updated'}
 if($first.left -ne $next.left -or $first.top -ne $next.top){throw 'Model or bubble update moved native window'}
 foreach($art in @('glm','gemini','claude','grok','kimi','qwen','minimax','llama','doubao','mistral','hunyuan','mimo')){Send-State $p $art $art 'idle' @{title='用量';lines=@('模拟测试')};Start-Sleep -Milliseconds 100;if($p.HasExited){throw ('Helper exited for '+$art)}}
 $p.StandardInput.Close();if(-not $p.WaitForExit(5000)){throw 'Helper did not exit on pipe close'}
 @{ok=$true;sameProcess=$true;sameWindow=$true;positionStable=$true;secondWindowPrevented=$true;exitOnEOF=$true;first=$first;next=$next;scope='Windows hosted runner; actual WPF window and PNG images, synthetic state/quota, not user Desktop'} | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 evidence/native-result.json
} catch { $problem=$_.ToString();$diag=@{};if($null -ne $p -and $p.HasExited){$diag=@{exitCode=$p.ExitCode;stdout=$p.StandardOutput.ReadToEnd();stderr=$p.StandardError.ReadToEnd()}}; @{ok=$false;error=$problem;diagnostics=$diag}|ConvertTo-Json|Set-Content -Encoding utf8 evidence/native-result.json;throw }
finally { foreach($child in @($p,$second)){if($null -ne $child -and -not $child.HasExited){$child.Kill()}} }
