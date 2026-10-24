[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('kujira-native-qa-' + [Guid]::NewGuid().ToString('N')))
)

# Build and verify a temporary copy. Nothing is installed or copied into pet/native.
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$qaRoot = [IO.Path]::GetFullPath($OutputDirectory)
$sourceInput = Join-Path $repoRoot 'pet/native/KujiraPet.cs'
$atlasInput = Join-Path $repoRoot 'pet/assets/gpt-core-v1.png'
$qaInput = Join-Path $PSScriptRoot 'native-protocol-check.cs'
foreach ($inputFile in @($sourceInput, $atlasInput, $qaInput)) {
  if (!(Test-Path -LiteralPath $inputFile -PathType Leaf)) { throw "Required repository input is missing: $inputFile" }
}
if (Test-Path -LiteralPath $qaRoot) {
  if (!(Test-Path -LiteralPath $qaRoot -PathType Container)) { throw 'OutputDirectory must be a new or empty directory' }
  if (@(Get-ChildItem -LiteralPath $qaRoot -Force).Count -ne 0) { throw 'OutputDirectory is not empty; choose a new isolated directory' }
}
if (!$env:WINDIR) { throw 'This verification requires Windows and its installed .NET Framework x64 compiler' }
$netRoot = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$csc = Join-Path $netRoot 'csc.exe'
if (!(Test-Path -LiteralPath $csc -PathType Leaf)) { throw 'Existing .NET Framework x64 compiler unavailable; no installation attempted' }
$refs = @('PresentationCore.dll', 'PresentationFramework.dll', 'WindowsBase.dll', 'System.Xaml.dll', 'System.Web.Extensions.dll') | ForEach-Object {
  $name = $_
  $path = @((Join-Path $netRoot $name), (Join-Path (Join-Path $netRoot 'WPF') $name)) |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if (!$path) { throw "Required installed assembly unavailable: $name" }
  '/r:' + $path
}

$sourceDir = Join-Path $qaRoot 'source'
$scripts = Join-Path $qaRoot 'scripts'
New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
New-Item -ItemType Directory -Path $sourceDir, $scripts | Out-Null
$source = Join-Path $sourceDir 'KujiraPet.cs'
$atlas = Join-Path $qaRoot 'gpt-core-v1.png'
$qaSource = Join-Path $scripts 'native-protocol-check.cs'
Copy-Item -LiteralPath $sourceInput -Destination $source
Copy-Item -LiteralPath $atlasInput -Destination $atlas
Copy-Item -LiteralPath $qaInput -Destination $qaSource

$exe = Join-Path $qaRoot 'KujiraPet.exe'
& $csc /nologo /target:winexe /platform:x64 /optimize+ ('/out:' + $exe) @refs $source
if ($LASTEXITCODE -ne 0) { throw "Product compile failed with code $LASTEXITCODE" }
$qaExe = Join-Path $qaRoot 'NativeProtocolQa.exe'
& $csc /nologo /target:exe /platform:x64 /optimize+ /main:KujiraNativeQa ('/out:' + $qaExe) ('/r:' + $exe) @refs $qaSource
if ($LASTEXITCODE -ne 0) { throw "Protocol QA compile failed with code $LASTEXITCODE" }
& $qaExe $qaRoot
if ($LASTEXITCODE -ne 0) { throw "Native protocol QA failed with code $LASTEXITCODE" }

$checks = Get-Content -LiteralPath (Join-Path $qaRoot 'native-result.json') -Raw | ConvertFrom-Json
$metadata = [ordered]@{
  checkedAt = [DateTime]::UtcNow.ToString('o')
  sourceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash.ToLowerInvariant()
  exeSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash.ToLowerInvariant()
  atlasSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $atlas).Hash.ToLowerInvariant()
  exeBytes = (Get-Item -LiteralPath $exe).Length
  compiler = (Get-Item -LiteralPath $csc).VersionInfo.FileVersion
  checks = $checks
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $qaRoot 'build-result.json') -Encoding utf8
if ($checks.ipc -eq 'skipped-existing-user-instance') {
  Write-Warning 'A user pet already owns the single-instance mutex. Its process was preserved; the IPC launch check was skipped.'
}
Write-Host ('Verification output: ' + $qaRoot)
[PSCustomObject]$metadata
