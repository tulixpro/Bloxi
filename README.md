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
- Multiplayer-Sitzungen werden serverseitig gegen gültige, bestätigte Login-Sitzungen geprüft
- Der Server bestimmt den Spielernamen aus dem Account statt aus Client-Eingaben
- Serverseitige Bewegungsgrenzen und Ereignis-Limits als erste Anti-Cheat-Schicht
- Veröffentlichte Welten werden dauerhaft in PostgreSQL gespeichert und sind nur für angemeldete, bestätigte Spieler veröffentlichbar
- Vaylox Studio-Prototyp mit Raster, Gras-, Stein-, Wasser- und Sandfeldern
- Veröffentlichung einer gebauten Welt auf dem laufenden Server
- Einfache Status- und Welten-API

## Datenbank, Accounts und Zugriffsschutz

Vaylox verwendet PostgreSQL. Beim Start legt der Server die Tabellen für Accounts, Sitzungen, E-Mail-Bestätigungstokens und veröffentlichte Welten automatisch an. Die SQL-Struktur liegt zusätzlich in `database/schema.sql`. Die Datenbank selbst wird nicht im GitHub-Repository gespeichert: `DATABASE_URL` muss als geheime Hosting-Variable auf eine private PostgreSQL-Instanz zeigen. Zugangsdaten niemals committen oder in Chats teilen. In Produktion prüft der PostgreSQL-Client TLS-Zertifikate.

Für Registrierung und E-Mail-Bestätigung müssen außerdem `APP_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` und `SMTP_FROM` gesetzt sein. Passwörter werden mit bcrypt gehasht; Session- und Bestätigungstokens werden nur als SHA-256-Hashes gespeichert.

Das Admin-Konto wird beim Serverstart aus `VAYLOX_ADMIN_USERNAME`, `VAYLOX_ADMIN_EMAIL` und `VAYLOX_ADMIN_PASSWORD` eingerichtet. Benutzername ist standardmäßig `VayloxAdmin`. Die E-Mail muss eindeutig sein und das Passwort mindestens 12 Zeichen lang. Die öffentliche Registrierung kann keine Admin-Rolle vergeben. Admin-Passwort niemals in HTML, JavaScript, GitHub oder einem Chat speichern. Admin-Seite: `/admin.html`. Beispielvariablen stehen in `.env.example`.

**Noch nötig vor öffentlichem Start:** SMTP-Absenderdomain verifizieren, Datenschutz- und Nutzungsbedingungen bereitstellen, Alters-/Einwilligungsprozess rechtlich prüfen, Passwort-Zurücksetzen ergänzen, Sicherheits- und Lasttests durchführen. Die aktuelle Registrierung fragt absichtlich kein Geburtsdatum ab und ist noch kein vollständiger Compliance-Prozess.

## Deployment

Eine Render-Konfiguration liegt in `render.yaml`. Sie erstellt nur den Webdienst; eine PostgreSQL-Datenbank muss separat bei einem Anbieter eingerichtet und über `DATABASE_URL` verbunden werden. Der Dienst ist noch nicht deployed. Prüfe Preise, Limits und Laufzeit des Datenbank- und Hosting-Angebots, bevor du es aktivierst. Für die erste Einrichtung müssen SMTP-Zugangsdaten, `APP_BASE_URL`, Admin-E-Mail und ein langes Admin-Passwort als Secrets gesetzt werden. Keine echten Zugangsdaten in GitHub oder in Chatnachrichten eintragen.

## Noch nicht fertig

- Vollständiges Benutzerkontensystem, Registrierung, sichere normale Anmeldung und Passwort-Reset
- Passwort-Zurücksetzen, Moderation und vollständiger Sicherheits-/Lasttest
- 3D-Spielengine, Physik, Animationen und richtige Spielmechaniken
- Freundesliste, Einladungen, Chat, Moderation und Meldefunktionen
- Sichere Prüfung und Begrenzung veröffentlichter Inhalte
- Öffentliche Spielserver, Matchmaking, Skalierung und automatische Bereitstellung
- Signierte, getestete Installer und automatische Updates

**Sicherheitsgrenzen:** Das ist eine erste Schutzschicht, kein vollständiges Anti-Cheat-System und keine Garantie gegen Angriffe. Die Bewegung wird serverseitig begrenzt, aber echte Spiele brauchen zusätzlich serverautoritatives Gameplay, Berechtigungsprüfungen pro Aktion, Moderation, Monitoring, Backups und Last-/Penetrationstests. Socket.IO verlangt jetzt ein gültiges Login-Cookie; nicht angemeldete Clients werden abgewiesen. Vor öffentlichem Start muss das komplette Spielprotokoll geprüft und getestet werden.

## Kosten

Die lokale Entwicklung und das Erstellen eines Installers sind kostenlos. Online-Multiplayer benötigt dauerhaft erreichbare Server und Datenbankkapazität. Kostenlose Hosting-Angebote haben Limits und können schlafen gehen; dauerhaft viele gleichzeitige Spieler sind nicht garantiert kostenlos.
