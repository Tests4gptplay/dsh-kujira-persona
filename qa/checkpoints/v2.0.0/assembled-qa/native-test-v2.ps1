$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force evidence | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class PetCapture {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
 public delegate bool EnumProc(IntPtr h,IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public static string Title(IntPtr h){var s=new StringBuilder(512);GetWindowText(h,s,512);return s.ToString();}
 public static IntPtr Find(int process){IntPtr found=IntPtr.Zero;EnumWindows((h,l)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(pid==process&&IsWindowVisible(h)&&Title(h).StartsWith("Kujira")){found=h;return false;}return true;},IntPtr.Zero);return found;}
}
'@
$exe=Join-Path $PWD 'candidate/pet/native/win-x64/KujiraPet.exe'
function Start-Pet {
 $i=[System.Diagnostics.ProcessStartInfo]::new($exe);$i.UseShellExecute=$false;$i.RedirectStandardInput=$true;$i.RedirectStandardOutput=$true;$i.RedirectStandardError=$true;$i.CreateNoWindow=$true
 $i.StandardInputEncoding=[Text.UTF8Encoding]::new($false)
 return [System.Diagnostics.Process]::Start($i)
}
function Send-State($p,$name,$art,$phase,$quota) {
 $obj=@{config=@{enabled=$true;scale=1;bubbleScale=1;reducedMotion=$true;showUsage=$true;bubble='always';sound=$false};route=@{name=$name;art=$art};task=@{phase=$phase;text=$(if($phase -eq 'completed'){'Task completed'}else{'Working on your task'})};usage=$quota;image=(Join-Path $PWD ('candidate/pet/assets/'+$art+'.png'))}
 $p.StandardInput.WriteLine(($obj|ConvertTo-Json -Depth 12 -Compress));$p.StandardInput.Flush()
}
function Capture($p,$file) {
 $h=[PetCapture]::Find($p.Id);if($h -eq [IntPtr]::Zero){throw 'No visible process-owned Kujira HWND'}
 $r=[PetCapture+RECT]::new();[void][PetCapture]::GetWindowRect($h,[ref]$r)
 $bmp=[Drawing.Bitmap]::new(($r.R-$r.L),($r.B-$r.T));$g=[Drawing.Graphics]::FromImage($bmp);$dc=$g.GetHdc()
 try{$ok=[PetCapture]::PrintWindow($h,$dc,2)}finally{$g.ReleaseHdc($dc)}
 $g.Dispose();$bmp.Save((Join-Path $PWD ('evidence/'+$file)),[Drawing.Imaging.ImageFormat]::Png);$bmp.Dispose()
 return @{handle=$h.ToInt64();title=[PetCapture]::Title($h);left=$r.L;top=$r.T;width=($r.R-$r.L);height=($r.B-$r.T);printWindow=$ok}
}
$p=$null;$second=$null
try {
 $p=Start-Pet;$pidBefore=$p.Id;Start-Sleep -Milliseconds 1300
 Send-State $p 'DeepSeek' 'deepseek' 'thinking' @{title='DeepSeek API balance (SIMULATED)';lines=@('CNY 57.25')};Start-Sleep -Milliseconds 700
 $first=Capture $p 'native-deepseek.png';if($first.title -notmatch 'DeepSeek'){throw ('Unexpected title: '+$first.title)}
 $second=Start-Pet;if(-not $second.WaitForExit(5000)){throw 'Second helper did not exit'};$secondOutput=$second.StandardOutput.ReadToEnd();if($secondOutput -notmatch 'already-open'){throw 'Single-window mutex not observed'}
 Send-State $p 'GPT' 'gpt' 'completed' @{title='Codex Pro (SIMULATED)';lines=@('5 hours: 65% remaining','7 days: 33% remaining')};Start-Sleep -Milliseconds 700
 $next=Capture $p 'native-gpt.png';if($next.title -notmatch 'GPT'){throw 'Model skin update not applied'}
 if($p.Id -ne $pidBefore -or $first.handle -ne $next.handle){throw 'Window was replaced instead of updated'}
 if($first.left -ne $next.left -or $first.top -ne $next.top){throw 'Model or bubble update moved native window'}
 foreach($art in @('glm','gemini','claude','grok','kimi','qwen','minimax','llama','doubao','mistral','hunyuan','mimo')){Send-State $p $art $art 'idle' @{title='Usage';lines=@('SIMULATED')};Start-Sleep -Milliseconds 100;if($p.HasExited){throw ('Helper exited for '+$art)}}
 $p.StandardInput.Close();if(-not $p.WaitForExit(5000)){throw 'Helper did not exit on pipe close'}
 @{ok=$true;sameProcess=$true;sameWindow=$true;positionStable=$true;secondWindowPrevented=$true;exitOnEOF=$true;first=$first;next=$next;scope='Actual Windows hosted WPF window and PNG images; English simulated status/quota; not user Windows Desktop'}|ConvertTo-Json -Depth 12|Set-Content -Encoding utf8 evidence/native-result.json
} catch { $problem=$_.ToString();$diag=@{};if($null -ne $p -and $p.HasExited){$diag=@{exitCode=$p.ExitCode;stdout=$p.StandardOutput.ReadToEnd();stderr=$p.StandardError.ReadToEnd()}};@{ok=$false;error=$problem;diagnostics=$diag}|ConvertTo-Json -Depth 12|Set-Content -Encoding utf8 evidence/native-result.json;throw }
finally { foreach($child in @($p,$second)){if($null -ne $child -and -not $child.HasExited){$child.Kill()}} }
