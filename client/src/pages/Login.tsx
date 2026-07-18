import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MastScene, type MastSceneHandle } from "@/components/mast/MastScene";
import { usePortalSession } from "@/contexts/PortalSession";
import { useTokenScanner, type ScanStep } from "@/hooks/useTokenScanner";
import { checkLogin } from "@shared/masts";
import { Progress } from "@/components/ui/progress";
import {
  Usb,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Fingerprint,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  CircleDashed,
  LockKeyhole,
  FolderOpen,
} from "lucide-react";

function StepIcon({ status }: { status: ScanStep["status"] }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-[#31d47c]" />;
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-[#e8b13f]" />;
    case "fail":
      return <XCircle className="h-4 w-4 text-[#e2453b]" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    default:
      return <CircleDashed className="h-4 w-4 text-muted-foreground/50" />;
  }
}

export default function Login() {
  const [, navigate] = useLocation();
  const session = usePortalSession();
  const { state: scan, scanFiles, scanViaPicker, reset } = useTokenScanner();
  const sceneRef = useRef<MastSceneHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [overrideSession, setOverrideSession] = useState(false);
  const [incident, setIncident] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Mast background reacts to scan phase
  useEffect(() => {
    if (scan.phase === "scanning") sceneRef.current?.setState("diag-scan");
    else if (scan.phase === "success") sceneRef.current?.setState("success-burst");
    else if (scan.phase === "error") sceneRef.current?.setState("error-interference");
  }, [scan.phase]);

  const tokenReady = scan.phase === "success" && scan.cert && scan.directory;
  const fieldsComplete = username.trim() !== "" && password.trim() !== "" && employeeNumber.trim() !== "";
  const canLogin = Boolean(tokenReady && fieldsComplete);

  const handleScanClick = async () => {
    setIncident(null);
    const result = await scanViaPicker();
    if (result === "unsupported") {
      fileInputRef.current?.click();
    } else if (result === "denied") {
      setIncident("Zugriff auf den Token-Ordner wurde verweigert. Bitte erneut versuchen.");
    }
  };

  const handleFallbackFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void scanFiles(files);
    e.target.value = "";
  };

  const handleLogin = () => {
    if (!fieldsComplete) {
      setIncident("Benutzerangaben unvollständig. Alle Felder sind erforderlich.");
      return;
    }
    if (!tokenReady || !scan.cert || !scan.directory) {
      setIncident(
        "Kein gültiger USB-Token-Scan vorhanden. Der Versuch wurde als Sicherheitsvorfall protokolliert.",
      );
      session.reportIncident(`Anmeldeversuch ohne gültigen PKI-Token (Benutzer: ${username || "–"})`);
      return;
    }
    const result = checkLogin({ username, password, employeeNumber }, scan.directory, scan.cert);
    if (!result.ok) {
      setIncident(result.reason);
      session.reportIncident(result.incident);
      return;
    }
    session.setToken(scan.cert, scan.directory);
    session.login(result.user, overrideSession);
    navigate("/karte");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Animated mast background */}
      <div className="absolute inset-0 opacity-[0.55]">
        <MastScene ref={sceneRef} className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background/90" />
      <div className="absolute inset-0 grid-overlay pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/60 bg-background/60 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Telekom" className="h-9 w-9 rounded-sm" />
          <div>
            <div className="font-display text-sm font-bold tracking-wider">
              SERVICEPORTAL · FUNKINFRASTRUKTUR
            </div>
            <div className="font-tech text-[11px] text-muted-foreground">
              Deutsche Telekom Technik GmbH · Zutritt nur für autorisiertes Personal
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2 rounded-full border border-[#31d47c]/30 bg-[#31d47c]/10 px-3 py-1 font-tech text-[11px] text-[#31d47c] sm:flex">
            <span className="status-dot status-dot--ok" /> SYSTEM AKTIV
          </span>
          <span className="font-tech text-sm text-foreground/80 tabular-nums">
            {clock.toLocaleTimeString("de-DE")}
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 lg:py-14">
        <div className="anim-rise">
          <div className="kicker mb-2">PKI-gesicherter Fernzugriff</div>
          <h1 className="font-display text-3xl font-bold tracking-wide text-foreground lg:text-4xl">
            Funkstandort-Zugang <span className="text-primary text-glow">für Servicetechniker</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Anmeldung für autorisierte Mitarbeiter zur Verwaltung von Mobilfunk- und
            Richtfunkstandorten. Der Dienst-USB-Token (PKI) muss eingesteckt sein.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          {/* LEFT: scan + login */}
          <section className="panel-frame corner-brackets rounded-lg p-6">
            <div className="mb-1 flex items-center gap-2">
              <Usb className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold tracking-wide">Anmeldung mit PKI-Token</h2>
            </div>
            <p className="mb-5 text-xs text-muted-foreground">
              Schritt 1: USB-Token scannen · Schritt 2: Benutzerdaten bestätigen
            </p>

            {/* Token status strip */}
            <div
              className={`mb-4 flex items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                scan.phase === "success"
                  ? "border-[#31d47c]/40 bg-[#31d47c]/10"
                  : scan.phase === "error"
                    ? "border-[#e2453b]/40 bg-[#e2453b]/10"
                    : scan.phase === "scanning"
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-muted/40"
              }`}
              role="status"
              aria-live="polite"
            >
              {scan.phase === "success" ? (
                <ShieldCheck className="h-6 w-6 shrink-0 text-[#31d47c]" />
              ) : scan.phase === "error" ? (
                <ShieldAlert className="h-6 w-6 shrink-0 text-[#e2453b]" />
              ) : scan.phase === "scanning" ? (
                <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
              ) : (
                <Usb className="h-6 w-6 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-tech text-sm font-semibold">
                  {scan.phase === "success"
                    ? "TOKEN VERIFIZIERT – BEREIT ZUR ANMELDUNG"
                    : scan.phase === "error"
                      ? "TOKEN-VALIDIERUNG FEHLGESCHLAGEN"
                      : scan.phase === "scanning"
                        ? "SICHERHEITSPRÜFUNG LÄUFT…"
                        : "KEIN TOKEN ERKANNT"}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {scan.phase === "error" && scan.errorMessage
                    ? scan.errorMessage
                    : scan.phase === "success" && scan.cert
                      ? `${scan.cert.commonName} · SN ${scan.cert.serial}`
                      : "PKI-USB-Stick einstecken und Token-Ordner auswählen (ad-demo.json + service.cert)."}
                </div>
              </div>
            </div>

            {/* Scan progress */}
            {scan.phase !== "idle" && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between font-tech text-[11px] text-muted-foreground">
                  <span>SCAN-FORTSCHRITT</span>
                  <span className="tabular-nums">{scan.progress}%</span>
                </div>
                <Progress
                  value={scan.progress}
                  className={`h-2 ${scan.phase === "scanning" ? "progress-shimmer" : ""}`}
                />
              </div>
            )}

            {/* Validation steps */}
            {scan.phase !== "idle" && (
              <ol className="mb-4 space-y-1.5 rounded-md border border-border/70 bg-background/50 p-3">
                {scan.steps.map(step => (
                  <li key={step.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5">
                      <StepIcon status={step.status} />
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`font-tech text-xs ${
                          step.status === "pending" ? "text-muted-foreground/60" : "text-foreground"
                        }`}
                      >
                        {step.label}
                      </div>
                      {step.detail && (
                        <div
                          className={`text-[11px] ${
                            step.status === "fail"
                              ? "text-[#e2453b]"
                              : step.status === "warn"
                                ? "text-[#e8b13f]"
                                : "text-muted-foreground"
                          }`}
                        >
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleScanClick}
                disabled={scan.phase === "scanning"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 font-tech text-sm font-bold text-primary-foreground shadow-[0_0_16px_rgba(226,0,116,0.35)] hover:bg-primary/90 disabled:opacity-50"
              >
                <Fingerprint className="h-4 w-4" />
                {scan.phase === "success" ? "TOKEN ERNEUT SCANNEN" : "USB-TOKEN SCANNEN"}
              </button>
              <label
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-transparent px-3 py-2.5 font-tech text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground ${scan.phase === "scanning" ? "pointer-events-none opacity-50" : ""}`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Manuell auswählen
                <input
                  id="token-file-input"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  // @ts-expect-error non-standard directory attributes
                  webkitdirectory=""
                  directory=""
                  className="sr-only"
                  onChange={handleFallbackFiles}
                  tabIndex={-1}
                />
              </label>
              {scan.phase === "error" && (
                <button
                  onClick={reset}
                  className="font-tech text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Zurücksetzen
                </button>
              )}
            </div>

            <div className="mb-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Step 2: credentials */}
            <div className="mb-1 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold tracking-wide">Benutzeranmeldung</h3>
            </div>
            <p className="mb-4 text-[11px] text-muted-foreground">
              Zugangsdaten werden gegen den Verzeichnisdienst auf dem Token geprüft.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-tech text-[11px] uppercase tracking-wider text-muted-foreground">
                  Benutzername
                </span>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="z. B. MZimmermann"
                  className="w-full rounded-md border border-input bg-background/70 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(226,0,116,0.15)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-tech text-[11px] uppercase tracking-wider text-muted-foreground">
                  Passwort
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-md border border-input bg-background/70 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(226,0,116,0.15)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-tech text-[11px] uppercase tracking-wider text-muted-foreground">
                  Dienstnummer / Mitarbeiter-ID
                </span>
                <input
                  value={employeeNumber}
                  onChange={e => setEmployeeNumber(e.target.value)}
                  placeholder="z. B. MZ204"
                  className="w-full rounded-md border border-input bg-background/70 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(226,0,116,0.15)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-tech text-[11px] uppercase tracking-wider text-muted-foreground">
                  Token-Bezeichner
                </span>
                <input
                  readOnly
                  value={scan.cert ? `${scan.cert.serial} · ${scan.cert.commonName}` : "Kein Token ausgelesen"}
                  className="w-full rounded-md border border-input bg-muted/50 px-3 py-2.5 font-tech text-xs text-muted-foreground outline-none"
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={overrideSession}
                onChange={e => setOverrideSession(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#e20074]"
              />
              Token-Session übernehmen (bestehende Anmeldung überschreiben)
            </label>

            {incident && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-[#e2453b]/40 bg-[#e2453b]/10 px-4 py-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e2453b]" />
                <div>
                  <div className="font-tech text-xs font-bold text-[#e2453b]">
                    UNZULÄSSIGER ZUGRIFFSVERSUCH
                  </div>
                  <div className="text-[11px] text-foreground/80">{incident}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Vorfall wurde protokolliert und an die Telekom-Sicherheitszentrale gemeldet.
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={!canLogin}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-display text-sm font-bold tracking-widest text-primary-foreground shadow-[0_0_22px_rgba(226,0,116,0.4)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:w-auto"
            >
              <LockKeyhole className="h-4 w-4" />
              ANMELDEN
            </button>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Hinweis: Die Anmeldung ist nur für autorisierte Servicetechniker zulässig. Alle
              Zugriffe werden protokolliert.
            </p>
          </section>

          {/* RIGHT: token detail card */}
          <section className="panel-frame rounded-lg p-6">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold tracking-wide">Token-Status</h2>
            </div>
            <p className="mb-5 text-xs text-muted-foreground">
              Übersicht über den aktuell verbundenen Dienst-USB-Token.
            </p>

            <div
              className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-tech text-[11px] ${
                scan.phase === "success"
                  ? "border-[#31d47c]/40 bg-[#31d47c]/10 text-[#31d47c]"
                  : "border-[#e8b13f]/40 bg-[#e8b13f]/10 text-[#e8b13f]"
              }`}
            >
              <span
                className={`status-dot ${scan.phase === "success" ? "status-dot--ok" : "status-dot--warn"}`}
              />
              {scan.phase === "success" ? "DIENST-TOKEN VERBUNDEN" : "KEIN TOKEN VERBUNDEN"}
            </div>

            <dl className="space-y-2.5 font-tech text-xs">
              {[
                ["Seriennummer", scan.cert?.serial],
                ["Inhaber", scan.cert?.commonName],
                ["Aussteller", scan.cert?.issuer?.split(",")[0]?.replace("CN=", "")],
                ["Gültig von", scan.cert?.validFrom],
                ["Gültig bis", scan.cert?.validTo],
                ["Schlüssel", scan.cert?.keyAlgorithm],
                ["Profil", scan.cert?.demoProfile],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2">
                  <dt className="shrink-0 uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right text-foreground/90">{value || "–"}</dd>
                </div>
              ))}
              <div className="pt-1">
                <dt className="mb-1 uppercase tracking-wider text-muted-foreground">Fingerprint (SHA-256)</dt>
                <dd className="break-all rounded bg-muted/50 p-2 text-[10px] leading-relaxed text-foreground/70">
                  {scan.cert?.fingerprintSha256 || "–"}
                </dd>
              </div>
            </dl>

            <p className="mt-5 text-[10px] leading-relaxed text-muted-foreground">
              Bei Problemen mit dem Dienst-Token wenden Sie sich an den internen Support
              (Hotline 4911). Der Token muss die Dateien{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[9px]">ad-demo.json</code> und{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[9px]">service.cert</code> enthalten.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
