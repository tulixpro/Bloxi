# Bloxi – Zielplattform und Architektur

## Produktziel

Bloxi soll eine eigenständige Plattform für nutzergenerierte 3D-Spiele werden: eine Mischung aus einer Spiele-Community und einer kreativen Voxel-Sandbox. Die Website ist der öffentliche Einstieg und das Spiele-Entdecken-Menü. Der installierbare Client enthält dieselbe Konto-, Avatar-, Shop- und Spielebibliothek und startet veröffentlichte Erlebnisse.

## Geplante Bereiche

1. **Discover / Hauptmenü** – Empfehlungen, Suche, Kategorien, zuletzt gespielt und Community-Erlebnisse.
2. **Accounts und Profile** – sichere Anmeldung, Profil, Freundesliste und Privatsphäre-Einstellungen.
3. **Avatar** – modularer Charakter, Farben, Kleidung, kosmetische Items und gespeicherte Outfits.
4. **Coins und Shop** – serverseitiges virtuelles Guthaben, Belohnungen für Spielaktivität und Käufe rein kosmetischer Items. Keine Echtgeld-Käufe als Voraussetzung.
5. **Bloxi Player** – 3D-Voxel-Engine, Spiel-Laufzeit, Multiplayer und plattformübergreifende Eingabe.
6. **Bloxi Studio** – Welt-Editor, Assets, einfache Gameplay-Logik, Testmodus, Speichern und Veröffentlichen.
7. **Creator-Plattform** – Versionen, öffentliche Spielseiten, Melden/Moderation und sichere Veröffentlichung.

## Plattformstrategie

Zielgeräte: Windows, macOS, Linux, Android und iOS.

Der aktuelle Electron-Prototyp ist nur ein früher Desktop-/Web-Technikversuch. Electron ist keine gemeinsame Android-/iOS-Lösung. Für das eigentliche 3D-Spiel und Studio sollte ein plattformübergreifender Game-Engine-Client evaluiert werden (beispielsweise Godot), mit einem gemeinsamen Backend und plattformangepasster Steuerung. Die Engine-Entscheidung muss anhand von 3D-Performance, Multiplayer-Netzwerkcode, Editor-Bedarf, Export-Zielen und Geräte-Tests getroffen werden.

Die Website bleibt ein responsives Web-Frontend für Entdecken, Profile und Creator-Seiten. Das Spiel selbst läuft als installierbarer Client; ein mobiler Client benötigt Touch-Steuerung und mobile UI. iOS-Veröffentlichung erfordert zusätzlich Apples Build-/Signierungs- und App-Store-Prozess.

## Architektur, langfristig

- Web/API: Accounts, Profile, Inventar, Spielmetadaten und Creator-Uploads.
- Datenbank: Benutzer, Avatar-Konfiguration, Coins-Ledger, Inventar, veröffentlichte Spiele und Versionen.
- Realtime-Dienste: Matchmaking, Lobbys, Präsenz und autoritative Multiplayer-Spielserver.
- Storage/CDN: Spielpakete, Assets, Vorschaubilder und Updates.
- Moderation/Sicherheit: Upload-Prüfung, Melden/Blockieren, Chat-Schutz, Rate-Limits, Berechtigungen und sichere Ausführung von Creator-Inhalten.

## Wichtige Regeln für Coins

- Guthaben und Transaktionen werden ausschließlich serverseitig autorisiert.
- Spielbelohnungen werden serverseitig validiert; der Client darf sein Guthaben nicht selbst erhöhen.
- Shop-Käufe sind atomar: Coin-Abzug und Item-Vergabe gehören in dieselbe Datenbanktransaktion.
- Zunächst nur virtuelle, kosmetische Items; kein Handel gegen Echtgeld und keine zufälligen bezahlten Lootboxen.
- Demo-Coins in der Website sind ausdrücklich nicht echt und werden nicht mit einem Konto synchronisiert.

## Umsetzungsreihenfolge

1. Produkt-UI und Navigation der Website (aktuelle Vorschau).
2. Engine-Prototyp: Voxel-Welt, Kamera, Bewegung, Blöcke platzieren/abbauen und Speichern.
3. Gemeinsamer Account-/Profil-/Inventar-Backend-Prototyp.
4. Autoritativer Multiplayer mit kleinen Räumen und Tests.
5. Studio-Editor und Veröffentlichung eines einfachen Spiels.
6. Coins-Ledger, Belohnungen und kosmetischer Shop.
7. Windows/macOS/Linux Builds, danach Android/iOS Builds und Geräte-Tests.
8. Moderation, Lasttests, Backups, Datenschutz und öffentlicher Start.

## Status heute

Die Website zeigt eine Produkt-/UI-Vorschau. Der vorhandene Node-/Socket.IO-Code ist ein kleiner Multiplayer-Techniktest; die Electron-Hülle ist kein fertiger plattformübergreifender Client. Es gibt noch keine echten Konten, persistente Inventare, echte Coins, fertige 3D-Engine, Matchmaking-Infrastruktur oder veröffentlichte Spiele. Keine der Zielplattformen hat bereits einen getesteten, veröffentlichten Bloxi-Build.
