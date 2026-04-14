param(
  [Parameter(Mandatory = $true)]
  [string]$TargetDir
)

$appName = "OpenClaw Local Manager"
$exePath = Join-Path $TargetDir "OpenClaw-Local-Manager.exe"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$appName.lnk"
$startMenuDir = Join-Path ([Environment]::GetFolderPath("Programs")) $appName
$startMenuShortcut = Join-Path $startMenuDir "$appName.lnk"

New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell

$desktop = $shell.CreateShortcut($desktopShortcut)
$desktop.TargetPath = $exePath
$desktop.WorkingDirectory = $TargetDir
$desktop.IconLocation = "$exePath,0"
$desktop.Save()

$startMenu = $shell.CreateShortcut($startMenuShortcut)
$startMenu.TargetPath = $exePath
$startMenu.WorkingDirectory = $TargetDir
$startMenu.IconLocation = "$exePath,0"
$startMenu.Save()
