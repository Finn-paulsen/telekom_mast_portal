import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AdDirectory, DirectoryUser, ParsedCertificate } from "@shared/masts";

export interface SecurityIncident {
  time: number;
  message: string;
}

interface PortalSessionState {
  cert: ParsedCertificate | null;
  directory: AdDirectory | null;
  user: DirectoryUser | null;
  loginTime: number | null;
  overrideSession: boolean;
  securityIncidents: SecurityIncident[];
  setToken: (cert: ParsedCertificate, dir: AdDirectory) => void;
  clearToken: () => void;
  login: (user: DirectoryUser, override: boolean) => void;
  logout: () => void;
  reportIncident: (message: string) => void;
}

const Ctx = createContext<PortalSessionState | null>(null);

export function PortalSessionProvider({ children }: { children: ReactNode }) {
  const [cert, setCert] = useState<ParsedCertificate | null>(null);
  const [directory, setDirectory] = useState<AdDirectory | null>(null);
  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [loginTime, setLoginTime] = useState<number | null>(null);
  const [overrideSession, setOverrideSession] = useState(false);
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>([]);

  const reportIncident = useCallback((message: string) => {
    setSecurityIncidents(prev => [...prev.slice(-19), { time: Date.now(), message }]);
  }, []);

  const setToken = useCallback((c: ParsedCertificate, d: AdDirectory) => {
    setCert(c);
    setDirectory(d);
  }, []);

  const clearToken = useCallback(() => {
    setCert(null);
    setDirectory(null);
  }, []);

  const login = useCallback((u: DirectoryUser, override: boolean) => {
    setUser(u);
    setLoginTime(Date.now());
    setOverrideSession(override);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setLoginTime(null);
    setOverrideSession(false);
  }, []);

  const value = useMemo(
    () => ({ cert, directory, user, loginTime, overrideSession, securityIncidents, setToken, clearToken, login, logout, reportIncident }),
    [cert, directory, user, loginTime, overrideSession, securityIncidents, setToken, clearToken, login, logout, reportIncident],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortalSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortalSession must be used within PortalSessionProvider");
  return v;
}
