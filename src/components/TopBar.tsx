import { useEffect, useState } from "react";
import { IconShield } from "./icons";

function Led({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="led" style={{ background: color, color }} />
      <span className="font-mono text-[10px] tracking-widest text-fog-500">
        {label}
        <span className="ml-1.5 text-fog-300">{value}</span>
      </span>
    </div>
  );
}

function RadarMini() {
  return (
    <svg viewBox="0 0 48 48" className="h-9 w-9 text-pulse-400" aria-hidden>
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeOpacity="0.2" />
      <circle cx="24" cy="24" r="5" fill="none" stroke="currentColor" strokeOpacity="0.15" />
      <g className="radar-sweep">
        <path d="M24 24 L24 3 A21 21 0 0 1 39 9.5 Z" fill="currentColor" fillOpacity="0.22" />
      </g>
      <circle cx="33" cy="17" r="1.6" fill="#ffb020" className="blip" />
      <circle cx="16" cy="31" r="1.3" fill="#ff5163" className="blip" style={{ animationDelay: "1.1s" }} />
      <circle cx="24" cy="24" r="1.4" fill="currentColor" />
    </svg>
  );
}

export default function TopBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const utc = now.toISOString().slice(11, 19);

  return (
    <header className="sticky top-0 z-50 border-b border-edge/70 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center border border-pulse-400/50 bg-ink-800 text-pulse-400">
            <IconShield size={20} />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-signal-400 led" style={{ color: "#ffb020" }} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-bold tracking-[0.18em] text-fog-100">
              SENTINEL<span className="text-pulse-400">//</span>LAB
            </p>
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-500">
              AI CLOUD SECURITY ANALYST · DEFENSIVE CONSOLE
            </p>
          </div>
        </div>

        <div className="ml-auto hidden items-center gap-6 lg:flex">
          <Led color="#ffb020" label="ANALYZER" value="DETERMINISTIC-FALLBACK" />
          <Led color="#39d7e6" label="INGEST" value="SIMULATED" />
          <Led color="#35e0a1" label="SCOPE" value="LAB-ONLY" />
        </div>

        <div className="ml-auto flex items-center gap-4 lg:ml-6">
          <div className="hidden sm:block">
            <RadarMini />
          </div>
          <div className="text-right leading-tight">
            <p className="font-mono text-lg font-semibold tabular-nums text-fog-100">{utc}</p>
            <p className="font-mono text-[10px] tracking-[0.25em] text-fog-500">UTC · ZULU</p>
          </div>
        </div>
      </div>
    </header>
  );
}
