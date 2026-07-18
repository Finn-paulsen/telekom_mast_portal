import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { MastScene, type MastSceneHandle } from "@/components/mast/MastScene";
import { usePortalSession } from "@/contexts/PortalSession";
import { DEMO_DIRECTORY } from "@/lib/demoData";
import { pickVariant, type ActionId } from "@/lib/animationVariants";
import type { LogEntry, LogTone, MastSite } from "@shared/masts";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip as ReTooltip } from "recharts";
import { toast } from "sonner";
import {
  RadioTower,
  LogOut,
  Map as MapIcon,
  Crosshair,
  Wrench,
  RefreshCcw,
  Waves,
  Activity,
  AlertTriangle,
  Power,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Satellite,
  Thermometer,
  BatteryCharging,
  Wind,
  Gauge,
  ScrollText,
  PanelLeftClose,
  PanelRightClose,
} from "lucide-react";

/* ---------------- helpers ---------------- */

const TONE_META: Record<LogTone, { label: string; cls: string }> = {
  action: { label: "Aktion", cls: "log-tone-action" },
  telemetry: { label: "Telemetrie", cls: "log-tone-telemetry" },
  session: { label: "Session", cls: "log-tone-session" },
  security: { label: "Sicherheit", cls: "log-tone-security" },
  error: { label: "Fehler", cls: "log-tone-error" },
  maintenance: { label: "Wartung", cls: "log-tone-maintenance" },
  hint: { label: "Hinweis", cls: "log-tone-hint" },
  info: { label: "Info", cls: "log-tone-info" },
};

interface ActionDef {
  id: ActionId;
  title: string;
  subtitle: string;
  icon: typeof Crosshair;
  group: "Antennensteuerung" | "Übertragung" | "Systemverwaltung";
  danger?: boolean;
}

const ACTIONS: ActionDef[] = [
  { id: "align", title: "Richtfunk-Schüssel ausrichten", subtitle: "Korridor optimieren", icon: Crosshair, group: "Antennensteuerung" },
  { id: "calibrate", title: "Systemkalibrierung", subtitle: "Motortest und Signalmessung", icon: Gauge, group: "Antennensteuerung" },
  { id: "sync", title: "Satellitenlink synchronisieren", subtitle: "Relay-Verbindung neu aufbauen", icon: Satellite, group: "Antennensteuerung" },
  { id: "band", title: "Frequenzband wechseln", subtitle: "Ku-Band ↔ Ka-Band", icon: Waves, group: "Übertragung" },
  { id: "diagnose", title: "Systemdiagnose", subtitle: "Antennenmotor, Signalmast, Sensorik", icon: Activity, group: "Systemverwaltung" },
  { id: "maintenance", title: "Wartungsmodus setzen", subtitle: "Dienste temporär einschränken", icon: Wrench, group: "Systemverwaltung" },
  { id: "restart", title: "Soft-Restart", subtitle: "Mast herunter- und wieder hochfahren", icon: Power, group: "Systemverwaltung", danger: true },
];

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m ${s % 60}s`;
}

/* ---------------- component ---------------- */

export default function MastConsole() {
  const params = useParams<{ siteId: string }>();
  const [, navigate] = useLocation();
  const session = usePortalSession();
  const sceneRef = useRef<MastSceneHandle>(null);

  const sites = session.directory?.sites ?? DEMO_DIRECTORY.sites;
  const site: MastSite | undefined = sites.find(s => s.siteId === params.siteId);

  const [clock, setClock] = useState(() => new Date());
  const [sessionStart] = useState(() => Date.now());
  const [busyAction, setBusyAction] = useState<ActionId | null>(null);
  const [opLabel, setOpLabel] = useState<string>("–");
  const [opVariant, setOpVariant] = useState<string>("");
  const [opProgress, setOpProgress] = useState(0);
  const [systemState, setSystemState] = useState<"ready" | "busy" | "offline" | "maintenance">("ready");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [logFilter, setLogFilter] = useState<LogTone | "all">("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const [metrics, setMetrics] = useState(() => ({
    signal: 0,
    latency: 0,
    lock: 0,
    azimuth: 0,
    band: "Ku-Band" as string,
    uplink: 0,
    downlink: 0,
    temperature: 0,
    battery: 0,
  }));
  const [history, setHistory] = useState<{ t: string; signal: number; lock: number }[]>([]);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const runTokenRef = useRef(0);

  const addLog = useCallback((tone: LogTone, title: string, detail: string) => {
    setLogs(prev => {
      const id = ++logIdRef.current;
      return [{ id, time: new Date(), tone, title, detail }, ...prev].slice(0, 250);
    });
  }, []);

  /* clock */
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* guard */
  useEffect(() => {
    if (!session.user) navigate("/");
  }, [session.user, navigate]);

  /* init metrics from site */
  useEffect(() => {
    if (!site) return;
    setMetrics({
      signal: site.telemetry.signalQuality,
      latency: site.telemetry.latency,
      lock: site.telemetry.lock,
      azimuth: site.telemetry.azimuth,
      band: site.telemetry.band,
      uplink: site.telemetry.uplink,
      downlink: site.telemetry.downlink,
      temperature: site.telemetry.temperature,
      battery: site.telemetry.battery,
    });
    setMaintenanceActive(site.state === "maintenance");
    setSystemState(site.state === "maintenance" ? "maintenance" : "ready");
    addLog("session", "Remote-Session gestartet", `${site.mastId} · Standort ${site.siteId} · Operator ${session.user?.displayName ?? "–"}`);
    addLog("security", "Token-Bindung aktiv", `PKI-Serial ${session.cert?.serial ?? "–"} autorisiert für ${site.siteId}`);
    session.securityIncidents.forEach(inc => {
      addLog(
        "security",
        "Sicherheitsvorfall (Anmeldung)",
        `${new Date(inc.time).toLocaleTimeString("de-DE")} · ${inc.message}`,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.siteId]);

  /* ambient telemetry drift + graph */
  useEffect(() => {
    if (!site) return;
    const t = setInterval(() => {
      setMetrics(m => {
        const drift = (v: number, amp: number, min: number, max: number) =>
          Math.max(min, Math.min(max, v + (Math.random() - 0.5) * amp));
        const next = {
          ...m,
          signal: Math.round(drift(m.signal, 3, 5, 99)),
          latency: Math.round(drift(m.latency, 4, 8, 140)),
          uplink: Math.round(drift(m.uplink, 4, 0, 95)),
          downlink: Math.round(drift(m.downlink, 5, 0, 120)),
          temperature: Math.round(drift(m.temperature, 1, 18, 46)),
        };
        return next;
      });
      setHistory(h => {
        const now = new Date();
        const label = now.toLocaleTimeString("de-DE", { minute: "2-digit", second: "2-digit" });
        return [...h.slice(-29), { t: label, signal: metricsRef.current.signal, lock: metricsRef.current.lock }];
      });
      if (Math.random() < 0.2) {
        const events = [
          ["telemetry", "Telemetrie-Sweep", "Zyklische Sensordaten empfangen – Werte im Normbereich"],
          ["telemetry", "Wetterstation", `Wind ${Math.round(10 + Math.random() * 25)} km/h · Feuchte ${Math.round(50 + Math.random() * 30)} %`],
          ["info", "Monitoring", "Heartbeat an NOC Nord übertragen"],
          ["telemetry", "Traffic-Sample", `Durchsatz ↑${Math.round(30 + Math.random() * 40)} / ↓${Math.round(50 + Math.random() * 50)} Mbps`],
        ] as const;
        const e = events[Math.floor(Math.random() * events.length)];
        addLog(e[0], e[1], e[2]);
      }
    }, 3200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.siteId]);

  const metricsRef = useRef(metrics);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  /* ---------------- operation runner ---------------- */
  const runOperation = useCallback(
    (action: ActionDef) => {
      if (!site) return;
      if (busyAction) {
        toast.warning("Es läuft bereits ein Vorgang", { description: "Bitte warten, bis der aktuelle Vorgang abgeschlossen ist." });
        return;
      }
      if (maintenanceActive && action.id !== "maintenance" && action.id !== "diagnose") {
        toast.error("Wartungsmodus aktiv", { description: "Nur Diagnose und Wartungsmodus-Umschaltung sind zulässig." });
        addLog("security", "Aktion blockiert", `${action.title} während Wartungsfenster verweigert`);
        return;
      }

      // maintenance toggle off
      if (action.id === "maintenance" && maintenanceActive) {
        setMaintenanceActive(false);
        setSystemState("ready");
        sceneRef.current?.setState("success-burst");
        addLog("maintenance", "Wartungsmodus beendet", "Alle Dienste wieder freigegeben");
        toast.success("Wartungsmodus beendet");
        return;
      }

      const variant = pickVariant(action.id);
      const token = ++runTokenRef.current;
      setBusyAction(action.id);
      setSystemState(action.id === "restart" ? "offline" : "busy");
      setOpVariant(variant.name);
      setOpProgress(0);
      addLog("action", `${action.title} gestartet`, variant.name);

      const total = variant.stages.reduce((a, s) => a + s.duration, 0);
      let elapsed = 0;

      const runStage = (idx: number) => {
        if (runTokenRef.current !== token) return;
        if (idx >= variant.stages.length) {
          // done
          setBusyAction(null);
          setOpProgress(100);
          setOpLabel("Vorgang abgeschlossen");
          if (action.id === "maintenance") {
            setMaintenanceActive(true);
            setSystemState("maintenance");
            addLog("maintenance", "Wartungsmodus aktiv", "Dienste temporär eingeschränkt – Monitoring läuft weiter");
            toast.warning("Wartungsmodus aktiv");
          } else {
            setSystemState("ready");
            addLog("action", `${action.title} abgeschlossen`, `${variant.name} · Dauer ${(total / 1000).toFixed(1)} s`);
            toast.success(`${action.title} abgeschlossen`, { description: variant.name });
            if (action.id === "band") {
              setMetrics(m => ({ ...m, band: m.band === "Ku-Band" ? "Ka-Band" : "Ku-Band" }));
            }
            if (action.id === "restart") {
              setMetrics(m => ({ ...m, signal: 95, lock: 99, latency: 21 }));
              addLog("telemetry", "System nach Neustart nominal", "Alle Baugruppen melden Status OK");
            }
          }
          return;
        }
        const stage = variant.stages[idx];
        setOpLabel(stage.label);
        sceneRef.current?.setState(stage.state);
        addLog(
          stage.tone === "err" ? "error" : stage.tone === "warn" ? "maintenance" : "action",
          stage.label,
          `${variant.name} · Phase ${idx + 1}/${variant.stages.length}`,
        );
        if (stage.metrics) {
          setMetrics(m => {
            const n = { ...m };
            if (typeof stage.metrics?.signal === "number") n.signal = stage.metrics.signal;
            if (typeof stage.metrics?.lock === "number") n.lock = stage.metrics.lock;
            return n;
          });
        }
        if (action.id === "restart") {
          // dramatic metric collapse & recovery
          const stageIsDown = stage.state.startsWith("shutdown");
          if (stageIsDown) setMetrics(m => ({ ...m, signal: Math.max(0, m.signal - 30), lock: Math.max(0, m.lock - 40), uplink: 0, downlink: 0 }));
          if (stage.state === "shutdown-dark") setMetrics(m => ({ ...m, signal: 0, lock: 0, latency: 0 }));
          if (stage.state === "boot-signal") setMetrics(m => ({ ...m, signal: 62, lock: 55, uplink: 22, downlink: 35, latency: 38 }));
        }
        // progress animation
        const start = elapsed;
        const stepStart = Date.now();
        const iv = setInterval(() => {
          if (runTokenRef.current !== token) {
            clearInterval(iv);
            return;
          }
          const p = Math.min(1, (Date.now() - stepStart) / stage.duration);
          setOpProgress(Math.round(((start + p * stage.duration) / total) * 100));
          if (p >= 1) clearInterval(iv);
        }, 120);
        elapsed += stage.duration;
        setTimeout(() => runStage(idx + 1), stage.duration);
      };

      runStage(0);
    },
    [site, busyAction, maintenanceActive, addLog],
  );

  /* export log */
  const exportLog = (format: "txt" | "json") => {
    const data =
      format === "json"
        ? JSON.stringify(
            logs.map(l => ({ time: l.time.toISOString(), type: l.tone, title: l.title, detail: l.detail })),
            null,
            2,
          )
        : logs
            .slice()
            .reverse()
            .map(l => `[${l.time.toLocaleString("de-DE")}] [${TONE_META[l.tone].label.toUpperCase()}] ${l.title} – ${l.detail}`)
            .join("\n");
    const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-protokoll_${site?.siteId ?? "mast"}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    addLog("session", "Protokoll exportiert", `Format ${format.toUpperCase()} · ${logs.length} Einträge`);
  };

  const filteredLogs = logFilter === "all" ? logs : logs.filter(l => l.tone === logFilter);

  if (!session.user) return null;
  if (!site) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <AlertTriangle className="h-10 w-10 text-[#e8b13f]" />
        <div className="font-display text-lg font-bold">Funkstandort nicht gefunden</div>
        <button
          onClick={() => navigate("/karte")}
          className="rounded-md bg-primary px-4 py-2 font-tech text-sm text-primary-foreground"
        >
          Zurück zur Karte
        </button>
      </div>
    );
  }

  const stateBadge =
    systemState === "ready"
      ? { txt: maintenanceActive ? "WARTUNG" : "BEREIT", color: maintenanceActive ? "#e8b13f" : "#31d47c" }
      : systemState === "busy"
        ? { txt: "VORGANG AKTIV", color: "#3fd0e8" }
        : systemState === "offline"
          ? { txt: "NEUSTART LÄUFT", color: "#e2453b" }
          : { txt: "WARTUNG", color: "#e8b13f" };

  const groups = ["Antennensteuerung", "Übertragung", "Systemverwaltung"] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ---------- header ---------- */}
      <header className="z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur-md lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo.svg" alt="Telekom" className="h-8 w-8 rounded-sm" />
          <div className="min-w-0">
            <div className="truncate font-display text-[13px] font-bold tracking-wider">
              SERVICEPORTAL · FUNKINFRASTRUKTUR
            </div>
            <div className="flex items-center gap-2 font-tech text-[10px] text-muted-foreground">
              <button onClick={() => navigate("/karte")} className="inline-flex items-center gap-1 hover:text-primary">
                <MapIcon className="h-3 w-3" /> Karte
              </button>
              <span>·</span>
              <span className="truncate">
                {site.name} · {site.mastId}
              </span>
            </div>
          </div>
        </div>

        {/* mast switcher */}
        <div className="hidden items-center gap-1.5 md:flex">
          {sites.map(s => (
            <button
              key={s.siteId}
              onClick={() => s.siteId !== site.siteId && navigate(`/mast/${s.siteId}`)}
              className={`rounded-md border px-2.5 py-1.5 font-tech text-[10px] transition ${
                s.siteId === site.siteId
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
              title={s.name}
            >
              {s.siteId}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span
            className="hidden items-center gap-2 rounded-full border px-3 py-1 font-tech text-[10px] sm:inline-flex"
            style={{ color: stateBadge.color, borderColor: `${stateBadge.color}55`, background: `${stateBadge.color}14` }}
          >
            <span className="status-dot" style={{ background: stateBadge.color, boxShadow: `0 0 8px ${stateBadge.color}` }} />
            {stateBadge.txt}
          </span>
          <div className="hidden text-right lg:block">
            <div className="font-tech text-[11px] font-semibold">{session.user.displayName}</div>
            <div className="font-tech text-[9px] text-muted-foreground">{session.user.role}</div>
          </div>
          <span className="font-tech text-xs tabular-nums text-foreground/80">{clock.toLocaleTimeString("de-DE")}</span>
          <button
            onClick={() => {
              session.logout();
              navigate("/");
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 font-tech text-[10px] text-muted-foreground hover:border-[#e2453b]/60 hover:text-[#e2453b]"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </header>

      {/* ---------- title strip ---------- */}
      <div className="border-b border-border/40 bg-card/40 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold tracking-wide lg:text-2xl">
              Funkstandort {site.siteId} · <span className="text-primary text-glow">Maststeuerung</span>
            </h1>
            <div className="font-tech text-[11px] text-muted-foreground">
              {site.mastId} · {site.region} · {site.heightM} m · BNetzA {site.bnetzaId} · {site.backhaulType}
            </div>
          </div>
          <div className="flex items-center gap-2 font-tech text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Wind className="h-3.5 w-3.5" /> {site.weather.windKph} km/h
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Thermometer className="h-3.5 w-3.5" /> {metrics.temperature}°C
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BatteryCharging className="h-3.5 w-3.5" /> {metrics.battery}%
            </span>
          </div>
        </div>
      </div>

      {/* ---------- main grid ---------- */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:p-4 xl:flex-row">
        {/* LEFT: telemetry */}
        <aside className={`order-2 shrink-0 transition-all xl:order-1 ${leftOpen ? "xl:w-[320px] 2xl:w-[360px]" : "xl:w-[44px]"}`}>
          <div className="panel-frame flex h-full flex-col rounded-lg">
            <button
              onClick={() => setLeftOpen(o => !o)}
              className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5 font-tech text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {leftOpen ? (
                <>
                  <span>System-Übersicht</span>
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </>
              ) : (
                <ChevronRight className="mx-auto h-3.5 w-3.5" />
              )}
            </button>
            {leftOpen && (
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {/* status */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="metric-tile rounded-md p-3">
                    <div className="font-tech text-[9px] uppercase tracking-wider text-muted-foreground">Richtfunklink</div>
                    <div className="font-display text-lg font-bold" style={{ color: metrics.lock > 80 ? "#31d47c" : metrics.lock > 40 ? "#e8b13f" : "#e2453b" }}>
                      {metrics.lock > 80 ? "Stabil" : metrics.lock > 40 ? "Nachführung" : metrics.lock > 0 ? "Instabil" : "Offline"}
                    </div>
                    <div className="font-tech text-[9px] text-muted-foreground">Az {Math.round(metrics.azimuth)}° · El {site.telemetry.elevation}°</div>
                  </div>
                  <div className="metric-tile rounded-md p-3">
                    <div className="font-tech text-[9px] uppercase tracking-wider text-muted-foreground">Satelliten-Relay</div>
                    <div className="font-display text-lg font-bold text-foreground">{systemState === "offline" ? "Getrennt" : site.telemetry.satelliteStatus.split(" ")[0]}</div>
                    <div className="font-tech text-[9px] text-muted-foreground">Sync alle 12 min</div>
                  </div>
                  <div className="metric-tile rounded-md p-3">
                    <div className="font-tech text-[9px] uppercase tracking-wider text-muted-foreground">Durchsatz</div>
                    <div className="font-display text-lg font-bold text-foreground tabular-nums">
                      {metrics.uplink}/{metrics.downlink}
                    </div>
                    <div className="font-tech text-[9px] text-muted-foreground">Mbps Up / Down</div>
                  </div>
                  <div className="metric-tile rounded-md p-3">
                    <div className="font-tech text-[9px] uppercase tracking-wider text-muted-foreground">Strom & Klima</div>
                    <div className="font-display text-lg font-bold text-foreground tabular-nums">{metrics.battery}%</div>
                    <div className="font-tech text-[9px] text-muted-foreground">{metrics.temperature}°C Schaltschrank</div>
                  </div>
                </div>

                {/* signal quality graph */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-tech text-[10px] uppercase tracking-widest text-muted-foreground">Signalqualität (Live)</span>
                    <span className="font-display text-sm font-bold tabular-nums" style={{ color: metrics.signal > 70 ? "#31d47c" : metrics.signal > 35 ? "#e8b13f" : "#e2453b" }}>
                      {metrics.signal}%
                    </span>
                  </div>
                  <div className="h-[120px] rounded-md border border-border/50 bg-background/60 p-1.5">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -32 }}>
                        <defs>
                          <linearGradient id="sig-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e20074" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#e20074" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="t" hide />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#5c6c8a" }} axisLine={false} tickLine={false} />
                        <ReTooltip
                          contentStyle={{ background: "#0c1322", border: "1px solid #26324e", borderRadius: 6, fontSize: 11, fontFamily: "Share Tech Mono, monospace" }}
                          labelStyle={{ color: "#8fa3c8" }}
                        />
                        <Area type="monotone" dataKey="signal" name="Signal %" stroke="#e20074" strokeWidth={1.6} fill="url(#sig-fill)" isAnimationActive={false} />
                        <Area type="monotone" dataKey="lock" name="Lock %" stroke="#3fd0e8" strokeWidth={1} fill="transparent" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* session info */}
                <div className="rounded-md border border-border/50 bg-background/50 p-3 font-tech text-[11px]">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <ScrollText className="h-3 w-3" /> Session
                  </div>
                  <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex justify-between"><span>Operator</span><span className="text-foreground/90">{session.user.displayName}</span></div>
                    <div className="flex justify-between"><span>Token-SN</span><span className="text-foreground/90">{session.cert?.serial ?? "–"}</span></div>
                    <div className="flex justify-between"><span>Sessiondauer</span><span className="tabular-nums text-foreground/90">{fmtDuration(clock.getTime() - sessionStart)}</span></div>
                    <div className="flex justify-between"><span>Ereignisse</span><span className="tabular-nums text-foreground/90">{logs.length}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: mast scene */}
        <section className="order-1 min-w-0 flex-1 xl:order-2">
          <div className="panel-frame corner-brackets flex h-full flex-col overflow-hidden rounded-lg">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
              <span className="font-tech text-[11px] uppercase tracking-widest text-muted-foreground">
                Antennensystem {site.mastId}
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 font-tech text-[10px]"
                style={{ color: stateBadge.color, borderColor: `${stateBadge.color}55`, background: `${stateBadge.color}12` }}
              >
                <span className="status-dot" style={{ background: stateBadge.color, boxShadow: `0 0 8px ${stateBadge.color}` }} />
                {stateBadge.txt}
              </span>
            </div>

            <div className="relative min-h-[320px] flex-1 bg-[#05070f]">
              <MastScene ref={sceneRef} className="absolute inset-0" flavor={site.state === "fault" ? "err" : site.state === "maintenance" ? "warn" : "ok"} />
              {/* operation overlay */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#05070f] via-[#05070fcc] to-transparent px-4 pb-3 pt-8">
                <div className="mb-1 flex items-center justify-between font-tech text-[10px] text-muted-foreground">
                  <span className="truncate">
                    {busyAction ? `VORGANG · ${opVariant}` : "VORGANG"}
                  </span>
                  {busyAction && <span className="tabular-nums">{opProgress}%</span>}
                </div>
                <div className="truncate font-tech text-xs text-foreground/90">{opLabel}</div>
                {busyAction && <Progress value={opProgress} className="progress-shimmer mt-1.5 h-1.5" />}
              </div>
            </div>

            {/* metric strip */}
            <div className="grid grid-cols-5 divide-x divide-border/40 border-t border-border/50 bg-background/50">
              {[
                ["Signal", systemState === "offline" ? "–" : `${metrics.signal}%`],
                ["Latenz", systemState === "offline" ? "–" : `${metrics.latency} ms`],
                ["Lock", systemState === "offline" ? "–" : `${metrics.lock}%`],
                ["Azimut", systemState === "offline" ? "–" : `${Math.round(metrics.azimuth)}°`],
                ["Band", metrics.band],
              ].map(([k, v]) => (
                <div key={k} className="px-3 py-2.5 text-center">
                  <div className="font-tech text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
                  <div className="font-display text-sm font-bold tabular-nums text-foreground">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT: actions */}
        <aside className={`order-3 shrink-0 transition-all ${rightOpen ? "xl:w-[300px] 2xl:w-[340px]" : "xl:w-[44px]"}`}>
          <div className="panel-frame flex h-full flex-col rounded-lg">
            <button
              onClick={() => setRightOpen(o => !o)}
              className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5 font-tech text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {rightOpen ? (
                <>
                  <span>Fernsteuerung</span>
                  <PanelRightClose className="h-3.5 w-3.5" />
                </>
              ) : (
                <ChevronLeft className="mx-auto h-3.5 w-3.5" />
              )}
            </button>
            {rightOpen && (
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <p className="text-[11px] text-muted-foreground">
                  Autorisierte Remote-Aktionen. Jede Ausführung nutzt ein zufällig gewähltes Verfahren.
                </p>
                {groups.map(group => (
                  <div key={group}>
                    <div className="mb-2 font-tech text-[10px] uppercase tracking-widest text-primary/80">{group}</div>
                    <div className="space-y-2">
                      {ACTIONS.filter(a => a.group === group).map(a => {
                        const Icon = a.icon;
                        const isBusy = busyAction === a.id;
                        const isMaintToggle = a.id === "maintenance" && maintenanceActive;
                        return (
                          <button
                            key={a.id}
                            onClick={() => runOperation(a)}
                            disabled={busyAction !== null}
                            className={`group flex w-full items-center gap-3 rounded-md border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                              a.danger
                                ? "border-[#e2453b]/40 bg-[#e2453b]/5 hover:border-[#e2453b]/70 hover:bg-[#e2453b]/10"
                                : isMaintToggle
                                  ? "border-[#e8b13f]/50 bg-[#e8b13f]/10 hover:border-[#e8b13f]/70"
                                  : "border-border/70 bg-background/50 hover:border-primary/50 hover:bg-primary/5"
                            } ${isBusy ? "ring-1 ring-primary/60" : ""}`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                                a.danger ? "border-[#e2453b]/50 bg-[#e2453b]/10 text-[#e2453b]" : "border-primary/40 bg-primary/10 text-primary"
                              }`}
                            >
                              {isBusy ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-tech text-xs font-semibold text-foreground">
                                {isMaintToggle ? "Wartungsmodus beenden" : a.title}
                              </span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {a.id === "band" ? `Aktiv: ${metrics.band}` : a.subtitle}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* ---------- session log ---------- */}
      <section className="border-t border-border/50 bg-card/40 px-3 pb-4 pt-3 lg:px-4">
        <div className="panel-frame rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-bold tracking-wide">Session-Protokoll</span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-tech text-[10px] text-muted-foreground">{filteredLogs.length} Einträge</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "action", "telemetry", "security", "maintenance", "error", "session"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f as LogTone | "all")}
                  className={`rounded-full border px-2.5 py-1 font-tech text-[10px] transition ${
                    logFilter === f
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Alle" : TONE_META[f as LogTone].label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" />
              <button
                onClick={() => exportLog("txt")}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 font-tech text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                <Download className="h-3 w-3" /> TXT
              </button>
              <button
                onClick={() => exportLog("json")}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 font-tech text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                <Download className="h-3 w-3" /> JSON
              </button>
            </div>
          </div>
          <div className="max-h-[260px] overflow-y-auto px-4 py-2">
            {filteredLogs.length === 0 ? (
              <div className="py-6 text-center font-tech text-xs text-muted-foreground">Keine Einträge für diesen Filter.</div>
            ) : (
              <ul className="divide-y divide-border/30">
                {filteredLogs.map(l => (
                  <li key={l.id} className="flex items-start gap-3 py-2">
                    <span className="mt-0.5 shrink-0 font-tech text-[10px] tabular-nums text-muted-foreground">
                      {l.time.toLocaleTimeString("de-DE")}
                    </span>
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-tech text-[9px] font-bold uppercase tracking-wider ${TONE_META[l.tone].cls}`}>
                      {TONE_META[l.tone].label}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-tech text-xs text-foreground">{l.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{l.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
