# Projekt TODO – Telekom Serviceportal Funkinfrastruktur v2

## Grundlage
- [x] Dark-Mode-Cyberpunk-Theme mit Telekom-Magenta in index.css
- [x] Google Fonts (technisch/industriell) einbinden
- [x] Datenmodell: Masten, Szenarien, Nutzer (shared/types)
- [x] Verbesserte ad-demo.json mit mehreren Funkmasten & Szenarien
- [x] Verbesserte service.cert (realistisches PEM-artiges Format)

## Animationssystem (Kernstück)
- [x] Hochdetaillierter Funkmast als SVG (Gittermast, Satellitenschüssel, Sektorantennen, Richtfunk, Beacon, Technikschrank, Kabel)
- [x] Idle-Animationen: Beacon-Blinken, Signalringe, Radar-Sweep, Sterne/Atmosphäre, Datenpakete
- [x] Aktion: Richtfunk ausrichten – min. 3 Zufallsvarianten
- [x] Aktion: Kalibrieren – min. 3 Zufallsvarianten
- [x] Aktion: Satellitenlink-Sync – min. 3 Zufallsvarianten
- [x] Aktion: Frequenzbandwechsel – min. 2 Zufallsvarianten
- [x] Dramatische Neustart-Sequenz: Herunterfahren (Lichter aus, Antennen einklappen, Signalabbruch) + Hochfahren (Statuslichter, Ausfahren, Signalaufbau)
- [x] Zufallsauswahl ohne direkte Wiederholung (Variant-Shuffle)
- [x] Wartungsmodus-Visualisierung
- [x] Störungs-/Fehler-Szenario-Visualisierung

## Login-Seite
- [x] Dark-Mode-Login mit animiertem Funkmast im Hintergrund
- [x] PKI-Token-Scan (File System Access API + Fallback) für ad-demo.json + service.cert
- [x] Fortschrittsanzeige + Echtzeit-Validierungsschritte beim Scan
- [x] Zertifikat-Validierungsanzeige (Seriennummer, Inhaber, Gültigkeit, Fingerprint)
- [x] Klare Fehlermeldungen (fehlende Datei, ungültiges Format, abgelaufen)
- [x] Benutzeranmeldung gegen ad-demo.json (Benutzer, Passwort, Mitarbeiter-ID, Token-Bindung)
- [x] Sicherheitsvorfall-Protokollierung bei ungültigen Versuchen

## Karte & Standortwahl
- [x] Google-Maps-Karte mit allen Funkmasten als Marker
- [x] Status pro Mast (aktiv / Wartung / Störung) farblich codiert
- [x] Info-Panel pro Mast mit Details + Button "Steuerung öffnen"
- [x] Auswahl öffnet Steuerungskonsole für diesen Standort

## Dashboard / Steuerungskonsole
- [x] Cyberpunk-Dashboard-Layout (Telemetrie links, Animation Mitte, Aktionen rechts)
- [x] Live-Telemetrie: Signal, Latenz, Lock, Azimut, Band, Durchsatz, Strom/Klima
- [x] Live-Signalqualitätsgraph (animiert)
- [x] Remote-Aktionen: Ausrichten, Kalibrieren, Sync, Bandwechsel, Diagnose, Wartungsmodus, Soft-Restart
- [x] Vorgangs-Timeline pro Aktion
- [x] Erweitertes Session-Protokoll: Filter, Export, farbcodierte Ereignistypen
- [x] Kollabierbare Seitenpanels
- [x] Header mit Mast-Wechsler, Nutzerinfo, Systemstatus, Uhrzeit

## Responsivität & Feinschliff
- [x] Optimierung für 1920px+ Monitore
- [x] Tablet-Layout
- [x] prefers-reduced-motion respektieren
- [x] Telekom-Logo als austauschbare Datei im public-Ordner (logo.svg)

## Tests & Auslieferung
- [x] Vitest-Tests für Kernlogik (Token-Validierung, Login, Zertifikat, Demo-Daten) – 20 Tests grün
- [x] Visuelle Verifikation per Screenshots + Browser-E2E (Scan → Login → Karte → Konsole → Aktionen)
- [x] Checkpoint + Übergabe

## Bugfixes (Nutzer-Meldung)
- [x] /karte: TypeError "Cannot read properties of undefined (reading 'icon')" in MastMap beheben (STATE_META-Zugriff mit unbekanntem state absichern)
