@echo off
cd /d "%~dp0"

:: Check for Admin
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Unregistering OpenClaw AvatarCam...
    regsvr32 /u /s OpenClawAvatarCam.dll
    echo [OK] Virtual Camera Removed.
) else (
    echo Requesting Administrator Privileges...
    powershell -Command "Start-Process '%0' -Verb RunAs"
)
pause
