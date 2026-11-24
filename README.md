# Bloxi

Bloxi ist eine frühe Grundlage für eine herunterladbare Multiplayer-Spielplattform mit Bloxi Player und Bloxi Studio.

## Voraussetzungen

- Node.js 20 oder neuer
- npm

## Lokal starten

```bash
npm install
npm start
```

Danach im Browser `http://localhost:3000/client.html` öffnen.

## Desktop-App starten

```bash
npm install
npm run desktop
```

## Desktop-Installer bauen

```bash
npm run desktop:build
```

Electron Builder erstellt den Installer für das Betriebssystem, auf dem der Build läuft. Für Windows, macOS und Linux werden getrennte Builds benötigt. Ein fertiger Installer ist noch nicht eingecheckt oder veröffentlicht.

## Was der Prototyp schon enthält

- Electron-Desktop-Shell als Ausgangspunkt für Bloxi Player
- Kleine gemeinsame Testwelt mit Echtzeit-Spielerpositionen über Socket.IO
- Anzeigenamen für die aktuelle Spielsitzung
- Bloxi Studio-Prototyp mit Raster, Gras-, Stein-, Wasser- und Sandfeldern
- Veröffentlichung einer gebauten Welt auf dem laufenden Server
- Einfache Status- und Welten-API

## Noch nicht fertig

- Benutzerkonten, sichere Anmeldung und Passwort-Reset
- Datenbank und dauerhaft gespeicherte Welten
- 3D-Spielengine, Physik, Animationen und richtige Spielmechaniken
- Freundesliste, Einladungen, Chat, Moderation und Meldefunktionen
- Sichere Prüfung und Begrenzung veröffentlichter Inhalte
- Öffentliche Spielserver, Matchmaking, Skalierung und automatische Bereitstellung
- Signierte, getestete Installer und automatische Updates

**Wichtig:** Der Multiplayer ist aktuell ein technischer Test auf einem einzelnen laufenden Server. Spieler und veröffentlichte Welten liegen nur im Arbeitsspeicher und gehen beim Neustart verloren. Das ist noch kein öffentlich betriebenes oder belastbar skalierendes Spielnetzwerk. Stelle den Server nicht öffentlich bereit, bevor Accounts, Zugriffsschutz, Rate-Limits und Moderationsfunktionen ergänzt und getestet wurden.

## Kosten

Die lokale Entwicklung und das Erstellen eines Installers sind kostenlos. Online-Multiplayer benötigt dauerhaft erreichbare Server und Datenbankkapazität. Kostenlose Hosting-Angebote haben Limits und können schlafen gehen; dauerhaft viele gleichzeitige Spieler sind nicht garantiert kostenlos.
