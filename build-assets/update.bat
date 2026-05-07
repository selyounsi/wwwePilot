@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "BACKEND_URL=__BACKEND_URL__"

if not exist "manifest.json" (
    echo.
    echo [wwweBar Update] ABBRUCH: manifest.json nicht gefunden.
    echo Aktueller Ordner: %CD%
    echo Die Datei muss im Chrome-Extension-Ordner liegen.
    echo.
    pause
    exit /b 1
)

echo !BACKEND_URL! | findstr /b "https://" >nul
if errorlevel 1 (
    echo.
    echo [wwweBar Update] ABBRUCH: Backend-URL ist nicht HTTPS oder nicht gesetzt.
    echo URL: !BACKEND_URL!
    echo.
    pause
    exit /b 1
)

echo.
echo [wwweBar Update] Hole neueste Version von !BACKEND_URL!/api/version
curl -s -f "!BACKEND_URL!/api/version" -o version.tmp
if errorlevel 1 (
    echo Backend nicht erreichbar.
    if exist version.tmp del /q version.tmp
    pause
    exit /b 1
)

powershell -NoProfile -Command "(Get-Content -Raw version.tmp | ConvertFrom-Json).latest" > version-out.tmp
set "VERSION="
set /p VERSION=<version-out.tmp
del /q version.tmp version-out.tmp

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

tar -tf update.zip | findstr /b "manifest.json" >nul
if errorlevel 1 (
    echo.
    echo [wwweBar Update] ABBRUCH: ZIP enthaelt keine manifest.json.
    echo Backend-Antwort sieht nicht wie eine gueltige Extension aus.
    del /q update.zip
    pause
    exit /b 1
)

echo [wwweBar Update] Loesche alte Dateien...
for /f "delims=" %%d in ('dir /a:d /b 2^>nul') do (
    if /i not "%%d"=="." if /i not "%%d"==".." rd /s /q "%%d" 2>nul
)
for /f "delims=" %%f in ('dir /a:-d /b 2^>nul') do (
    if /i not "%%f"=="update.bat" if /i not "%%f"=="update.zip" del /q "%%f" 2>nul
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
