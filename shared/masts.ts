/**
 * Shared domain model for the Telekom radio mast control portal.
 * These types mirror the structure of the demo directory file `ad-demo.json`.
 */

export type MastOperationalState = "active" | "maintenance" | "fault" | "restarting";

export type ScenarioName = "normal" | "high-load" | "maintenance" | "degraded" | "restart-pending";

export interface MastTelemetry {
  signalQuality: number;
  azimuth: number;
  elevation: number;
  uplink: number;
  downlink: number;
  latency: number;
  lock: number;
  syncLag: number;
  packetLoss: number;
  temperature: number;
  battery: number;
  band: "Ku-Band" | "Ka-Band";
  satelliteStatus: string;
  linkStatus: string;
}

export interface MastSite {
  siteId: string;
  mastId: string;
  name: string;
  region: string;
  cluster: string;
  coordinates: { lat: number; lng: number; altitudeM: number };
  heightM: number;
  bnetzaId: string;
  backhaulType: string;
  state: MastOperationalState;
  scenario: ScenarioName;
  telemetry: MastTelemetry;
  weather: {
    condition: string;
    windKph: number;
    humidityPct: number;
    temperatureC: number;
  };
}

export interface DirectoryUser {
  username: string;
  password: string;
  employeeNumber: string;
  displayName: string;
  role: string;
  expectedTokenSerial: string;
  siteAccess: string[];
}

export interface AdDirectory {
  meta: {
    dataset: string;
    version: string;
    generatedAt: string;
    schemaVersion: string;
  };
  users: DirectoryUser[];
  sites: MastSite[];
}

export interface ParsedCertificate {
  raw: string;
  serial: string | null;
  commonName: string | null;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  fingerprintSha256: string | null;
  keyAlgorithm: string | null;
  policies: string | null;
  ocspUrl: string | null;
  crlUrl: string | null;
  demoProfile: string | null;
  hasPemBlock: boolean;
}

export type LogTone =
  | "action"
  | "telemetry"
  | "session"
  | "security"
  | "error"
  | "maintenance"
  | "hint"
  | "info";

export interface LogEntry {
  id: number;
  time: Date;
  tone: LogTone;
  title: string;
  detail: string;
}

/** Parse the metadata block of a service.cert file (PEM + key/value metadata). */
export function parseCertificate(text: string): ParsedCertificate {
  const normalized = text.replace(/\r/g, "");
  const metadata: Record<string, string> = {};
  normalized.split("\n").forEach(line => {
    const idx = line.indexOf("=");
    if (idx <= 0) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value && !key.startsWith("-----")) metadata[key] = value;
  });
  const subject = metadata.Subject || "";
  const cnFromSubject = subject.match(/CN=([^,]+)/i);
  return {
    raw: normalized,
    serial: metadata.Serial || null,
    commonName: metadata.CN || (cnFromSubject ? cnFromSubject[1].trim() : null),
    issuer: metadata.Issuer || null,
    subject: metadata.Subject || null,
    validFrom: metadata["Valid-From"] || null,
    validTo: metadata["Valid-To"] || null,
    fingerprintSha256: metadata["Fingerprint-SHA256"] || null,
    keyAlgorithm: metadata["Key-Algorithm"] || null,
    policies: metadata.Policies || null,
    ocspUrl: metadata.OCSP || null,
    crlUrl: metadata.CRL || null,
    demoProfile: metadata["Demo-Profile"] || null,
    hasPemBlock:
      normalized.includes("-----BEGIN CERTIFICATE-----") &&
      normalized.includes("-----END CERTIFICATE-----"),
  };
}

export interface CertValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Validate the parsed certificate for the demo PKI flow. */
export function validateCertificate(cert: ParsedCertificate, now = new Date()): CertValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!cert.hasPemBlock) errors.push("Kein gültiger PEM-Block gefunden (BEGIN/END CERTIFICATE fehlt).");
  if (!cert.serial) errors.push("Seriennummer fehlt im Zertifikat.");
  if (!cert.commonName) errors.push("Common Name (CN) fehlt im Zertifikat.");
  if (!cert.fingerprintSha256) warnings.push("Kein SHA-256-Fingerprint hinterlegt.");
  if (cert.validFrom && cert.validTo) {
    const from = new Date(cert.validFrom);
    const to = new Date(cert.validTo);
    if (Number.isFinite(from.getTime()) && from.getTime() > now.getTime()) {
      errors.push(`Zertifikat ist erst ab ${cert.validFrom} gültig.`);
    }
    if (Number.isFinite(to.getTime()) && to.getTime() < now.getTime()) {
      errors.push(`Zertifikat ist am ${cert.validTo} abgelaufen.`);
    }
  } else {
    warnings.push("Gültigkeitszeitraum unvollständig.");
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Validate the structure of a parsed ad-demo.json directory. */
export function validateDirectory(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const d = data as Partial<AdDirectory> | null;
  if (!d || typeof d !== "object") {
    return { ok: false, errors: ["ad-demo.json ist kein gültiges JSON-Objekt."] };
  }
  if (!Array.isArray(d.users) || d.users.length === 0) {
    errors.push("ad-demo.json enthält keine Benutzerdefinitionen.");
  } else {
    d.users.forEach((u, i) => {
      if (!u.username || !u.password || !u.employeeNumber || !u.expectedTokenSerial) {
        errors.push(`Benutzer #${i + 1} ist unvollständig (username/password/employeeNumber/expectedTokenSerial).`);
      }
    });
  }
  if (!Array.isArray(d.sites) || d.sites.length === 0) {
    errors.push("ad-demo.json enthält keine Funkstandorte (sites).");
  }
  return { ok: errors.length === 0, errors };
}

export interface LoginAttempt {
  username: string;
  password: string;
  employeeNumber: string;
}

export type LoginResult =
  | { ok: true; user: DirectoryUser }
  | { ok: false; reason: string; incident: string };

/** Check a login attempt against directory + certificate binding. */
export function checkLogin(
  attempt: LoginAttempt,
  directory: AdDirectory,
  cert: ParsedCertificate,
): LoginResult {
  const user = directory.users.find(
    u => u.username.toLowerCase() === attempt.username.trim().toLowerCase(),
  );
  if (!user) {
    return {
      ok: false,
      reason: "Benutzer oder Passwort ungültig.",
      incident: `Anmeldeversuch mit unbekanntem Benutzer: ${attempt.username}`,
    };
  }
  if (user.employeeNumber !== attempt.employeeNumber.trim()) {
    return {
      ok: false,
      reason: "Mitarbeiter-ID ungültig.",
      incident: `Falsche Mitarbeiter-ID für ${user.username}`,
    };
  }
  if (user.password !== attempt.password) {
    return {
      ok: false,
      reason: "Benutzer oder Passwort ungültig.",
      incident: `Falsches Passwort für ${user.username}`,
    };
  }
  if (!cert.serial || user.expectedTokenSerial !== cert.serial) {
    return {
      ok: false,
      reason: "USB-Token nicht für diesen Benutzer autorisiert.",
      incident: `Token-Bindung verletzt für ${user.username}: erwartet ${user.expectedTokenSerial}, erhalten ${cert.serial ?? "–"}`,
    };
  }
  return { ok: true, user };
}
