/**
 * Animation variant engine.
 *
 * Every remote action owns a pool of named animation variants. When an action
 * fires, a variant is drawn at random — but never the same variant twice in a
 * row, and a small history window further reduces repetition (shuffle-bag).
 */

export type ActionId =
  | "align"
  | "calibrate"
  | "sync"
  | "band"
  | "diagnose"
  | "maintenance"
  | "restart";

export interface VariantStage {
  /** Scene state applied to the SVG mast scene. */
  state: string;
  /** Duration in ms. */
  duration: number;
  /** Timeline label shown in the operation panel. */
  label: string;
  /** Optional metric overrides while this stage runs. */
  metrics?: Partial<Record<string, number | string>>;
  tone?: "run" | "ok" | "warn" | "err" | "info";
}

export interface AnimationVariant {
  id: string;
  /** Human-readable variant name shown in the log ("Verfahren B – Spiralscan"). */
  name: string;
  stages: VariantStage[];
}

const pools: Record<ActionId, AnimationVariant[]> = {
  align: [
    {
      id: "align-sweep",
      name: "Verfahren A · Horizontaler Präzisionsschwenk",
      stages: [
        { state: "dish-sweep-wide", duration: 2200, label: "Weiträumiger Azimut-Schwenk – Zielkorridor suchen", tone: "run", metrics: { signal: 58, lock: 12 } },
        { state: "dish-sweep-fine", duration: 2400, label: "Feinschwenk – Peak-Detektion läuft", tone: "run", metrics: { signal: 74, lock: 44 } },
        { state: "dish-lock", duration: 1800, label: "Ziel erfasst – Servo-Verriegelung", tone: "run", metrics: { signal: 88, lock: 79 } },
        { state: "success-burst", duration: 2000, label: "Ausrichtung abgeschlossen – Link gesichert", tone: "ok", metrics: { signal: 95, lock: 98 } },
      ],
    },
    {
      id: "align-spiral",
      name: "Verfahren B · Spiral-Suchmuster",
      stages: [
        { state: "dish-spiral", duration: 2600, label: "Spiralscan – Raster wird abgefahren", tone: "run", metrics: { signal: 52, lock: 8 } },
        { state: "dish-overshoot", duration: 1600, label: "Signalspitze überfahren – Rückkorrektur", tone: "warn", metrics: { signal: 70, lock: 35 } },
        { state: "dish-lock", duration: 1600, label: "Nachführung stabilisiert", tone: "run", metrics: { signal: 87, lock: 76 } },
        { state: "success-burst", duration: 2000, label: "Spiralverfahren erfolgreich – Korridor optimiert", tone: "ok", metrics: { signal: 94, lock: 97 } },
      ],
    },
    {
      id: "align-dual",
      name: "Verfahren C · Zweiachsen-Kreuzpeilung",
      stages: [
        { state: "dish-el-sweep", duration: 2000, label: "Elevationsachse – Vertikalpeilung", tone: "run", metrics: { signal: 61, lock: 18 } },
        { state: "dish-az-sweep", duration: 2000, label: "Azimutachse – Horizontalpeilung", tone: "run", metrics: { signal: 76, lock: 48 } },
        { state: "dish-microadjust", duration: 1900, label: "Mikrojustage – Servoimpulse < 0,1°", tone: "run", metrics: { signal: 89, lock: 82 } },
        { state: "success-burst", duration: 2000, label: "Kreuzpeilung abgeschlossen – Maximalpegel", tone: "ok", metrics: { signal: 96, lock: 99 } },
      ],
    },
  ],
  calibrate: [
    {
      id: "cal-motor",
      name: "Kalibrierprofil A · Servomotor-Testlauf",
      stages: [
        { state: "calib-motor-test", duration: 2400, label: "Motortest – alle Achsen werden verfahren", tone: "run", metrics: { signal: 66 } },
        { state: "calib-sensor", duration: 2200, label: "Sensorabgleich – Lagegeber werden genullt", tone: "run", metrics: { signal: 78 } },
        { state: "calib-verify", duration: 1800, label: "Verifikationslauf – Referenzpunkte anfahren", tone: "run", metrics: { signal: 88 } },
        { state: "success-burst", duration: 1800, label: "Kalibrierung bestätigt – Toleranzen im Soll", tone: "ok", metrics: { signal: 93 } },
      ],
    },
    {
      id: "cal-signal",
      name: "Kalibrierprofil B · Signalkette & Dämpfungsmessung",
      stages: [
        { state: "calib-injection", duration: 2000, label: "Testsignal wird eingespeist", tone: "run", metrics: { signal: 60 } },
        { state: "calib-spectrum", duration: 2600, label: "Spektralanalyse – Oberwellen werden vermessen", tone: "run", metrics: { signal: 75 } },
        { state: "calib-trim", duration: 1800, label: "Verstärkertrimmung – Pegel wird angepasst", tone: "run", metrics: { signal: 87 } },
        { state: "success-burst", duration: 1800, label: "Signalkette kalibriert – Dämpfung minimal", tone: "ok", metrics: { signal: 94 } },
      ],
    },
    {
      id: "cal-full",
      name: "Kalibrierprofil C · Vollsystem-Selbsttest",
      stages: [
        { state: "calib-poweron-test", duration: 1600, label: "Selbsttest – Baugruppen melden Status", tone: "run", metrics: { signal: 64 } },
        { state: "calib-motor-test", duration: 1800, label: "Aktorik-Prüfung – Schüssel & Antennenzüge", tone: "run", metrics: { signal: 72 } },
        { state: "calib-thermal", duration: 2000, label: "Thermalprüfung – Lüfter und Heizelemente", tone: "run", metrics: { signal: 81 } },
        { state: "calib-verify", duration: 1600, label: "Gesamtergebnis wird konsolidiert", tone: "run", metrics: { signal: 90 } },
        { state: "success-burst", duration: 1800, label: "Vollsystemtest bestanden – Integrität 99 %", tone: "ok", metrics: { signal: 95 } },
      ],
    },
  ],
  sync: [
    {
      id: "sync-handshake",
      name: "Sync-Modus A · Orbital-Handshake",
      stages: [
        { state: "sat-search", duration: 2200, label: "Satellit wird gesucht – Beacon-Scan 9.0E", tone: "run", metrics: { lock: 15 } },
        { state: "sat-handshake", duration: 2400, label: "Handshake – Trägerfrequenz wird verhandelt", tone: "run", metrics: { lock: 52 } },
        { state: "sat-datastream", duration: 2000, label: "Datenstrom aktiv – Paketumlauf wird gemessen", tone: "run", metrics: { lock: 84 } },
        { state: "success-burst", duration: 1800, label: "Relay-Verbindung gesichert", tone: "ok", metrics: { lock: 98 } },
      ],
    },
    {
      id: "sync-burst",
      name: "Sync-Modus B · Burst-Resynchronisation",
      stages: [
        { state: "sat-drop", duration: 1400, label: "Alte Session wird kontrolliert getrennt", tone: "warn", metrics: { lock: 5 } },
        { state: "sat-burst", duration: 2600, label: "Burst-Sequenz – Zeitschlitze werden neu vergeben", tone: "run", metrics: { lock: 48 } },
        { state: "sat-datastream", duration: 2000, label: "Trägersynchronität wird bestätigt", tone: "run", metrics: { lock: 86 } },
        { state: "success-burst", duration: 1800, label: "Burst-Resync erfolgreich – Sync-Lag minimal", tone: "ok", metrics: { lock: 99 } },
      ],
    },
    {
      id: "sync-precision",
      name: "Sync-Modus C · Präzisions-Nachführung",
      stages: [
        { state: "sat-track", duration: 2400, label: "Orbitposition wird nachgeführt", tone: "run", metrics: { lock: 30 } },
        { state: "sat-doppler", duration: 2200, label: "Doppler-Kompensation aktiv", tone: "run", metrics: { lock: 65 } },
        { state: "sat-datastream", duration: 1800, label: "Uplink-Pfad wird verifiziert", tone: "run", metrics: { lock: 88 } },
        { state: "success-burst", duration: 1800, label: "Präzisions-Sync abgeschlossen", tone: "ok", metrics: { lock: 98 } },
      ],
    },
  ],
  band: [
    {
      id: "band-soft",
      name: "Bandwechsel A · Sanfte Überblendung",
      stages: [
        { state: "band-prepare", duration: 1800, label: "Zielband wird vorbereitet – LNB umschalten", tone: "run" },
        { state: "band-crossfade", duration: 2200, label: "Trägerüberblendung – unterbrechungsfrei", tone: "run" },
        { state: "success-burst", duration: 1800, label: "Neues Band aktiv – Link stabilisiert", tone: "ok" },
      ],
    },
    {
      id: "band-hard",
      name: "Bandwechsel B · Hartumschaltung mit Requalifizierung",
      stages: [
        { state: "band-cut", duration: 1200, label: "Träger wird hart getrennt", tone: "warn" },
        { state: "band-requal", duration: 2400, label: "Requalifizierung – Bitfehlerrate wird gemessen", tone: "run" },
        { state: "band-rampup", duration: 1800, label: "Leistungsrampe – Sendepegel steigt", tone: "run" },
        { state: "success-burst", duration: 1800, label: "Hartumschaltung abgeschlossen", tone: "ok" },
      ],
    },
    {
      id: "band-adaptive",
      name: "Bandwechsel C · Adaptive Modulation",
      stages: [
        { state: "band-probe", duration: 2000, label: "Kanalmessung – Wetterreserve wird geprüft", tone: "run" },
        { state: "band-crossfade", duration: 2000, label: "Adaptive Umschaltung mit 256-QAM", tone: "run" },
        { state: "success-burst", duration: 1800, label: "Adaptives Profil aktiv", tone: "ok" },
      ],
    },
  ],
  diagnose: [
    {
      id: "diag-scan",
      name: "Diagnose A · Sensor-Vollscan",
      stages: [
        { state: "diag-scan", duration: 2600, label: "Sensorik wird sequenziell abgefragt", tone: "run" },
        { state: "diag-report", duration: 2000, label: "Bericht wird erstellt", tone: "run" },
        { state: "success-burst", duration: 1600, label: "Diagnose abgeschlossen – keine Anomalien", tone: "ok" },
      ],
    },
    {
      id: "diag-deep",
      name: "Diagnose B · Tiefenanalyse mit Lastprofil",
      stages: [
        { state: "diag-load", duration: 2200, label: "Lastprofil wird gefahren – Spitzenlast simuliert", tone: "run" },
        { state: "diag-thermal", duration: 2200, label: "Thermografie – Hotspots werden geprüft", tone: "run" },
        { state: "diag-report", duration: 1600, label: "Analyse wird ausgewertet", tone: "run" },
        { state: "success-burst", duration: 1600, label: "Tiefenanalyse bestanden – Systemintegrität 98 %", tone: "ok" },
      ],
    },
  ],
  maintenance: [
    {
      id: "maint-enter",
      name: "Wartungsmodus",
      stages: [
        { state: "maint-rampdown", duration: 1800, label: "Dienste werden kontrolliert eingeschränkt", tone: "warn" },
        { state: "maint-idle", duration: 1400, label: "Wartungsfenster aktiv", tone: "warn" },
      ],
    },
  ],
  restart: [
    {
      id: "restart-full",
      name: "Soft-Restart · Volle Sequenz",
      stages: [
        { state: "shutdown-warn", duration: 2000, label: "Neustart eingeleitet – Dienste werden angehalten", tone: "warn" },
        { state: "shutdown-lights", duration: 2200, label: "Statuslichter erlöschen – Sektoren offline", tone: "warn" },
        { state: "shutdown-fold", duration: 2600, label: "Antennenzüge fahren in Parkposition", tone: "warn" },
        { state: "shutdown-dark", duration: 2400, label: "Mast stromlos – Kaltstart wird vorbereitet", tone: "err" },
        { state: "boot-power", duration: 2200, label: "Energieversorgung kehrt zurück – USV-Test", tone: "run" },
        { state: "boot-lights", duration: 2200, label: "Statuslichter zünden sequenziell", tone: "run" },
        { state: "boot-unfold", duration: 2600, label: "Antennen fahren aus – Servos referenzieren", tone: "run" },
        { state: "boot-signal", duration: 2400, label: "Signalaufbau – Träger rasten ein", tone: "run" },
        { state: "success-burst", duration: 2200, label: "Neustart abgeschlossen – alle Systeme nominal", tone: "ok" },
      ],
    },
    {
      id: "restart-fast",
      name: "Soft-Restart · Schnellsequenz (Warm-Reboot)",
      stages: [
        { state: "shutdown-warn", duration: 1600, label: "Warm-Reboot – Dienste werden pausiert", tone: "warn" },
        { state: "shutdown-lights", duration: 1800, label: "Sektoren gehen gestaffelt offline", tone: "warn" },
        { state: "boot-power", duration: 1800, label: "Kernsysteme starten neu", tone: "run" },
        { state: "boot-lights", duration: 1800, label: "Sektor-Restore – Lichter kehren zurück", tone: "run" },
        { state: "boot-signal", duration: 2000, label: "Linkwiederaufbau läuft", tone: "run" },
        { state: "success-burst", duration: 2000, label: "Warm-Reboot abgeschlossen", tone: "ok" },
      ],
    },
  ],
};

/** Per-action history to avoid repeating variants. */
const history = new Map<ActionId, string[]>();

export function pickVariant(action: ActionId, rng: () => number = Math.random): AnimationVariant {
  const pool = pools[action];
  if (pool.length === 1) return pool[0];
  const recent = history.get(action) ?? [];
  // Exclude as many recent variants as possible while keeping at least 1 candidate
  const windowSize = Math.min(recent.length, pool.length - 1);
  const excluded = new Set(recent.slice(-windowSize));
  const candidates = pool.filter(v => !excluded.has(v.id));
  const chosen = candidates[Math.floor(rng() * candidates.length)] ?? pool[0];
  const nextHistory = [...recent, chosen.id].slice(-(pool.length - 1));
  history.set(action, nextHistory);
  return chosen;
}

export function getPool(action: ActionId): AnimationVariant[] {
  return pools[action];
}

/** Reset history (used by tests). */
export function resetVariantHistory() {
  history.clear();
}
