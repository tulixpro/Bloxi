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
- Datenbankgestützte Accounts mit Passwort-Hashing, E-Mail-Bestätigung und serverseitigen Sitzungen (`/register.html`, `/login.html`, `/verify.html`)
- Geschützter Admin-Login: Admin-Rolle wird ausschließlich über Hosting-Secrets eingerichtet (`/admin.html`)
- Electron-Desktop-Shell als Ausgangspunkt für Vaylox Player
- Kleine gemeinsame Testwelt mit Echtzeit-Spielerpositionen über Socket.IO
- Anzeigenamen für die aktuelle Spielsitzung
- Vaylox Studio-Prototyp mit Raster, Gras-, Stein-, Wasser- und Sandfeldern
- Veröffentlichung einer gebauten Welt auf dem laufenden Server
- Einfache Status- und Welten-API

## Accounts, E-Mail-Bestätigung und Admin einrichten

Für echte Accounts müssen `DATABASE_URL`, `APP_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` und `SMTP_FROM` als Hosting-Environment-Variablen gesetzt werden. Ohne Datenbank oder SMTP bleiben Registrierung und Anmeldung deaktiviert. Registrierte Spieler erhalten einen zeitlich begrenzten E-Mail-Bestätigungslink. Passwörter werden mit bcrypt gehasht; Session- und Bestätigungstokens werden nur als SHA-256-Hashes in PostgreSQL gespeichert.

Das Admin-Konto wird beim Serverstart aus `VAYLOX_ADMIN_USERNAME`, `VAYLOX_ADMIN_EMAIL` und `VAYLOX_ADMIN_PASSWORD` eingerichtet. Benutzername ist standardmäßig `VayloxAdmin`. Die E-Mail muss eindeutig sein und das Passwort mindestens 12 Zeichen lang. Die öffentliche Registrierung kann keine Admin-Rolle vergeben. Admin-Passwort niemals in HTML, JavaScript, GitHub oder einem Chat speichern. Admin-Seite: `/admin.html`. Beispielvariablen stehen in `.env.example`.

**Noch nötig vor öffentlichem Start:** SMTP-Absenderdomain verifizieren, Datenschutz- und Nutzungsbedingungen bereitstellen, Alters-/Einwilligungsprozess rechtlich prüfen, Passwort-Zurücksetzen ergänzen, Sicherheits- und Lasttests durchführen. Die aktuelle Registrierung fragt absichtlich kein Geburtsdatum ab und ist noch kein vollständiger Compliance-Prozess.

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
