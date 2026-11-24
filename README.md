# Vaylox

Vaylox ist ein Prototyp für eine Community-Spielplattform mit eigenen Browser-Games, Erkundungswelten und einem ersten Studio.

## Voraussetzungen

- Node.js 20 oder neuer
- npm

## Lokal starten

```bash
npm install
npm start
```

Danach kannst du im Browser `http://localhost:3000/games.html` für die Arcade-Prototypen oder `http://localhost:3000/discovery.html` für „Die verlorenen Archive“ oder `http://localhost:3000/client.html` für den Online-Multiplayer-Test öffnen.

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

- Drei direkt spielbare Arcade-Prototypen: Sky Obby, Coin Dash und Star Dodge (`/games.html`)
- Erkundungsspiel „Die verlorenen Archive“ mit drei Gebieten, sechs Story-Hinweisen und lokal gespeichertem Fortschritt (`/discovery.html`)
- Geschützter Admin-Login mit serverseitig vergebener Rolle und verifiziertem Status (`/admin.html`)
- Electron-Desktop-Shell als Ausgangspunkt für Vaylox Player
- Kleine gemeinsame Testwelt mit Echtzeit-Spielerpositionen über Socket.IO
- Anzeigenamen für die aktuelle Spielsitzung
- Vaylox Studio-Prototyp mit Raster, Gras-, Stein-, Wasser- und Sandfeldern
- Veröffentlichung einer gebauten Welt auf dem laufenden Server
- Einfache Status- und Welten-API

## Admin-Zugang einrichten

Der Benutzername ist standardmäßig `VayloxAdmin` (änderbar über `VAYLOX_ADMIN_USERNAME`). Ein Admin-Konto kann nicht über die öffentliche Registrierung erstellt werden. Setze auf dem Hosting-Server unter den Environment Variables ein starkes `VAYLOX_ADMIN_PASSWORD` und optional `VAYLOX_ADMIN_USERNAME`. Lege das Passwort niemals in HTML, JavaScript, GitHub oder einem Chat ab. Ohne gesetztes Passwort bleibt der Admin-Login deaktiviert. Aufruf: `/admin.html`. Die Admin-Sitzungen liegen derzeit nur im Arbeitsspeicher und werden bei einem Server-Neustart beendet.

## Noch nicht fertig

- Vollständiges Benutzerkontensystem, Registrierung, sichere normale Anmeldung und Passwort-Reset
- Datenbank und dauerhaft gespeicherte Welten
- 3D-Spielengine, Physik, Animationen und richtige Spielmechaniken
- Freundesliste, Einladungen, Chat, Moderation und Meldefunktionen
- Sichere Prüfung und Begrenzung veröffentlichter Inhalte
- Öffentliche Spielserver, Matchmaking, Skalierung und automatische Bereitstellung
- Signierte, getestete Installer und automatische Updates

**Wichtig:** Der Multiplayer ist aktuell ein technischer Test auf einem einzelnen laufenden Server. Spieler und veröffentlichte Welten liegen nur im Arbeitsspeicher und gehen beim Neustart verloren. Das ist noch kein öffentlich betriebenes oder belastbar skalierendes Spielnetzwerk. Stelle den Server nicht öffentlich bereit, bevor Accounts, Zugriffsschutz, Rate-Limits und Moderationsfunktionen ergänzt und getestet wurden.

## Kosten

Die lokale Entwicklung und das Erstellen eines Installers sind kostenlos. Online-Multiplayer benötigt dauerhaft erreichbare Server und Datenbankkapazität. Kostenlose Hosting-Angebote haben Limits und können schlafen gehen; dauerhaft viele gleichzeitige Spieler sind nicht garantiert kostenlos.
