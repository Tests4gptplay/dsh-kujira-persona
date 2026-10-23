from pathlib import Path
p=Path('qa/native-test-v2.ps1');s=p.read_text(encoding='utf-8')
s=s.replace('using System.Text;','using System.Text;\nusing System.Collections.Generic;')
a=' public static IntPtr Find(int process)'
b=''' public static string[] Describe(int process){var rows=new List<string>();EnumWindows((h,l)=>{uint pid;GetWindowThreadProcessId(h,out pid);if(pid==process)rows.Add(h.ToInt64()+" visible="+IsWindowVisible(h)+" title="+Title(h));return true;},IntPtr.Zero);return rows.ToArray();}
 public static IntPtr Find(int process)'''
assert a in s;s=s.replace(a,b)
a=" $h=[PetCapture]::Find($p.Id);if($h -eq [IntPtr]::Zero){throw 'No visible process-owned Kujira HWND'}"
b=""" $deadline=[DateTime]::UtcNow.AddSeconds(20)
 do { $h=[PetCapture]::Find($p.Id); if($h -ne [IntPtr]::Zero){break}; if($p.HasExited){throw 'Helper exited before visible window'}; Start-Sleep -Milliseconds 100 } while([DateTime]::UtcNow -lt $deadline)
 if($h -eq [IntPtr]::Zero){throw 'No visible process-owned Kujira HWND after bounded startup wait'}"""
assert a in s;s=s.replace(a,b)
s=s.replace('$p=Start-Pet;$pidBefore=$p.Id;', '$p=Start-Pet;$ready=$p.StandardOutput.ReadLineAsync();$pidBefore=$p.Id;')
a="$problem=$_.ToString();$diag=@{};"
b="""$problem=$_.ToString();$diag=@{};if($null -ne $p -and -not $p.HasExited){$p.Refresh();$diag=@{processId=$p.Id;sessionId=$p.SessionId;parentSessionId=[Diagnostics.Process]::GetCurrentProcess().SessionId;mainWindow=$p.MainWindowHandle.ToInt64();mainTitle=$p.MainWindowTitle;windows=@([PetCapture]::Describe($p.Id));readyCompleted=$ready.IsCompleted;ready=$(if($ready.IsCompleted){$ready.Result}else{'not received'})}};"""
assert a in s;s=s.replace(a,b)
p.write_text(s,encoding='utf-8')
