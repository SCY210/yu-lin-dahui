@echo off
setlocal
title Yu Lin Da Hui - Local test environment
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-test.ps1"
set "launcherResult=%errorlevel%"
if not "%launcherResult%"=="0" (
  echo.
  echo The local test environment could not start. See the message above.
  pause
)
exit /b %launcherResult%
