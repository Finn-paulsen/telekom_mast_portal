# Telekom Mast Portal Demo

Kurzüberblick zu den erweiterten Demo-Interaktionen:

- **Session-Protokoll:** gruppierte Timeline mit Empty-, Loading- und Error-States sowie responsiven Badges, Timestamps und Fokuszuständen.
- **Aktionsanimationen:** Varianten `pulse`, `sweep`, `bounce`, `glitch-lite`, `radar-scan` und `signal-ripple`; Auswahl pro Aktion mit kurzer Cooldown-/Rotationslogik, damit wiederholte Klicks nicht identisch wirken.
- **Mast-States:** Idle-Ambient, aktiver Uplink-Boost, Scan, Kalibrierung, Synchronisierung, Warnung und Fehler/Interferenz. Intensität wird aus Telemetrie wie Signalqualität, Throughput, Sync-Lag und Paketverlust abgeleitet.
- **Demo-Daten:** `ad-demo.json` enthält jetzt Standort-, Klima-, KPI-, Alarm-, Wartungs- und Szenario-Daten (`normal`, `high-load`, `degraded`, `recovery`). `service.cert` enthält ergänzte Demo-Metadaten wie Validity, Policies, Fingerprint, OCSP und CRL.
