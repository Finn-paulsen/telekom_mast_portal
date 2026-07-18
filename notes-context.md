# Kontext-Notizen (für Weiterarbeit)

## Projekt
webdev-Projekt `telekom-mast-portal-v2` (/home/ubuntu/telekom-mast-portal-v2), Dev-URL: https://3000-ie40xn17722pzjpo5ixh1-e5a3509a.us2.manus.computer
Altes Repo in /home/ubuntu/telekom_portal (Finn-paulsen/telekom_mast_portal).

## Nutzeranforderungen
1. Fallout-4-artige Mast-Animationen, Zufallsvarianten pro Aktion, dramatischer Neustart (runter+hoch).
2. Dark-Cyberpunk mit Telekom-Magenta #e20074. Logo /logo.svg in client/public austauschbar – NICHT ändern.
3. PKI-Login: Dateien ad-demo.json + service.cert (Namen fix). Demo-Login: MZimmermann / T3l3k0m! / MZ204, Token-Serial 34F7A1B2C3D4E5F6.
4. Google-Maps-Karte mit 5 Masten (QK-17 aktiv, HH-NORD-05 high-load, KI-OST-11 Wartung, HB-WEST-03 Störung, FL-SUED-08 Neustart).
5. Session-Protokoll mit Filter/Export, kollabierbare Panels, responsive.

## Status: FERTIG GEBAUT
- index.css Cyberpunk-Theme, Fonts in index.html (Rajdhani/Orbitron/Share Tech Mono).
- shared/masts.ts (Typen, parseCertificate, validateCertificate, validateDirectory, checkLogin).
- client/src/lib/animationVariants.ts (pickVariant mit Anti-Wiederholung, resetVariantHistory; Pools: align 3, calibrate 3, sync 3, band 3, diagnose 2, maintenance 1, restart 2).
- client/src/lib/demoData.ts (DEMO_DIRECTORY Fallback).
- token-demo/ad-demo.json + token-demo/service.cert (verbesserte Token-Dateien, cert gültig 2026-01-09 bis 2027-01-09).
- client/src/components/mast/MastScene.tsx (SVG 920x560, GSAP, Handle setState/reset, Idle-Loops + ~35 Szenen-States inkl. shutdown-*/boot-*).
- client/src/contexts/PortalSession.tsx, client/src/hooks/useTokenScanner.ts (6-Schritte-Scan, FS Access API + Fallback webkitdirectory).
- Seiten: Login.tsx (/), MastMap.tsx (/karte), MastConsole.tsx (/mast/:siteId). App.tsx dark theme + Routen.
- gsap installiert. TypeScript 0 Fehler. Login-Seite gerendert OK (Browser-Check: Mast-Hintergrund sichtbar, Sterne, Satellit).

## Testergebnisse (Browser)
- PKI-Scan-Flow FUNKTIONIERT: Upload via Label#token-file-input (Element "Manuell auswählen", browser_upload_file auf Label-Index), Scan lief 6 Schritte durch, Token-Status-Panel voll gefüllt (SN 34F7A1B2C3D4E5F6, Servicetechniker Hydra, ECDSA-P256, Fingerprint), Token-Bezeichner-Feld autobefüllt, Badge "DIENST-TOKEN VERBUNDEN".
- ad-demo.json v3 enthält 1 Benutzer + 5 Funkstandorte. Login-Felder: Benutzername=MZimmermann (input idx5), Passwort=T3l3k0m! (idx7), Dienstnummer=MZ204 (idx9), dann ANMELDEN (idx14).

## Konsolen-Test OK (Browser)
- Login → /karte: 5 Standorte in Liste + Google-Maps-Marker, InfoWindow mit STEUERN-Button funktioniert.
- /mast/QK-17: Telemetrie live, Signal-Graph reagiert auf Aktionen, Session-Panel gefüllt.
- Soft-Restart: Variante "Schnellsequenz (Warm-Reboot)" lief komplett durch (Fortschritt, Phasentexte, Status NEUSTART LÄUFT, Signal/Lock auf –, danach Vorgang abgeschlossen + Toast + TARGET LOCK overlay).
- Richtfunk ausrichten: Variante "Verfahren C · Zweiachsen-Kreuzpeilung" gestartet, Lock/Signal-Werte reagieren dynamisch, Buttons während Vorgang gesperrt.
- Session-Protokoll: Filter-Buttons (Alle/Aktion/Telemetrie/Sicherheit/Wartung/Fehler/Session) + TXT/JSON-Export vorhanden, Einträge farbkodiert.

## Verifikationsstatus (Phase 6)
- 28 Vitest-Tests grün: server/portal.logic.test.ts (19), server/animation.variants.test.ts (8), auth.logout (1).
- Varianten-Engine geprüft: align/calibrate/sync/band je >=3 Varianten, diagnose/restart >=2, pickVariant nie 2x hintereinander gleich (Test bewiesen).
- prefers-reduced-motion: MastScene.tsx Z.75 (matchMedia) + index.css Z.284 vorhanden.
- Kollabierbare Panels: MastConsole.tsx leftOpen/rightOpen States Z.93-94 mit Toggle-Buttons Z.449/591 (SYSTEM-ÜBERSICHT/FERNSTEUERUNG-Buttons im Header getestet? Buttons idx9/10 existieren).
- NOCH OFFEN: (a) Sicherheitsvorfall bei Fehllogin wird nur als incident-State gesetzt – prüfen ob es in sessionStorage-Log/Protokoll geschrieben wird; (b) 1920px-Screenshot; (c) Panel-Collapse im Browser klicken; (d) Checkpoint + Lieferung.
- Dev-Server-Fehler im Log sind ALT (18:23, MastConsole existierte kurz nicht) – aktuell 0 TS-Fehler.

## Finaler E2E-Test (Runde 2, nach Incident-Fix)
- Login-Flow erneut komplett grün: Upload via Label idx3 → Scan 100% (6 Schritte, OCSP/CRL) → Felder idx5/7/9 → ANMELDEN idx14 → /karte.
- Karte OK: 5 Standorte, Status farbcodiert (In Betrieb grün, Wartung gelb, Störung rot, Neustart cyan), Marker auf Google Map sichtbar.
- Hinweis Karte: Map-Kacheln wirken hell/grau im Screenshot – evtl. lädt der Dark-Style verzögert oder Styles fehlen. Prüfen: MastMap.tsx styles-Array.
- HB-WEST-03 (Störung) getestet: Richtfunklink "Instabil" rot, Signalqualität 41%, Live-Graph läuft, Session-Panel OK.
- Panel-Collapse SYSTEM-ÜBERSICHT getestet: klappt ein/aus, Mastszene wird breiter. Funktioniert.
- Frequenzband wechseln getestet: Variante "Bandwechsel B · Hartumschaltung mit Requalifizierung" mit Fortschritt + Phasentext + Protokolleinträgen. Zufallsvarianten funktionieren.
- Session-Protokoll: Filter-Buttons (Alle/Aktion/Telemetrie/Sicherheit/Wartung/Fehler/Session) + TXT/JSON-Export vorhanden.
- ALLE Tests bestanden → Checkpoint + Lieferung.

## Offene Schritte
1. Login-Flow im Browser testen: Scan via "Manuell auswählen" geht nicht per Browser-Tool einfach (Ordner-Picker). Alternative: Test über file input upload? webkitdirectory-Input akzeptiert Datei-Upload via browser_upload_file evtl. nicht mit Ordnerstruktur. Plan B: Vitest-Tests decken checkLogin/Parse ab; UI-Flow manuell durch Nutzer.
   -> Für Browser-E2E: browser_upload_file auf den versteckten Input (index nach Klick auf "Manuell auswählen" nicht nötig – Input direkt ansteuerbar) mit /home/ubuntu/telekom-mast-portal-v2/token-demo/ad-demo.json und service.cert.
2. Vitest-Tests schreiben: server/portal.logic.test.ts (Import aus ../shared/masts und client lib animationVariants) – prüfen ob vitest config client-Pfade includet (vitest.config.ts checken; ggf. Tests unter server/ mit relativen Imports).
3. pnpm test laufen lassen, Screenshots Karte+Konsole nach Login (Guard: ohne Login redirect zu /; für Screenshot-Test evtl. Guard temporär egal – Konsole /mast/QK-17 nutzt DEMO_DIRECTORY Fallback, aber user==null → redirect. Testen via Browser nach echtem Login).
4. todo.md abhaken, README kurz, Checkpoint, GitHub push (Repo Finn-paulsen/telekom_mast_portal – neuen Branch oder direkt? Nutzer sagte "retten" – Code liegt im webdev-Projekt; zusätzlich Push ins GitHub-Repo sinnvoll, Ordner token-demo mit ad-demo.json/service.cert beilegen).
5. Ergebnis liefern mit Anleitung (Login-Daten, Token-Ordner).
