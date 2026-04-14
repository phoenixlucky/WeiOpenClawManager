@echo off
setlocal

set "APP_NAME=OpenClaw Local Manager"
set "TARGET_DIR=%LOCALAPPDATA%\Programs\%APP_NAME%"
set "SOURCE_DIR=%~dp0"

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

copy /Y "%SOURCE_DIR%OpenClaw-Local-Manager.exe" "%TARGET_DIR%\OpenClaw-Local-Manager.exe" >nul
if exist "%SOURCE_DIR%README.txt" copy /Y "%SOURCE_DIR%README.txt" "%TARGET_DIR%\README.txt" >nul

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SOURCE_DIR%create-shortcuts.ps1" -TargetDir "%TARGET_DIR%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SOURCE_DIR%write-uninstaller.ps1" -TargetDir "%TARGET_DIR%"

start "" "%TARGET_DIR%\OpenClaw-Local-Manager.exe"

endlocal
exit /b 0
