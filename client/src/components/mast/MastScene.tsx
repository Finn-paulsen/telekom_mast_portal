/**
 * MastScene — highly detailed animated radio mast, Fallout-4-inspired.
 *
 * The scene is a layered SVG driven by GSAP timelines. All moving parts are
 * addressed via refs/ids: satellite dish (azimuth pivot + elevation), sector
 * antenna panels, microwave link dishes, aviation beacon, status lights,
 * signal rings, data packets, satellite, stars, atmosphere.
 *
 * The imperative API (via ref) lets the console play named scene states that
 * the animation variant engine produces.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import gsap from "gsap";

export interface MastSceneHandle {
  /** Play a named scene state; returns duration control handled internally. */
  setState: (state: string) => void;
  /** Reset to idle. */
  reset: () => void;
}

interface MastSceneProps {
  /** Overall health flavor of the site (colors the ambient lighting). */
  flavor?: "ok" | "warn" | "err" | "off";
  className?: string;
}

/** Deterministic pseudo-random star field. */
function useStars(count: number, w: number, h: number) {
  return useMemo(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    };
    const r = rng(1337);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: r() * w,
      y: r() * h * 0.72,
      r: 0.4 + r() * 1.1,
      o: 0.25 + r() * 0.65,
      tw: 2 + r() * 4,
    }));
  }, [count, w, h]);
}

const W = 920;
const H = 560;

export const MastScene = forwardRef<MastSceneHandle, MastSceneProps>(function MastScene(
  { flavor = "ok", className },
  ref,
) {
  const rootRef = useRef<SVGSVGElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const idleTlRef = useRef<gsap.core.Timeline[]>([]);
  const stars = useStars(90, W, H);

  /** Kill current action timeline. */
  const killActive = () => {
    tlRef.current?.kill();
    tlRef.current = null;
  };

  const q = (sel: string) => rootRef.current?.querySelectorAll(sel) ?? [];
  const one = (sel: string) => rootRef.current?.querySelector(sel) as SVGGraphicsElement | null;

  // ============ IDLE AMBIENT LOOPS ============
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const loops: gsap.core.Timeline[] = [];

    // Beacon blink (aviation light) — double flash pattern
    const beacon = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
    beacon
      .to("#beacon-lamp", { opacity: 1, duration: 0.08 })
      .to("#beacon-glow", { opacity: 0.9, scale: 1.25, transformOrigin: "center", duration: 0.12 }, "<")
      .to("#beacon-lamp", { opacity: 0.15, duration: 0.25 })
      .to("#beacon-glow", { opacity: 0, scale: 1, duration: 0.3 }, "<")
      .to("#beacon-lamp", { opacity: 1, duration: 0.08 })
      .to("#beacon-glow", { opacity: 0.7, scale: 1.15, duration: 0.1 }, "<")
      .to("#beacon-lamp", { opacity: 0.15, duration: 0.3 })
      .to("#beacon-glow", { opacity: 0, scale: 1, duration: 0.35 }, "<");
    loops.push(beacon);

    // Slow dish idle sway (azimuth micro tracking)
    const dishIdle = gsap.timeline({ repeat: -1, yoyo: true });
    dishIdle.to("#dish-azimuth", {
      rotation: 4,
      transformOrigin: "50% 100%",
      duration: 6,
      ease: "sine.inOut",
    });
    loops.push(dishIdle);

    // Microwave dish subtle breathing
    const mwIdle = gsap.timeline({ repeat: -1, yoyo: true });
    mwIdle.to("#mw-dish-group", { rotation: -2, transformOrigin: "20% 50%", duration: 7, ease: "sine.inOut" });
    loops.push(mwIdle);

    // Signal rings pulsing from dish feed
    q(".sig-ring").forEach((el, i) => {
      const t = gsap.timeline({ repeat: -1, delay: i * 0.9 });
      t.fromTo(
        el,
        { scale: 0.25, opacity: 0.85, transformOrigin: "center" },
        { scale: 1.9, opacity: 0, duration: 2.8, ease: "power1.out" },
      );
      loops.push(t);
    });

    // Star twinkle
    q(".star").forEach((el, i) => {
      const t = gsap.timeline({ repeat: -1, yoyo: true, delay: (i % 7) * 0.4 });
      t.to(el, { opacity: 0.1, duration: 1.5 + (i % 5) * 0.7, ease: "sine.inOut" });
      loops.push(t);
    });

    // Satellite drift + solar panel shimmer
    const sat = gsap.timeline({ repeat: -1, yoyo: true });
    sat.to("#satellite", { x: 26, y: -8, duration: 14, ease: "sine.inOut" });
    loops.push(sat);
    const satBlink = gsap.timeline({ repeat: -1, repeatDelay: 2.4 });
    satBlink.to("#sat-light", { opacity: 1, duration: 0.1 }).to("#sat-light", { opacity: 0.1, duration: 0.4 });
    loops.push(satBlink);

    // Uplink beam shimmer
    const beam = gsap.timeline({ repeat: -1, yoyo: true });
    beam.to("#uplink-beam", { opacity: 0.75, duration: 2.2, ease: "sine.inOut" });
    loops.push(beam);

    // Data packets travelling along uplink path
    q(".packet").forEach((el, i) => {
      const t = gsap.timeline({ repeat: -1, delay: i * 0.85 });
      t.fromTo(
        el,
        { opacity: 0 },
        { opacity: 1, duration: 0.2 },
      );
      // manual path via attr interpolation (line from dish feed to satellite)
      t.fromTo(
        el,
        { attr: { cx: 318, cy: 168 } },
        { attr: { cx: 788, cy: 96 }, duration: 2.4, ease: "none" },
        0,
      ).to(el, { opacity: 0, duration: 0.25 }, 2.3);
      loops.push(t);
    });

    // Status lights on tower blink softly in sequence
    q(".tower-light").forEach((el, i) => {
      const t = gsap.timeline({ repeat: -1, repeatDelay: 3 + i * 0.5 });
      t.to(el, { opacity: 0.15, duration: 0.4 }).to(el, { opacity: 1, duration: 0.4 });
      loops.push(t);
    });

    // Radar sweep on top platform
    const radar = gsap.timeline({ repeat: -1 });
    radar.to("#radar-sweep", { rotation: 360, transformOrigin: "0% 50%", duration: 5, ease: "none" });
    loops.push(radar);

    // Sector panels micro vibration (very subtle)
    const sector = gsap.timeline({ repeat: -1, yoyo: true });
    sector.to("#sector-array", { y: -1.2, duration: 3.4, ease: "sine.inOut" });
    loops.push(sector);

    // Obstruction lights mid-tower alternate
    const obst = gsap.timeline({ repeat: -1, yoyo: true });
    obst.to(".obstruction-a", { opacity: 0.2, duration: 1.1 }).to(".obstruction-b", { opacity: 1, duration: 1.1 }, "<");
    loops.push(obst);

    idleTlRef.current = loops;
    return () => {
      loops.forEach(l => l.kill());
      idleTlRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============ ACTION STATES ============
  useImperativeHandle(ref, () => ({
    setState(state: string) {
      const root = rootRef.current;
      if (!root) return;
      killActive();
      const tl = gsap.timeline();
      tlRef.current = tl;
      const ctx = { q, one, tl, root };
      applySceneState(state, ctx);
    },
    reset() {
      killActive();
      resetScene(q, one);
    },
  }));

  const flavorColor =
    flavor === "ok" ? "#31d47c" : flavor === "warn" ? "#e8b13f" : flavor === "err" ? "#e2453b" : "#4a5568";

  return (
    <svg
      ref={rootRef}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Animierte Visualisierung des Antennensystems"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#05070f" />
          <stop offset="55%" stopColor="#0a1120" />
          <stop offset="100%" stopColor="#141d33" />
        </linearGradient>
        <linearGradient id="ground-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#131a2c" />
          <stop offset="100%" stopColor="#0b101e" />
        </linearGradient>
        <linearGradient id="steel-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5d6b85" />
          <stop offset="50%" stopColor="#8a97b2" />
          <stop offset="100%" stopColor="#414d63" />
        </linearGradient>
        <linearGradient id="beam-g" x1="318" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e20074" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#e20074" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#e20074" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow-magenta" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e20074" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#e20074" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-red" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff3b30" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ff3b30" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-flavor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={flavorColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={flavorColor} stopOpacity="0" />
        </radialGradient>
        <filter id="soft-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="strong-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ======= SKY ======= */}
      <rect width={W} height={H} fill="url(#sky-g)" />
      <g id="starfield">
        {stars.map(s => (
          <circle key={s.id} className="star" cx={s.x} cy={s.y} r={s.r} fill="#cdd8f0" opacity={s.o} />
        ))}
      </g>

      {/* Distant skyline */}
      <g id="skyline" opacity="0.5">
        <path
          d="M0 448 L60 448 L60 430 L92 430 L92 448 L150 448 L150 438 L188 438 L188 448 L260 448 L640 448 L640 436 L672 436 L672 448 L730 448 L730 425 L742 425 L742 448 L820 448 L820 440 L860 440 L860 448 L920 448"
          fill="none"
          stroke="#232f4a"
          strokeWidth="2"
        />
        <rect x="60" y="430" width="32" height="18" fill="#101728" />
        <rect x="150" y="438" width="38" height="10" fill="#101728" />
        <rect x="640" y="436" width="32" height="12" fill="#101728" />
        <rect x="730" y="425" width="12" height="23" fill="#101728" />
        <rect x="820" y="440" width="40" height="8" fill="#101728" />
        <circle cx="76" cy="433" r="1.4" fill="#e8b13f" opacity="0.7" />
        <circle cx="736" cy="428" r="1.4" fill="#ff3b30" opacity="0.7" />
      </g>

      {/* ======= GROUND ======= */}
      <rect x="0" y="448" width={W} height={H - 448} fill="url(#ground-g)" />
      <line x1="0" y1="448" x2={W} y2="448" stroke="#26324e" strokeWidth="1.5" />
      {/* fence */}
      <g stroke="#26324e" strokeWidth="1" opacity="0.85">
        {Array.from({ length: 24 }, (_, i) => (
          <line key={i} x1={20 + i * 38} y1="448" x2={20 + i * 38} y2="432" />
        ))}
        <line x1="12" y1="436" x2="912" y2="436" />
        <line x1="12" y1="442" x2="912" y2="442" />
      </g>

      {/* ======= SATELLITE (orbital) ======= */}
      <g id="satellite" transform="translate(770, 88)">
        <rect x="-34" y="-6" width="24" height="12" rx="1.5" fill="#2c3a56" stroke="#46587d" strokeWidth="1" />
        <rect x="10" y="-6" width="24" height="12" rx="1.5" fill="#2c3a56" stroke="#46587d" strokeWidth="1" />
        <g stroke="#5a6f9a" strokeWidth="0.6" opacity="0.8">
          <line x1="-30" y1="-6" x2="-30" y2="6" />
          <line x1="-24" y1="-6" x2="-24" y2="6" />
          <line x1="-18" y1="-6" x2="-18" y2="6" />
          <line x1="14" y1="-6" x2="14" y2="6" />
          <line x1="20" y1="-6" x2="20" y2="6" />
          <line x1="26" y1="-6" x2="26" y2="6" />
        </g>
        <rect x="-9" y="-8" width="18" height="16" rx="2" fill="#3b4a6b" stroke="#5a6f9a" strokeWidth="1" />
        <path d="M0 8 L0 14 M-4 14 L4 14" stroke="#5a6f9a" strokeWidth="1.2" />
        <circle id="sat-light" cx="0" cy="-11" r="2.2" fill="#e20074" opacity="0.15" filter="url(#soft-glow)" />
        <circle id="sat-rx-glow" cx="0" cy="0" r="16" fill="url(#glow-magenta)" opacity="0" />
      </g>

      {/* ======= UPLINK BEAM & PACKETS ======= */}
      <g id="uplink-group">
        <path
          id="uplink-beam"
          d="M318 168 L760 82 L780 110 L322 186 Z"
          fill="url(#beam-g)"
          opacity="0.4"
        />
        <line id="uplink-trace" x1="318" y1="168" x2="788" y2="96" stroke="#e20074" strokeWidth="1" strokeDasharray="6 10" opacity="0.5" />
        <circle className="packet" r="3" fill="#ff5ca8" filter="url(#soft-glow)" opacity="0" />
        <circle className="packet" r="2.4" fill="#ff8ac1" filter="url(#soft-glow)" opacity="0" />
        <circle className="packet" r="2" fill="#e20074" filter="url(#soft-glow)" opacity="0" />
      </g>

      {/* ======= TOWER ======= */}
      <g id="tower-root">
        {/* concrete base */}
        <rect x="242" y="436" width="120" height="14" rx="2" fill="#1d2740" stroke="#31405f" strokeWidth="1" />
        <rect x="252" y="426" width="100" height="12" rx="2" fill="#16203a" stroke="#2a3856" strokeWidth="1" />

        {/* lattice mast */}
        <g id="tower-lattice" stroke="url(#steel-g)" strokeWidth="2.4" fill="none">
          <line x1="268" y1="428" x2="292" y2="96" />
          <line x1="336" y1="428" x2="312" y2="96" />
        </g>
        <g id="tower-cross" stroke="#4d5c78" strokeWidth="1.1" fill="none" opacity="0.95">
          {[
            [268, 428, 336, 396], [336, 428, 268, 396],
            [271, 396, 333, 362], [333, 396, 271, 362],
            [274, 362, 330, 328], [330, 362, 274, 328],
            [277, 328, 327, 294], [327, 328, 277, 294],
            [280, 294, 324, 260], [324, 294, 280, 260],
            [283, 260, 321, 226], [321, 260, 283, 226],
            [286, 226, 318, 192], [318, 226, 286, 192],
            [288, 192, 316, 158], [316, 192, 288, 158],
            [290, 158, 314, 124], [314, 158, 290, 124],
          ].map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
          {[396, 362, 328, 294, 260, 226, 192, 158, 124].map((y, i) => {
            const t = (428 - y) / (428 - 96);
            const lx = 268 + (292 - 268) * t;
            const rx = 336 + (312 - 336) * t;
            return <line key={`h${i}`} x1={lx} y1={y} x2={rx} y2={y} />;
          })}
        </g>

        {/* cable run */}
        <path id="cable-run" d="M300 428 C 296 340, 305 220, 302 100" stroke="#20293f" strokeWidth="3" fill="none" />
        <path d="M300 428 C 296 340, 305 220, 302 100" stroke="#e20074" strokeWidth="0.8" fill="none" opacity="0.35" id="cable-pulse" strokeDasharray="4 30" />

        {/* equipment cabinet at base */}
        <g id="cabinet">
          <rect x="368" y="392" width="52" height="44" rx="3" fill="#1a2337" stroke="#31405f" strokeWidth="1.2" />
          <rect x="374" y="398" width="18" height="10" rx="1" fill="#0e1526" />
          <circle className="cab-led" cx="378" cy="416" r="2" fill="#31d47c" filter="url(#soft-glow)" />
          <circle className="cab-led cab-led-2" cx="386" cy="416" r="2" fill="#e8b13f" filter="url(#soft-glow)" opacity="0.6" />
          <circle className="cab-led cab-led-3" cx="394" cy="416" r="2" fill="#e20074" filter="url(#soft-glow)" opacity="0.4" />
          <g stroke="#2a3856" strokeWidth="1">
            <line x1="372" y1="426" x2="416" y2="426" />
            <line x1="372" y1="430" x2="416" y2="430" />
          </g>
          <path d="M368 402 L340 402" stroke="#20293f" strokeWidth="2.4" />
        </g>

        {/* mid-tower obstruction lights */}
        <circle className="obstruction-a tower-light" cx="284" cy="290" r="2.6" fill="#ff3b30" filter="url(#soft-glow)" />
        <circle className="obstruction-b tower-light" cx="321" cy="290" r="2.6" fill="#ff3b30" filter="url(#soft-glow)" opacity="0.4" />
        <circle className="obstruction-a tower-light" cx="288" cy="200" r="2.4" fill="#ff3b30" filter="url(#soft-glow)" opacity="0.8" />
        <circle className="obstruction-b tower-light" cx="317" cy="200" r="2.4" fill="#ff3b30" filter="url(#soft-glow)" opacity="0.4" />

        {/* ======= SECTOR ANTENNA ARRAY (3 panels) ======= */}
        <g id="sector-array">
          {/* mounting ring */}
          <rect x="282" y="128" width="40" height="6" rx="2" fill="#3b4a6b" />
          {/* left panel */}
          <g id="sector-left">
            <rect x="262" y="106" width="12" height="44" rx="3" fill="#4a5a7c" stroke="#6b7da3" strokeWidth="1" />
            <line x1="274" y1="116" x2="284" y2="126" stroke="#3b4a6b" strokeWidth="2" />
            <line x1="274" y1="140" x2="284" y2="134" stroke="#3b4a6b" strokeWidth="2" />
            <circle className="sector-led" cx="268" cy="112" r="1.8" fill="#31d47c" filter="url(#soft-glow)" />
          </g>
          {/* right panel */}
          <g id="sector-right">
            <rect x="330" y="106" width="12" height="44" rx="3" fill="#4a5a7c" stroke="#6b7da3" strokeWidth="1" />
            <line x1="330" y1="116" x2="320" y2="126" stroke="#3b4a6b" strokeWidth="2" />
            <line x1="330" y1="140" x2="320" y2="134" stroke="#3b4a6b" strokeWidth="2" />
            <circle className="sector-led" cx="336" cy="112" r="1.8" fill="#31d47c" filter="url(#soft-glow)" />
          </g>
          {/* front panel */}
          <g id="sector-front">
            <rect x="295" y="100" width="14" height="48" rx="3" fill="#55668c" stroke="#7688ae" strokeWidth="1" />
            <circle className="sector-led" cx="302" cy="106" r="1.8" fill="#31d47c" filter="url(#soft-glow)" />
          </g>
        </g>

        {/* ======= MICROWAVE LINK DISH (side) ======= */}
        <g id="mw-dish-group" transform="translate(281, 236)">
          <line x1="0" y1="0" x2="14" y2="0" stroke="#3b4a6b" strokeWidth="3" />
          <g id="mw-dish">
            <ellipse cx="-6" cy="0" rx="7" ry="16" fill="#5d6f94" stroke="#7f92ba" strokeWidth="1.2" />
            <ellipse cx="-8" cy="0" rx="3.5" ry="12" fill="#42527455" />
            <line x1="-6" y1="0" x2="-20" y2="0" stroke="#7f92ba" strokeWidth="1.4" />
            <circle cx="-20" cy="0" r="2" fill="#aebbd8" />
            <circle className="mw-led" cx="-6" cy="-18" r="1.8" fill="#e8b13f" filter="url(#soft-glow)" opacity="0.85" />
          </g>
        </g>
        {/* microwave beam to skyline */}
        <line id="mw-beam" x1="261" y1="236" x2="30" y2="240" stroke="#3fd0e8" strokeWidth="1" strokeDasharray="3 9" opacity="0.35" />

        {/* ======= MAIN SATELLITE DISH ======= */}
        <g id="dish-azimuth" transform="translate(312, 160)">
          {/* pivot mount */}
          <rect x="-6" y="-4" width="12" height="14" rx="2" fill="#3b4a6b" stroke="#55668c" strokeWidth="1" />
          <g id="dish-elevation" transform="rotate(-14)">
            {/* dish reflector */}
            <g id="dish-body">
              <path
                d="M4 -34 A 46 46 0 0 1 4 34 L 0 30 A 40 40 0 0 0 0 -30 Z"
                fill="#8b9cc0"
                stroke="#aebbd8"
                strokeWidth="1.4"
              />
              <path d="M4 -34 A 46 46 0 0 1 4 34 L 2 32 A 43 43 0 0 0 2 -32 Z" fill="#b9c6e0" opacity="0.5" />
              {/* ribs */}
              <g stroke="#6b7da3" strokeWidth="0.7" opacity="0.9">
                <path d="M4 -34 A 46 46 0 0 1 4 34" fill="none" />
                <line x1="3" y1="-24" x2="8" y2="-24" />
                <line x1="5" y1="-12" x2="10" y2="-12" />
                <line x1="6" y1="0" x2="11" y2="0" />
                <line x1="5" y1="12" x2="10" y2="12" />
                <line x1="3" y1="24" x2="8" y2="24" />
              </g>
              {/* feed arm */}
              <line x1="6" y1="0" x2="30" y2="0" stroke="#aebbd8" strokeWidth="1.6" />
              <circle id="dish-feed" cx="30" cy="0" r="3.2" fill="#e8eefc" stroke="#aebbd8" strokeWidth="1" />
              <circle id="feed-glow" cx="30" cy="0" r="9" fill="url(#glow-magenta)" opacity="0.5" />
            </g>
          </g>
        </g>

        {/* signal rings emanating from dish feed */}
        <g id="ring-anchor" transform="translate(318, 168)">
          <circle className="sig-ring" r="26" fill="none" stroke="#e20074" strokeWidth="1.4" opacity="0" />
          <circle className="sig-ring" r="26" fill="none" stroke="#ff5ca8" strokeWidth="1" opacity="0" />
          <circle className="sig-ring" r="26" fill="none" stroke="#e20074" strokeWidth="0.8" opacity="0" />
        </g>

        {/* ======= TOP PLATFORM: radar + beacon ======= */}
        <g id="top-platform">
          <rect x="288" y="92" width="28" height="6" rx="2" fill="#3b4a6b" />
          <line x1="302" y1="92" x2="302" y2="66" stroke="url(#steel-g)" strokeWidth="2.6" />
          {/* whip antennas */}
          <line id="whip-1" x1="294" y1="92" x2="290" y2="58" stroke="#7f92ba" strokeWidth="1.2" />
          <line id="whip-2" x1="311" y1="92" x2="315" y2="62" stroke="#7f92ba" strokeWidth="1.2" />
          <circle className="tower-light" cx="290" cy="57" r="1.6" fill="#e8b13f" filter="url(#soft-glow)" />
          <circle className="tower-light" cx="315" cy="61" r="1.6" fill="#e8b13f" filter="url(#soft-glow)" />
          {/* radar sweep line */}
          <g transform="translate(302, 80)">
            <circle r="13" fill="none" stroke="#2a3856" strokeWidth="1" opacity="0.9" />
            <circle r="8" fill="none" stroke="#2a3856" strokeWidth="0.8" opacity="0.7" />
            <line id="radar-sweep" x1="0" y1="0" x2="13" y2="0" stroke="#3fd0e8" strokeWidth="1.2" opacity="0.8" filter="url(#soft-glow)" />
            <circle r="1.6" fill="#3fd0e8" filter="url(#soft-glow)" />
          </g>
          {/* aviation beacon on very top */}
          <g transform="translate(302, 60)">
            <line x1="0" y1="6" x2="0" y2="-8" stroke="#7f92ba" strokeWidth="1.6" />
            <circle id="beacon-glow" cx="0" cy="-12" r="14" fill="url(#glow-red)" opacity="0" />
            <circle id="beacon-lamp" cx="0" cy="-12" r="4" fill="#ff3b30" filter="url(#strong-glow)" opacity="0.15" />
            <rect x="-3" y="-9" width="6" height="4" rx="1" fill="#3b4a6b" />
          </g>
        </g>
      </g>

      {/* ======= OVERLAYS (action states) ======= */}
      <g id="overlay-scan" opacity="0">
        <line x1="0" y1="120" x2={W} y2="120" stroke="#3fd0e8" strokeWidth="1.2" opacity="0.7" filter="url(#soft-glow)" id="scanline" />
        <text x="24" y="40" fill="#3fd0e8" fontSize="12" fontFamily="'Share Tech Mono', monospace" id="overlay-scan-text" opacity="0.85">SCAN AKTIV…</text>
      </g>
      <g id="overlay-grid" opacity="0">
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`v${i}`} x1={115 * (i + 1)} y1="0" x2={115 * (i + 1)} y2={H} stroke="#e20074" strokeWidth="0.4" opacity="0.35" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={93 * (i + 1)} x2={W} y2={93 * (i + 1)} stroke="#e20074" strokeWidth="0.4" opacity="0.35" />
        ))}
      </g>
      <g id="overlay-lock" opacity="0" transform="translate(318, 168)">
        <circle r="42" fill="none" stroke="#31d47c" strokeWidth="1.6" strokeDasharray="10 6" id="lock-ring" filter="url(#soft-glow)" />
        <path d="M-52 0 L-42 0 M42 0 L52 0 M0 -52 L0 -42 M0 42 L0 52" stroke="#31d47c" strokeWidth="2" />
        <text x="0" y="68" textAnchor="middle" fill="#31d47c" fontSize="11" fontFamily="'Share Tech Mono', monospace">TARGET LOCK</text>
      </g>
      <g id="overlay-alert" opacity="0">
        <rect x="0" y="0" width={W} height={H} fill="#e2453b" opacity="0.05" />
        <text x={W / 2} y="42" textAnchor="middle" fill="#e2453b" fontSize="14" fontFamily="'Share Tech Mono', monospace" filter="url(#soft-glow)" id="overlay-alert-text">
          ⚠ SYSTEM OFFLINE
        </text>
      </g>
      <g id="overlay-boot" opacity="0">
        <text x="24" y={H - 28} fill="#31d47c" fontSize="11" fontFamily="'Share Tech Mono', monospace" id="boot-text">
          BOOT SEQUENCE INITIALIZED_
        </text>
      </g>

      {/* vignette */}
      <rect width={W} height={H} fill="none" stroke="#000" strokeWidth="0" />
    </svg>
  );
});

/* ================= Scene state machine ================= */

interface StateCtx {
  q: (sel: string) => NodeListOf<Element> | never[];
  one: (sel: string) => SVGGraphicsElement | null;
  tl: gsap.core.Timeline;
  root: SVGSVGElement;
}

function resetScene(q: StateCtx["q"], one: StateCtx["one"]) {
  gsap.set("#dish-azimuth", { rotation: 0 });
  gsap.set("#dish-elevation", { rotation: -14 });
  gsap.set(["#overlay-scan", "#overlay-grid", "#overlay-lock", "#overlay-alert", "#overlay-boot"], { opacity: 0 });
  gsap.set("#uplink-group", { opacity: 1 });
  gsap.set("#tower-root", { opacity: 1 });
  gsap.set(".sector-led", { fill: "#31d47c", opacity: 1 });
  gsap.set("#sector-array", { opacity: 1 });
}

function applySceneState(state: string, ctx: StateCtx) {
  const { tl } = ctx;

  const showOverlay = (id: string, o = 1, d = 0.4) => tl.to(id, { opacity: o, duration: d }, 0);
  const hideOverlays = (d = 0.4) =>
    tl.to(["#overlay-scan", "#overlay-grid", "#overlay-lock", "#overlay-alert", "#overlay-boot"], { opacity: 0, duration: d }, 0);

  switch (state) {
    /* ---------- alignment family ---------- */
    case "dish-sweep-wide":
      hideOverlays();
      showOverlay("#overlay-scan", 1);
      tl.to("#scanline", { attr: { y1: 400, y2: 400 }, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);
      tl.to("#dish-azimuth", { rotation: -26, transformOrigin: "50% 100%", duration: 1.1, ease: "power2.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 24, duration: 1.4, ease: "power2.inOut" });
      tl.to("#dish-azimuth", { rotation: -10, duration: 0.9, ease: "power2.inOut" });
      break;
    case "dish-sweep-fine":
      tl.to("#dish-azimuth", { rotation: 8, transformOrigin: "50% 100%", duration: 0.7, ease: "sine.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 2, duration: 0.55, ease: "sine.inOut" });
      tl.to("#dish-azimuth", { rotation: 6, duration: 0.45, ease: "sine.inOut" });
      tl.to("#dish-azimuth", { rotation: 4, duration: 0.35, ease: "sine.inOut" });
      tl.to("#feed-glow", { opacity: 0.9, scale: 1.4, transformOrigin: "center", duration: 0.5, yoyo: true, repeat: 3 }, 0);
      break;
    case "dish-spiral":
      hideOverlays();
      showOverlay("#overlay-grid", 1);
      tl.to("#dish-azimuth", { rotation: -20, transformOrigin: "50% 100%", duration: 0.8, ease: "sine.inOut" }, 0);
      tl.to("#dish-elevation", { rotation: -30, duration: 0.8, ease: "sine.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 18, duration: 0.9, ease: "sine.inOut" });
      tl.to("#dish-elevation", { rotation: -4, duration: 0.9, ease: "sine.inOut" }, "<");
      tl.to("#dish-azimuth", { rotation: -8, duration: 0.7, ease: "sine.inOut" });
      tl.to("#dish-elevation", { rotation: -20, duration: 0.7, ease: "sine.inOut" }, "<");
      break;
    case "dish-overshoot":
      tl.to("#dish-azimuth", { rotation: 16, transformOrigin: "50% 100%", duration: 0.5, ease: "power3.in" }, 0);
      tl.to("#dish-azimuth", { rotation: 3, duration: 0.8, ease: "elastic.out(1, 0.35)" });
      tl.to("#overlay-scan-text", { opacity: 0.4, duration: 0.15, yoyo: true, repeat: 5 }, 0);
      break;
    case "dish-el-sweep":
      hideOverlays();
      showOverlay("#overlay-grid", 1);
      tl.to("#dish-elevation", { rotation: -42, duration: 0.9, ease: "power2.inOut" }, 0);
      tl.to("#dish-elevation", { rotation: 6, duration: 1, ease: "power2.inOut" });
      break;
    case "dish-az-sweep":
      tl.to("#dish-azimuth", { rotation: -22, transformOrigin: "50% 100%", duration: 0.9, ease: "power2.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 14, duration: 1, ease: "power2.inOut" });
      break;
    case "dish-microadjust":
      tl.to("#dish-azimuth", { rotation: 5, transformOrigin: "50% 100%", duration: 0.3, ease: "sine.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 3.4, duration: 0.25 });
      tl.to("#dish-azimuth", { rotation: 4.6, duration: 0.22 });
      tl.to("#dish-azimuth", { rotation: 4, duration: 0.2 });
      tl.to("#dish-elevation", { rotation: -12, duration: 0.5, ease: "sine.inOut" }, 0);
      tl.to("#feed-glow", { opacity: 1, duration: 0.3, yoyo: true, repeat: 4 }, 0);
      break;
    case "dish-lock":
      hideOverlays();
      showOverlay("#overlay-lock", 1, 0.3);
      tl.to("#lock-ring", { rotation: 180, transformOrigin: "center", duration: 1.6, ease: "power1.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 4, transformOrigin: "50% 100%", duration: 0.6, ease: "power3.out" }, 0);
      tl.to("#feed-glow", { opacity: 1, scale: 1.6, transformOrigin: "center", duration: 0.5, yoyo: true, repeat: 2 }, 0.2);
      break;

    /* ---------- calibration family ---------- */
    case "calib-motor-test":
      hideOverlays();
      showOverlay("#overlay-grid", 1);
      tl.to("#dish-azimuth", { rotation: -30, transformOrigin: "50% 100%", duration: 0.55, ease: "power2.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 30, duration: 0.75, ease: "power2.inOut" });
      tl.to("#dish-azimuth", { rotation: 0, duration: 0.5, ease: "power2.inOut" });
      tl.to("#dish-elevation", { rotation: -44, duration: 0.5, ease: "power2.inOut" }, 0.4);
      tl.to("#dish-elevation", { rotation: 4, duration: 0.6, ease: "power2.inOut" }, 1);
      tl.to("#dish-elevation", { rotation: -14, duration: 0.45, ease: "power2.inOut" }, 1.7);
      tl.to("#mw-dish-group", { rotation: -14, transformOrigin: "20% 50%", duration: 0.5, yoyo: true, repeat: 1 }, 0.6);
      break;
    case "calib-sensor":
      tl.to(".sector-led", { fill: "#3fd0e8", duration: 0.2, stagger: 0.15 }, 0);
      tl.to(".sector-led", { opacity: 0.2, duration: 0.18, yoyo: true, repeat: 7, stagger: 0.1 }, 0.2);
      tl.to("#whip-1", { rotation: -4, transformOrigin: "50% 100%", duration: 0.4, yoyo: true, repeat: 3 }, 0);
      tl.to("#whip-2", { rotation: 4, transformOrigin: "50% 100%", duration: 0.4, yoyo: true, repeat: 3 }, 0.2);
      break;
    case "calib-injection":
      hideOverlays();
      showOverlay("#overlay-scan", 1);
      tl.to("#cable-pulse", { opacity: 1, strokeDashoffset: -300, duration: 2, ease: "none" }, 0);
      tl.to("#feed-glow", { opacity: 1, scale: 1.8, transformOrigin: "center", duration: 0.6, yoyo: true, repeat: 2 }, 0.4);
      break;
    case "calib-spectrum":
      showOverlay("#overlay-grid", 1);
      tl.to("#scanline", { attr: { y1: 100, y2: 100 }, duration: 0.01 }, 0);
      tl.to("#scanline", { attr: { y1: 440, y2: 440 }, duration: 2.2, ease: "sine.inOut" }, 0);
      tl.to(".sector-led", { fill: "#e8b13f", duration: 0.3 }, 0.4);
      break;
    case "calib-trim":
      tl.to("#feed-glow", { opacity: 0.4, duration: 0.25, yoyo: true, repeat: 5 }, 0);
      tl.to("#uplink-beam", { opacity: 0.75, duration: 0.5, yoyo: true, repeat: 2 }, 0);
      break;
    case "calib-thermal":
      tl.to(".cab-led", { fill: "#e8b13f", duration: 0.3 }, 0);
      tl.to("#cabinet rect", { stroke: "#e8b13f", duration: 0.5, yoyo: true, repeat: 2 }, 0);
      tl.to(".cab-led", { opacity: 0.2, duration: 0.2, yoyo: true, repeat: 7, stagger: 0.12 }, 0.3);
      break;
    case "calib-poweron-test":
      tl.to(".tower-light", { opacity: 0, duration: 0.15 }, 0);
      tl.to(".tower-light", { opacity: 1, duration: 0.12, stagger: 0.14 }, 0.4);
      tl.to(".sector-led", { opacity: 0, duration: 0.15 }, 0);
      tl.to(".sector-led", { opacity: 1, duration: 0.12, stagger: 0.2 }, 0.7);
      break;
    case "calib-verify":
      hideOverlays();
      showOverlay("#overlay-lock", 0.8, 0.3);
      tl.to("#dish-azimuth", { rotation: -6, transformOrigin: "50% 100%", duration: 0.5, ease: "sine.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: 6, duration: 0.6, ease: "sine.inOut" });
      tl.to("#dish-azimuth", { rotation: 0, duration: 0.45, ease: "power2.out" });
      break;

    /* ---------- satellite sync family ---------- */
    case "sat-search":
      hideOverlays();
      showOverlay("#overlay-scan", 1);
      tl.to("#uplink-group", { opacity: 0.15, duration: 0.5 }, 0);
      tl.to("#dish-elevation", { rotation: -34, duration: 0.9, ease: "sine.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: -18, transformOrigin: "50% 100%", duration: 1, ease: "sine.inOut" }, 0.2);
      tl.to("#dish-azimuth", { rotation: 12, duration: 1.1, ease: "sine.inOut" });
      tl.to("#sat-light", { opacity: 1, duration: 0.12, yoyo: true, repeat: 8 }, 0.4);
      break;
    case "sat-handshake":
      tl.to("#uplink-group", { opacity: 0.6, duration: 0.6 }, 0);
      tl.to("#uplink-trace", { strokeDashoffset: -160, duration: 2.2, ease: "none", opacity: 0.9 }, 0);
      tl.to("#sat-rx-glow", { opacity: 0.8, duration: 0.4, yoyo: true, repeat: 4 }, 0.3);
      tl.to("#feed-glow", { opacity: 0.9, duration: 0.4, yoyo: true, repeat: 4 }, 0.5);
      break;
    case "sat-burst":
      tl.to("#uplink-group", { opacity: 1, duration: 0.2 }, 0);
      tl.to("#uplink-beam", { opacity: 0.9, duration: 0.12, yoyo: true, repeat: 11 }, 0);
      tl.to("#sat-rx-glow", { opacity: 1, scale: 1.3, transformOrigin: "center", duration: 0.15, yoyo: true, repeat: 9 }, 0.1);
      break;
    case "sat-drop":
      tl.to("#uplink-group", { opacity: 0, duration: 0.6, ease: "power2.in" }, 0);
      tl.to("#sat-light", { opacity: 0.05, duration: 0.4 }, 0);
      tl.to("#feed-glow", { opacity: 0.1, duration: 0.4 }, 0);
      break;
    case "sat-track":
      hideOverlays();
      showOverlay("#overlay-grid", 1);
      tl.to("#dish-azimuth", { rotation: 10, transformOrigin: "50% 100%", duration: 1.8, ease: "none" }, 0);
      tl.to("#dish-elevation", { rotation: -8, duration: 1.8, ease: "none" }, 0);
      break;
    case "sat-doppler":
      tl.to("#uplink-trace", { strokeDashoffset: -300, duration: 2.2, ease: "power1.inOut", opacity: 0.85 }, 0);
      tl.to("#uplink-beam", { opacity: 0.55, duration: 1.1, yoyo: true, repeat: 1 }, 0);
      break;
    case "sat-datastream":
      tl.to("#uplink-group", { opacity: 1, duration: 0.4 }, 0);
      tl.to("#uplink-trace", { strokeDashoffset: -420, duration: 1.9, ease: "none", opacity: 1 }, 0);
      tl.to("#sat-rx-glow", { opacity: 0.7, duration: 0.5, yoyo: true, repeat: 2 }, 0.2);
      break;

    /* ---------- band switch family ---------- */
    case "band-prepare":
      hideOverlays();
      tl.to("#feed-glow", { opacity: 0.2, duration: 0.5 }, 0);
      tl.to("#dish-elevation", { rotation: -20, duration: 0.8, ease: "sine.inOut" }, 0);
      tl.to(".sector-led", { fill: "#3fd0e8", duration: 0.4 }, 0.3);
      break;
    case "band-crossfade":
      tl.to("#uplink-beam", { opacity: 0.1, duration: 0.8, ease: "power2.inOut" }, 0);
      tl.to("#uplink-beam", { opacity: 0.6, duration: 0.9, ease: "power2.out" }, 1);
      tl.to("#feed-glow", { opacity: 1, scale: 1.5, transformOrigin: "center", duration: 0.7 }, 1);
      break;
    case "band-cut":
      tl.to("#uplink-group", { opacity: 0, duration: 0.25, ease: "power3.in" }, 0);
      tl.to("#overlay-alert", { opacity: 0.6, duration: 0.2, yoyo: true, repeat: 2 }, 0.1);
      break;
    case "band-requal":
      tl.to("#overlay-alert", { opacity: 0, duration: 0.2 }, 0);
      showOverlay("#overlay-scan", 1);
      tl.to("#uplink-trace", { opacity: 0.5, strokeDashoffset: -140, duration: 2, ease: "none" }, 0.3);
      break;
    case "band-rampup":
      tl.to("#uplink-group", { opacity: 1, duration: 1.2, ease: "power1.in" }, 0);
      tl.to("#feed-glow", { opacity: 1, duration: 0.4, yoyo: true, repeat: 2 }, 0.4);
      break;
    case "band-probe":
      hideOverlays();
      showOverlay("#overlay-grid", 1);
      tl.to("#mw-dish-group", { rotation: -10, transformOrigin: "20% 50%", duration: 0.7, yoyo: true, repeat: 1 }, 0);
      tl.to("#mw-beam", { opacity: 0.8, strokeDashoffset: -120, duration: 1.8, ease: "none" }, 0);
      break;

    /* ---------- diagnostics ---------- */
    case "diag-scan":
      hideOverlays();
      showOverlay("#overlay-scan", 1);
      tl.to("#scanline", { attr: { y1: 60, y2: 60 }, duration: 0.01 }, 0);
      tl.to("#scanline", { attr: { y1: 448, y2: 448 }, duration: 2.4, ease: "power1.inOut" }, 0);
      tl.to(".sector-led", { fill: "#3fd0e8", opacity: 0.3, duration: 0.2, yoyo: true, repeat: 5, stagger: 0.15 }, 0.2);
      tl.to(".cab-led", { opacity: 0.2, duration: 0.15, yoyo: true, repeat: 7, stagger: 0.1 }, 0.5);
      break;
    case "diag-load":
      tl.to("#uplink-beam", { opacity: 0.85, duration: 0.3, yoyo: true, repeat: 5 }, 0);
      tl.to("#cable-pulse", { opacity: 1, strokeDashoffset: -400, duration: 2.2, ease: "none" }, 0);
      break;
    case "diag-thermal":
      tl.to("#cabinet rect", { stroke: "#e2453b", duration: 0.5 }, 0);
      tl.to(".cab-led", { fill: "#e2453b", duration: 0.3, stagger: 0.2 }, 0.2);
      tl.to("#cabinet rect", { stroke: "#31405f", duration: 0.6 }, 1.6);
      tl.to(".cab-led", { fill: "#31d47c", duration: 0.4 }, 1.7);
      break;
    case "diag-report":
      hideOverlays();
      showOverlay("#overlay-boot", 1, 0.2);
      tl.to("#boot-text", { opacity: 0.3, duration: 0.2, yoyo: true, repeat: 5 }, 0);
      break;

    /* ---------- maintenance ---------- */
    case "maint-rampdown":
      hideOverlays();
      tl.to(".sector-led", { fill: "#e8b13f", duration: 0.5 }, 0);
      tl.to("#uplink-beam", { opacity: 0.12, duration: 1 }, 0);
      tl.to("#uplink-trace", { opacity: 0.15, duration: 1 }, 0);
      break;
    case "maint-idle":
      showOverlay("#overlay-alert", 0.5, 0.4);
      break;

    /* ---------- RESTART: shutdown ---------- */
    case "shutdown-warn":
      hideOverlays();
      showOverlay("#overlay-alert", 0.8, 0.3);
      tl.to(".sector-led", { fill: "#e8b13f", duration: 0.4 }, 0);
      tl.to("#uplink-beam", { opacity: 0.2, duration: 1.2, ease: "power2.in" }, 0.2);
      break;
    case "shutdown-lights":
      tl.to(".tower-light", { opacity: 0, duration: 0.3, stagger: 0.18, ease: "power2.in" }, 0);
      tl.to(".sector-led", { opacity: 0, duration: 0.3, stagger: 0.2 }, 0.3);
      tl.to(".mw-led", { opacity: 0, duration: 0.3 }, 0.6);
      tl.to("#uplink-group", { opacity: 0, duration: 0.9, ease: "power2.in" }, 0.2);
      tl.to("#radar-sweep", { opacity: 0, duration: 0.5 }, 0.8);
      break;
    case "shutdown-fold":
      tl.to("#dish-elevation", { rotation: -78, duration: 1.8, ease: "power2.inOut" }, 0);
      tl.to("#dish-azimuth", { rotation: -30, transformOrigin: "50% 100%", duration: 1.6, ease: "power2.inOut" }, 0.2);
      tl.to("#mw-dish-group", { rotation: -55, transformOrigin: "20% 50%", duration: 1.4, ease: "power2.inOut" }, 0.3);
      tl.to("#whip-1", { rotation: -10, transformOrigin: "50% 100%", duration: 1, ease: "power2.in" }, 0.5);
      tl.to("#whip-2", { rotation: 10, transformOrigin: "50% 100%", duration: 1, ease: "power2.in" }, 0.5);
      break;
    case "shutdown-dark":
      tl.to("#beacon-lamp", { opacity: 0, duration: 0.4 }, 0);
      tl.to("#beacon-glow", { opacity: 0, duration: 0.4 }, 0);
      tl.to(".cab-led", { opacity: 0, duration: 0.3, stagger: 0.25 }, 0.2);
      tl.to("#tower-root", { opacity: 0.45, duration: 1.4, ease: "power2.inOut" }, 0.3);
      tl.to("#overlay-alert", { opacity: 1, duration: 0.4 }, 0.5);
      tl.to("#skyline", { opacity: 0.2, duration: 1 }, 0.4);
      break;

    /* ---------- RESTART: boot ---------- */
    case "boot-power":
      hideOverlays();
      showOverlay("#overlay-boot", 1, 0.2);
      tl.to("#tower-root", { opacity: 1, duration: 1, ease: "power1.out" }, 0);
      tl.to("#skyline", { opacity: 0.5, duration: 1 }, 0);
      tl.to(".cab-led", { opacity: 1, duration: 0.15, stagger: 0.3 }, 0.5);
      tl.to("#boot-text", { opacity: 0.4, duration: 0.18, yoyo: true, repeat: 5 }, 0);
      break;
    case "boot-lights":
      tl.to(".tower-light", { opacity: 1, duration: 0.14, stagger: 0.22, ease: "power2.out" }, 0);
      tl.to("#beacon-lamp", { opacity: 1, duration: 0.1 }, 0.9);
      tl.to("#beacon-glow", { opacity: 0.8, duration: 0.2, yoyo: true, repeat: 3 }, 0.9);
      tl.to(".sector-led", { opacity: 1, fill: "#31d47c", duration: 0.2, stagger: 0.25 }, 0.5);
      tl.to(".mw-led", { opacity: 0.85, duration: 0.2 }, 1.1);
      tl.to("#radar-sweep", { opacity: 0.8, duration: 0.4 }, 1.2);
      break;
    case "boot-unfold":
      tl.to("#dish-azimuth", { rotation: 0, transformOrigin: "50% 100%", duration: 1.7, ease: "back.out(1.2)" }, 0);
      tl.to("#dish-elevation", { rotation: -14, duration: 1.9, ease: "back.out(1.1)" }, 0.3);
      tl.to("#mw-dish-group", { rotation: 0, transformOrigin: "20% 50%", duration: 1.5, ease: "back.out(1.3)" }, 0.4);
      tl.to("#whip-1", { rotation: 0, transformOrigin: "50% 100%", duration: 0.9, ease: "elastic.out(1, 0.4)" }, 0.8);
      tl.to("#whip-2", { rotation: 0, transformOrigin: "50% 100%", duration: 0.9, ease: "elastic.out(1, 0.4)" }, 0.9);
      break;
    case "boot-signal":
      tl.to("#uplink-group", { opacity: 1, duration: 1.4, ease: "power1.in" }, 0);
      tl.to("#uplink-trace", { strokeDashoffset: -250, duration: 2, ease: "none", opacity: 0.8 }, 0.2);
      tl.to("#feed-glow", { opacity: 1, scale: 1.7, transformOrigin: "center", duration: 0.5, yoyo: true, repeat: 3 }, 0.4);
      tl.to("#sat-rx-glow", { opacity: 0.8, duration: 0.4, yoyo: true, repeat: 3 }, 0.8);
      break;

    /* ---------- success ---------- */
    case "success-burst":
      hideOverlays(0.3);
      tl.to("#feed-glow", { opacity: 1, scale: 2.2, transformOrigin: "center", duration: 0.6, ease: "power2.out" }, 0);
      tl.to("#feed-glow", { opacity: 0.5, scale: 1, duration: 0.8, ease: "power2.inOut" });
      tl.to(".sector-led", { fill: "#31d47c", opacity: 1, duration: 0.3 }, 0);
      tl.to("#uplink-beam", { opacity: 0.7, duration: 0.5 }, 0.2);
      tl.to("#overlay-lock", { opacity: 1, duration: 0.25 }, 0);
      tl.to("#overlay-lock", { opacity: 0, duration: 0.6 }, 1.2);
      break;

    /* ---------- error / degraded ---------- */
    case "error-interference":
      hideOverlays();
      showOverlay("#overlay-alert", 0.9, 0.2);
      tl.to("#uplink-beam", { opacity: 0.05, duration: 0.1, yoyo: true, repeat: 9 }, 0);
      tl.to(".sector-led", { fill: "#e2453b", duration: 0.3 }, 0);
      tl.to("#dish-azimuth", { x: 1.5, duration: 0.06, yoyo: true, repeat: 12 }, 0);
      break;

    default:
      hideOverlays();
      break;
  }
}
