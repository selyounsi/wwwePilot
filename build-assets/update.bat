@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "BACKEND_URL=__BACKEND_URL__"

echo.
echo [wwweBar Update] Hole neueste Version von !BACKEND_URL!/api/version
curl -s -f "!BACKEND_URL!/api/version" -o version.tmp
if errorlevel 1 (
    echo Backend nicht erreichbar.
    if exist version.tmp del /q version.tmp
    pause
    exit /b 1
)

for /f "delims=" %%v in ('powershell -NoProfile -Command "(Get-Content -Raw version.tmp ^| ConvertFrom-Json).latest"') do set "VERSION=%%v"
del /q version.tmp

if "!VERSION!"=="" (
    echo Konnte Version nicht parsen.
    pause
    exit /b 1
)

echo [wwweBar Update] Lade !VERSION!.zip ...
curl -L -f -o update.zip "!BACKEND_URL!/api/version/download/!VERSION!"
if errorlevel 1 (
    echo Download fehlgeschlagen.
    pause
    exit /b 1
)

echo [wwweBar Update] Loesche alte Dateien...
for /d %%d in (*) do rd /s /q "%%d"
for %%f in (*) do (
    if /i not "%%f"=="update.bat" if /i not "%%f"=="update.zip" del /q "%%f" >nul 2>&1
)

echo [wwweBar Update] Entpacke...
tar -xf update.zip
if errorlevel 1 (
    echo Entpacken fehlgeschlagen.
    pause
    exit /b 1
)
del /q update.zip

echo.
echo Update auf !VERSION! fertig.
echo Jetzt in chrome://extensions/ den Reload-Button bei der Erweiterung klicken.
echo.
pause
