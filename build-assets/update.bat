@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "BACKEND_URL=__BACKEND_URL__"

echo.
echo [wwweBar Update] Hole neueste Version...
for /f "delims=" %%v in ('powershell -NoProfile -Command "try { (Invoke-RestMethod '!BACKEND_URL!/api/version').latest } catch { '' }"') do set "VERSION=%%v"

if "!VERSION!"=="" (
    echo Konnte Version nicht ermitteln. Backend erreichbar?
    pause
    exit /b 1
)

echo [wwweBar Update] Lade !VERSION!.zip...
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
    echo Entpacken fehlgeschlagen. Bitte ZIP manuell entpacken.
    pause
    exit /b 1
)
del /q update.zip

echo.
echo Update auf !VERSION! fertig.
echo Jetzt in chrome://extensions/ den Reload-Button bei der Erweiterung klicken.
echo.
pause
