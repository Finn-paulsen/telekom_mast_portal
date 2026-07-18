import { useCallback, useRef, useState } from "react";
import {
  parseCertificate,
  validateCertificate,
  validateDirectory,
  type AdDirectory,
  type ParsedCertificate,
} from "@shared/masts";

export type ScanPhase = "idle" | "scanning" | "success" | "error";

export interface ScanStep {
  id: string;
  label: string;
  status: "pending" | "running" | "ok" | "warn" | "fail";
  detail?: string;
}

export interface ScanState {
  phase: ScanPhase;
  progress: number;
  steps: ScanStep[];
  errorMessage: string | null;
  cert: ParsedCertificate | null;
  directory: AdDirectory | null;
  scannedAt: number | null;
}

const INITIAL_STEPS: ScanStep[] = [
  { id: "mount", label: "Token-Dateisystem einbinden", status: "pending" },
  { id: "discover", label: "Dateien indizieren (ad-demo.json, service.cert)", status: "pending" },
  { id: "cert", label: "Zertifikat service.cert einlesen & prüfen", status: "pending" },
  { id: "dir", label: "Verzeichnisdaten ad-demo.json validieren", status: "pending" },
  { id: "chain", label: "Zertifikatskette & Sperrliste (OCSP/CRL)", status: "pending" },
  { id: "release", label: "Anmeldung freigeben", status: "pending" },
];

const initialState: ScanState = {
  phase: "idle",
  progress: 0,
  steps: INITIAL_STEPS,
  errorMessage: null,
  cert: null,
  directory: null,
  scannedAt: null,
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Datei ${file.name} konnte nicht gelesen werden.`));
    reader.readAsText(file);
  });
}

/**
 * Recursively walk a directory handle (max depth 3) to locate the token files.
 * This makes detection robust: the user can select the USB drive root even if
 * the files live in a subfolder.
 */
async function collectFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  depth = 0,
): Promise<File[]> {
  const files: File[] = [];
  if (depth > 3) return files;
  for await (const entry of dirHandle.values() as AsyncIterable<FileSystemHandle>) {
    if (entry.kind === "file") {
      files.push(await (entry as FileSystemFileHandle).getFile());
    } else if (entry.kind === "directory" && depth < 3) {
      const sub = await collectFilesFromHandle(entry as FileSystemDirectoryHandle, depth + 1);
      files.push(...sub);
    }
  }
  return files;
}

export function useTokenScanner() {
  const [state, setState] = useState<ScanState>(initialState);
  const runningRef = useRef(false);

  const patchStep = useCallback((id: string, patch: Partial<ScanStep>) => {
    setState(s => ({
      ...s,
      steps: s.steps.map(st => (st.id === id ? { ...st, ...patch } : st)),
    }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(s => ({ ...s, progress }));
  }, []);

  const fail = useCallback(
    (stepId: string, message: string) => {
      patchStep(stepId, { status: "fail", detail: message });
      setState(s => ({ ...s, phase: "error", errorMessage: message }));
      runningRef.current = false;
    },
    [patchStep],
  );

  const reset = useCallback(() => {
    runningRef.current = false;
    setState(initialState);
  }, []);

  /** Core scan pipeline over a set of files (from FS Access API or input fallback). */
  const scanFiles = useCallback(
    async (files: File[]) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setState({ ...initialState, phase: "scanning", steps: INITIAL_STEPS.map(s => ({ ...s })) });

      // Step 1: mount
      patchStep("mount", { status: "running" });
      setProgress(6);
      await sleep(450);
      if (files.length === 0) {
        fail("mount", "Der ausgewählte Datenträger enthält keine Dateien. Ist der PKI-USB-Stick eingesteckt?");
        return;
      }
      patchStep("mount", { status: "ok", detail: `${files.length} Objekte gefunden` });
      setProgress(18);

      // Step 2: discover
      patchStep("discover", { status: "running" });
      await sleep(500);
      const certFile = files.find(f => f.name.toLowerCase() === "service.cert");
      const dirFile = files.find(f => f.name.toLowerCase() === "ad-demo.json");
      if (!certFile && !dirFile) {
        fail(
          "discover",
          "Weder service.cert noch ad-demo.json gefunden. Bitte den PKI-Token-Ordner mit beiden Dateien auswählen.",
        );
        return;
      }
      if (!certFile) {
        fail("discover", "service.cert fehlt auf dem Token. Zertifikatsprüfung nicht möglich.");
        return;
      }
      if (!dirFile) {
        fail("discover", "ad-demo.json fehlt auf dem Token. Verzeichnisdienst nicht erreichbar.");
        return;
      }
      patchStep("discover", { status: "ok", detail: "service.cert · ad-demo.json" });
      setProgress(36);

      // Step 3: certificate
      patchStep("cert", { status: "running" });
      await sleep(650);
      let cert: ParsedCertificate;
      try {
        cert = parseCertificate(await readFileAsText(certFile));
      } catch (e) {
        fail("cert", e instanceof Error ? e.message : "service.cert unlesbar.");
        return;
      }
      const certCheck = validateCertificate(cert);
      if (!certCheck.ok) {
        fail("cert", certCheck.errors.join(" "));
        return;
      }
      patchStep("cert", {
        status: certCheck.warnings.length > 0 ? "warn" : "ok",
        detail:
          certCheck.warnings.length > 0
            ? certCheck.warnings.join(" ")
            : `SN ${cert.serial} · ${cert.commonName}`,
      });
      setProgress(58);

      // Step 4: directory
      patchStep("dir", { status: "running" });
      await sleep(600);
      let directory: AdDirectory;
      try {
        directory = JSON.parse(await readFileAsText(dirFile)) as AdDirectory;
      } catch {
        fail("dir", "ad-demo.json ist kein gültiges JSON. Datei beschädigt?");
        return;
      }
      const dirCheck = validateDirectory(directory);
      if (!dirCheck.ok) {
        fail("dir", dirCheck.errors.join(" "));
        return;
      }
      patchStep("dir", {
        status: "ok",
        detail: `${directory.users.length} Benutzer · ${directory.sites.length} Funkstandorte`,
      });
      setProgress(76);

      // Step 5: chain (simulated OCSP/CRL)
      patchStep("chain", { status: "running" });
      await sleep(800);
      patchStep("chain", { status: "ok", detail: "OCSP: good · CRL: nicht gesperrt" });
      setProgress(92);

      // Step 6: release
      patchStep("release", { status: "running" });
      await sleep(400);
      patchStep("release", { status: "ok", detail: "Token-Bindung aktiv" });
      setProgress(100);

      setState(s => ({
        ...s,
        phase: "success",
        cert,
        directory,
        errorMessage: null,
        scannedAt: Date.now(),
      }));
      runningRef.current = false;
    },
    [fail, patchStep, setProgress],
  );

  /** Try File System Access API first; returns false if unsupported/aborted so caller can use fallback input. */
  const scanViaPicker = useCallback(async (): Promise<"done" | "unsupported" | "aborted" | "denied"> => {
    const w = window as unknown as {
      showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
    };
    if (!w.showDirectoryPicker) return "unsupported";
    try {
      const handle = await w.showDirectoryPicker({ mode: "read" });
      const files = await collectFilesFromHandle(handle);
      await scanFiles(files);
      return "done";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "aborted";
      return "denied";
    }
  }, [scanFiles]);

  return { state, scanFiles, scanViaPicker, reset };
}
