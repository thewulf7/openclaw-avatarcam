@echo off
cd /d "%~dp0"

:: Check for Admin
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Registering OpenClaw AvatarCam...
    regsvr32 /s OpenClawAvatarCam.dll
    if %errorLevel% == 0 (
        echo [OK] Virtual Camera Registered Successfully!
        echo You can now use it in Zoom/Teams.
    ) else (
        echo [ERROR] Failed to register DLL. Ensure OpenClawAvatarCam.dll exists.
    )
) else (
    echo Requesting Administrator Privileges...
    powershell -Command "Start-Process '%0' -Verb RunAs"
)
pause
