# Vaylox: kostenloser Hosting-Start

Dieses Setup vermeidet bewusst kostenpflichtige Render-Datenbanken. Es ist ein Hobby-/Test-Setup und keine Garantie für dauerhaft kostenlosen Betrieb oder Millionen Spieler.

## Architektur

- **Render Free Web Service:** hostet die Node.js-App. Kostenlose Dienste können nach 15 Minuten ohne Traffic schlafen und beim nächsten Aufruf ungefähr eine Minute zum Aufwachen benötigen.
- **Neon Free PostgreSQL:** speichert Konten, Sitzungen und veröffentlichte Welten. Der kostenlose Tarif nennt aktuell 1 GB Speicher und 100 Compute-Stunden pro Projekt und Monat. Limits und Tarifbedingungen können sich ändern.
- **Spieldateien:** bleiben im Git-Repository bzw. werden über die App ausgeliefert. Große Uploads brauchen später einen separaten Speicher/CDN.

Offizielle Tarifhinweise:
- Render: https://render.com/docs/free
- Neon Free: https://neon.com/pricing

## Einmalige Einrichtung der Datenbank

1. Ein eigenes Neon-Projekt im Free-Tarif erstellen.
2. In Neon die PostgreSQL-Verbindungsdaten öffnen und die Connection-String-URL kopieren. Wenn Neon eine gepoolte URL anbietet, für den Webdienst diese verwenden.
3. Im Render-Dashboard den Vaylox-Webdienst öffnen: **Environment**.
4. Nur die Variable `DATABASE_URL` setzen und die Neon-URL dort als geheimen Wert einfügen.
5. Speichern und den Dienst neu deployen.
6. Danach `https://vaylox.onrender.com/api/status` öffnen. `databaseConfigured: true` zeigt, dass die Variable gesetzt ist; es ersetzt keinen echten Datenbank- und Login-Test.

**Wichtig:** Die URL enthält ein Datenbankpasswort. Niemals in GitHub, Screenshots, öffentlichen Nachrichten oder Chatnachrichten posten. Nur im geheimen Environment-Feld des Hosters speichern.

## E-Mail für Konten

Registrierung und E-Mail-Bestätigung benötigen zusätzlich einen SMTP-Anbieter. Ohne SMTP sind neue Registrierungen absichtlich nicht vollständig verfügbar. SMTP-Variablen gehören ebenfalls nur in Render Environment. Niemals Geheimnisse in dieses Repository committen.

## Kostenlos heißt nicht unbegrenzt

- Render Free-Webdienste schlafen bei Inaktivität und haben monatliche Nutzungsgrenzen.
- Neon Free hat Speicher- und Compute-Grenzen; bei Überschreitung können Datenbankfunktionen eingeschränkt sein oder ein Tarifwechsel nötig werden.
- Kostenlose Tarife, Kontingente und Bedingungen können jederzeit geändert werden.
- Millionen gleichzeitige Spieler, dauerhafte Verfügbarkeit, Backups und große Asset-Mengen sind mit diesem kostenlosen Setup nicht realistisch garantiert.

Vaylox darf nicht automatisch auf einen kostenpflichtigen Tarif wechseln. Vor jeder Tarifänderung oder kostenpflichtigen Ressource ist eine ausdrückliche Zustimmung des Projektinhabers erforderlich.
