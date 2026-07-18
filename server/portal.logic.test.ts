import { describe, expect, it } from "vitest";
import {
  checkLogin,
  parseCertificate,
  validateCertificate,
  validateDirectory,
  type AdDirectory,
} from "../shared/masts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const tokenDir = join(__dirname, "..", "token-demo");
const adDemoRaw = readFileSync(join(tokenDir, "ad-demo.json"), "utf-8");
const certRaw = readFileSync(join(tokenDir, "service.cert"), "utf-8");
const directory = JSON.parse(adDemoRaw) as AdDirectory;
const cert = parseCertificate(certRaw);

describe("parseCertificate + validateCertificate", () => {
  it("parses the demo service.cert and extracts metadata", () => {
    expect(cert.serial).toBe("34F7A1B2C3D4E5F6");
    expect(cert.commonName).toContain("Servicetechniker");
    expect(cert.issuer).toContain("Telekom");
    expect(cert.hasPemBlock).toBe(true);
    expect(cert.fingerprintSha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i);
  });

  it("accepts the demo certificate as currently valid", () => {
    const res = validateCertificate(cert);
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("rejects a file without PEM markers", () => {
    const res = validateCertificate(parseCertificate("this is not a certificate"));
    expect(res.ok).toBe(false);
  });

  it("rejects an expired certificate", () => {
    const res = validateCertificate(cert, new Date("2030-01-01T00:00:00Z"));
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toContain("abgelaufen");
  });

  it("rejects a not-yet-valid certificate", () => {
    const res = validateCertificate(cert, new Date("2020-01-01T00:00:00Z"));
    expect(res.ok).toBe(false);
  });
});

describe("validateDirectory", () => {
  it("accepts the demo ad-demo.json", () => {
    const res = validateDirectory(directory);
    expect(res.ok).toBe(true);
    expect(directory.users.length).toBeGreaterThanOrEqual(1);
    expect(directory.users[0]!.username).toBe("MZimmermann");
    expect(directory.sites.length).toBe(5);
  });

  it("rejects an object without users", () => {
    const res = validateDirectory({ sites: [] });
    expect(res.ok).toBe(false);
  });

  it("rejects incomplete user entries", () => {
    const res = validateDirectory({
      users: [{ username: "x" }],
      sites: directory.sites,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects null input", () => {
    const res = validateDirectory(null);
    expect(res.ok).toBe(false);
  });
});

describe("checkLogin", () => {
  it("accepts valid credentials with matching token serial", () => {
    const res = checkLogin(
      { username: "MZimmermann", password: "T3l3k0m!", employeeNumber: "MZ204" },
      directory,
      cert,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.user.displayName).toBe("Marlene Zimmermann");
  });

  it("is case-insensitive for the username and trims whitespace", () => {
    const res = checkLogin(
      { username: "  mzimmermann ", password: "T3l3k0m!", employeeNumber: " MZ204 " },
      directory,
      cert,
    );
    expect(res.ok).toBe(true);
  });

  it("rejects a wrong password with a generic reason", () => {
    const res = checkLogin(
      { username: "MZimmermann", password: "wrong", employeeNumber: "MZ204" },
      directory,
      cert,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("Benutzer oder Passwort ungültig.");
    expect(res.incident).toContain("Falsches Passwort");
  });

  it("rejects an unknown user", () => {
    const res = checkLogin(
      { username: "Nobody", password: "x", employeeNumber: "XX1" },
      directory,
      cert,
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a wrong employee number", () => {
    const res = checkLogin(
      { username: "MZimmermann", password: "T3l3k0m!", employeeNumber: "ZZ999" },
      directory,
      cert,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain("Mitarbeiter-ID");
  });

  it("rejects a token that is not bound to the user", () => {
    const foreignCert = parseCertificate(
      certRaw.replace(/Serial=.+/, "Serial=FFFFFFFFFFFFFFFF"),
    );
    const res = checkLogin(
      { username: "MZimmermann", password: "T3l3k0m!", employeeNumber: "MZ204" },
      directory,
      foreignCert,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain("Token");
  });
});

describe("demo data consistency", () => {
  it("user site access references existing sites", () => {
    const siteIds = directory.sites.map(s => s.siteId);
    for (const user of directory.users) {
      for (const access of user.siteAccess) {
        expect(siteIds).toContain(access);
      }
    }
  });

  it("expected token serial matches the demo certificate", () => {
    expect(directory.users[0]!.expectedTokenSerial).toBe(cert.serial);
  });

  it("every mast site has coordinates within Germany", () => {
    for (const site of directory.sites) {
      expect(site.coordinates.lat).toBeGreaterThan(47);
      expect(site.coordinates.lat).toBeLessThan(56);
      expect(site.coordinates.lng).toBeGreaterThan(5);
      expect(site.coordinates.lng).toBeLessThan(16);
    }
  });

  it("telemetry values stay within plausible ranges", () => {
    for (const site of directory.sites) {
      expect(site.telemetry.signalQuality).toBeGreaterThanOrEqual(0);
      expect(site.telemetry.signalQuality).toBeLessThanOrEqual(100);
      expect(site.telemetry.azimuth).toBeGreaterThanOrEqual(0);
      expect(site.telemetry.azimuth).toBeLessThan(360);
    }
  });
});
