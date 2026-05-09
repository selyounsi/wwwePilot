#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

BACKEND_URL="__BACKEND_URL__"

pause() { read -n 1 -s -r -p "Beliebige Taste zum Schliessen..."; echo; }

if [ ! -f "manifest.json" ]; then
    echo
    echo "[wwweBar Update] ABBRUCH: manifest.json nicht gefunden."
    echo "Aktueller Ordner: $(pwd)"
    echo "Die Datei muss im Chrome-Extension-Ordner liegen."
    echo
    pause
    exit 1
fi

if [[ "$BACKEND_URL" != https://* ]]; then
    echo
    echo "[wwweBar Update] ABBRUCH: Backend-URL ist nicht HTTPS oder nicht gesetzt."
    echo "URL: $BACKEND_URL"
    echo
    pause
    exit 1
fi

echo
echo "[wwweBar Update] Hole neueste Version von $BACKEND_URL/api/version"
if ! curl -s -f "$BACKEND_URL/api/version" -o version.tmp; then
    echo "Backend nicht erreichbar."
    rm -f version.tmp
    pause
    exit 1
fi

VERSION=$(sed -nE 's/.*"latest":"([^"]*)".*/\1/p' version.tmp)
rm -f version.tmp

if [ -z "$VERSION" ]; then
    echo "Konnte Version nicht parsen."
    pause
    exit 1
fi

echo "[wwweBar Update] Lade $VERSION.zip ..."
if ! curl -L -f -o update.zip "$BACKEND_URL/api/version/download/$VERSION"; then
    echo "Download fehlgeschlagen."
    pause
    exit 1
fi

if ! unzip -l update.zip | grep -q "manifest.json"; then
    echo
    echo "[wwweBar Update] ABBRUCH: ZIP enthaelt keine manifest.json."
    rm -f update.zip
    pause
    exit 1
fi

echo "[wwweBar Update] Loesche alte Dateien..."
find . -mindepth 1 -maxdepth 1 ! -name "update.sh" ! -name "update.zip" -exec rm -rf {} +

echo "[wwweBar Update] Entpacke..."
if ! unzip -q update.zip; then
    echo "Entpacken fehlgeschlagen."
    pause
    exit 1
fi
rm -f update.zip

echo
echo "Update auf $VERSION fertig."
echo "Jetzt in chrome://extensions/ den Reload-Button klicken."
echo
pause
