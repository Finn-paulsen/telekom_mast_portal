import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MapView } from "@/components/Map";
import { usePortalSession } from "@/contexts/PortalSession";
import { DEMO_DIRECTORY } from "@/lib/demoData";
import type { MastSite, MastOperationalState } from "@shared/masts";
import {
  RadioTower,
  MapPin,
  LogOut,
  Wrench,
  AlertTriangle,
  RotateCcw,
  Activity,
  ChevronRight,
  Signal,
} from "lucide-react";

const STATE_META: Record<
  MastOperationalState,
  { label: string; color: string; ring: string; icon: typeof Activity }
> = {
  active: { label: "In Betrieb", color: "#31d47c", ring: "rgba(49,212,124,0.35)", icon: Activity },
  maintenance: { label: "Wartung", color: "#e8b13f", ring: "rgba(232,177,63,0.35)", icon: Wrench },
  fault: { label: "Störung", color: "#e2453b", ring: "rgba(226,69,59,0.4)", icon: AlertTriangle },
  restarting: { label: "Neustart", color: "#3fd0e8", ring: "rgba(63,208,232,0.35)", icon: RotateCcw },
};

function markerHtml(site: MastSite): HTMLElement {
  const meta = STATE_META[site.state];
  const el = document.createElement("div");
  el.style.cssText = "position:relative;cursor:pointer;transform:translateY(4px);";
  el.innerHTML = `
    <div style="position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%);border-radius:50%;background:${meta.ring};animation:mast-pulse 2.2s ease-out infinite;"></div>
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:#0c1322;border:2px solid ${meta.color};box-shadow:0 0 14px ${meta.ring}, 0 4px 10px rgba(0,0,0,0.5);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9"/><path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5"/>
          <circle cx="12" cy="9" r="2"/>
          <path d="M16.2 4.8c2 2 2.26 5.11.8 7.47"/><path d="M19.1 1.9a10 10 0 0 1 .01 14.19"/>
          <path d="M9.5 18h5"/><path d="m8 22 4-11 4 11"/>
        </svg>
      </div>
      <div style="background:#0c1322ee;border:1px solid ${meta.color}55;color:#e6ecf8;font:600 10px 'Share Tech Mono',monospace;padding:2px 7px;border-radius:4px;white-space:nowrap;letter-spacing:0.4px;">
        ${site.siteId}
      </div>
    </div>`;
  return el;
}

export default function MastMap() {
  const [, navigate] = useLocation();
  const session = usePortalSession();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  const sites = useMemo(
    () => session.directory?.sites ?? DEMO_DIRECTORY.sites,
    [session.directory],
  );
  const user = session.user;

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Guard: without login go back
  useEffect(() => {
    if (!session.user) navigate("/");
  }, [session.user, navigate]);

  const attachMarkers = (map: google.maps.Map) => {
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current = sites.map(site => {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: site.coordinates.lat, lng: site.coordinates.lng },
        title: `${site.name} (${site.mastId})`,
        content: markerHtml(site),
      });
      marker.addListener("click", () => setSelected(site.siteId));
      return marker;
    });
  };

  const selectedSite = sites.find(s => s.siteId === selected) ?? null;

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="z-20 flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Telekom" className="h-9 w-9 rounded-sm" />
          <div>
            <div className="font-display text-sm font-bold tracking-wider">
              SERVICEPORTAL · FUNKINFRASTRUKTUR
            </div>
            <div className="font-tech text-[11px] text-muted-foreground">
              Standortauswahl · {sites.length} Funkstandorte im Zugriff
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="font-tech text-xs font-semibold text-foreground">{user.displayName}</div>
            <div className="font-tech text-[10px] text-muted-foreground">{user.role}</div>
          </div>
          <span className="font-tech text-sm tabular-nums text-foreground/80">
            {clock.toLocaleTimeString("de-DE")}
          </span>
          <button
            onClick={() => {
              session.logout();
              navigate("/");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-tech text-xs text-muted-foreground transition hover:border-[#e2453b]/60 hover:text-[#e2453b]"
          >
            <LogOut className="h-3.5 w-3.5" /> Abmelden
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Site list */}
        <aside className="order-2 w-full shrink-0 overflow-y-auto border-t border-border/60 bg-card/60 p-4 lg:order-1 lg:w-[380px] lg:border-r lg:border-t-0">
          <div className="kicker mb-1">Netzübersicht Nord</div>
          <h1 className="mb-1 font-display text-xl font-bold tracking-wide">Funkstandorte</h1>
          <p className="mb-4 text-xs text-muted-foreground">
            Standort auf der Karte oder in der Liste wählen, um die Maststeuerung zu öffnen.
          </p>

          {/* legend */}
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(STATE_META) as MastOperationalState[]).map(k => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 font-tech text-[10px] text-muted-foreground"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: STATE_META[k].color }} />
                {STATE_META[k].label}
              </span>
            ))}
          </div>

          <div className="space-y-2.5">
            {sites.map(site => {
              const meta = STATE_META[site.state];
              const Icon = meta.icon;
              const isSel = selected === site.siteId;
              return (
                <button
                  key={site.siteId}
                  onClick={() => {
                    setSelected(site.siteId);
                    mapRef.current?.panTo({ lat: site.coordinates.lat, lng: site.coordinates.lng });
                    mapRef.current?.setZoom(11);
                  }}
                  className={`group w-full rounded-lg border p-3.5 text-left transition ${
                    isSel
                      ? "border-primary/60 bg-primary/10 shadow-[0_0_18px_rgba(226,0,116,0.15)]"
                      : "border-border/70 bg-background/50 hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-md border"
                        style={{ borderColor: `${meta.color}66`, background: `${meta.color}14` }}
                      >
                        <RadioTower className="h-4.5 w-4.5" style={{ color: meta.color }} />
                      </div>
                      <div>
                        <div className="font-display text-sm font-bold tracking-wide text-foreground">
                          {site.siteId}{" "}
                          <span className="font-tech text-[10px] font-normal text-muted-foreground">
                            {site.mastId}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{site.name}</div>
                      </div>
                    </div>
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-tech text-[10px] font-semibold"
                      style={{ color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}44` }}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 font-tech text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Signal className="h-3 w-3" /> {site.telemetry.signalQuality}%
                    </span>
                    <span>↑ {site.telemetry.uplink} Mbps</span>
                    <span>↓ {site.telemetry.downlink} Mbps</span>
                  </div>
                  {isSel && (
                    <div
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 font-display text-xs font-bold tracking-widest text-primary-foreground shadow-[0_0_14px_rgba(226,0,116,0.35)]"
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/mast/${site.siteId}`);
                      }}
                      role="link"
                    >
                      MASTSTEUERUNG ÖFFNEN <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Map */}
        <div className="relative order-1 min-h-[380px] flex-1 lg:order-2">
          <MapView
            className="h-full min-h-[380px]"
            initialCenter={{ lat: 53.95, lng: 9.75 }}
            initialZoom={8}
            onMapReady={map => {
              mapRef.current = map;
              map.setOptions({
                mapTypeControl: false,
                streetViewControl: false,
                colorScheme: google.maps.ColorScheme?.DARK ?? undefined,
              } as google.maps.MapOptions);
              attachMarkers(map);
            }}
          />
          {/* floating selected card */}
          {selectedSite && (
            <div className="anim-rise absolute bottom-4 left-1/2 z-10 w-[min(480px,92%)] -translate-x-1/2 rounded-lg border border-border/80 bg-background/90 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-display text-sm font-bold tracking-wide">
                      {selectedSite.name}
                    </span>
                  </div>
                  <div className="mt-0.5 font-tech text-[11px] text-muted-foreground">
                    {selectedSite.mastId} · {selectedSite.region} · {selectedSite.heightM} m ·
                    BNetzA {selectedSite.bnetzaId}
                  </div>
                  <div className="mt-1 font-tech text-[11px] text-muted-foreground">
                    {selectedSite.backhaulType} · {selectedSite.cluster}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/mast/${selectedSite.siteId}`)}
                  className="shrink-0 rounded-md bg-primary px-4 py-2 font-display text-xs font-bold tracking-widest text-primary-foreground shadow-[0_0_14px_rgba(226,0,116,0.35)] transition hover:bg-primary/90"
                >
                  STEUERN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
