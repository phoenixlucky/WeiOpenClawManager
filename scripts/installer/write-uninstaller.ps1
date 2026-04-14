param(
  [Parameter(Mandatory = $true)]
  [string]$TargetDir
)

$appName = "OpenClaw Local Manager"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$appName.lnk"
$startMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) $appName
$uninstallPath = Join-Path $TargetDir "Uninstall OpenClaw Local Manager.cmd"

$content = @"
@echo off
setlocal
taskkill /IM OpenClaw-Local-Manager.exe /F >nul 2>nul
del /F /Q "$desktopShortcut" >nul 2>nul
rmdir /S /Q "$startMenuDir" >nul 2>nul
rmdir /S /Q "$TargetDir" >nul 2>nul
endlocal
"@

Set-Content -Path $uninstallPath -Value $content -Encoding ASCII
