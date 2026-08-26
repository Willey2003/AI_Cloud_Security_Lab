import type { MitreMapping, QueueItem, Severity } from "../lib/types";
import { SEV_COLOR, TACTICS } from "../lib/analyzer";
import { IconLink, IconMatrix } from "./icons";

interface Props {
  mappings: MitreMapping[];
  resultSeverity: Severity | null;
  selected: string | null;
  onSelect: (tactic: string | null) => void;
  queue: QueueItem[];
}

const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low", "Informational"];

export default function AttackMatrix({
  mappings,
  resultSeverity,
  selected,
  onSelect,
  queue,
}: Props) {
  const matchedByTactic = new Map<string, MitreMapping[]>();
  for (const m of mappings) {
    const list = matchedByTactic.get(m.tactic) ?? [];
    list.push(m);
    matchedByTactic.set(m.tactic, list);
  }

  const sevCounts = SEVERITIES.map((s) => ({
    sev: s,
    count: queue.filter((q) => q.severity === s).length,
  }));
  const maxCount = Math.max(1, ...sevCounts.map((s) => s.count));
  const analyzed = queue.filter((q) => q.status === "analyzed").length;

  return (
    <div className="space-y-5">
      {/* matrix rail */}
      <section className="panel p-5" aria-label="MITRE ATT&CK matrix">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold tracking-[0.28em] text-fog-300">
            <IconMatrix size={15} className="text-pulse-400" />
            ATT&CK<span className="text-pulse-400">/</span>RAIL
          </h2>
          <span className="font-mono text-[10px] tracking-widest text-fog-700">
            ENTERPRISE v16 · {mappings.length} SIGNAL{mappings.length === 1 ? "" : "S"}
          </span>
        </header>

        <div className="grid grid-cols-7 gap-1.5">
          {TACTICS.map((t) => {
            const hits = matchedByTactic.get(t.name) ?? [];
            const matched = hits.length > 0;
            const color = resultSeverity ? SEV_COLOR[resultSeverity] : "#39d7e6";
            const isSel = selected === t.name;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(isSel ? null : t.name)}
                title={`${t.name} (${t.id})`}
                className={`group relative flex aspect-square flex-col items-center justify-center border transition-all duration-200 ${
                  matched
                    ? "border-transparent"
                    : "border-edge/50 bg-ink-900/30 hover:border-fog-700/60"
                } ${isSel ? "ring-1 ring-pulse-400" : ""}`}
                style={
                  matched
                    ? {
                        background: `${color}22`,
                        boxShadow: `inset 0 0 0 1px ${color}88, 0 0 14px -4px ${color}`,
                      }
                    : undefined
                }
              >
                <span
                  className={`font-display text-[9px] font-bold tracking-wider ${
                    matched ? "" : "text-fog-500"
                  }`}
                  style={matched ? { color } : undefined}
                >
                  {t.short}
                </span>
                <span className="mt-0.5 font-mono text-[8px] text-fog-700">{t.id}</span>
                {matched && (
                  <span
                    className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center font-mono text-[8px] font-bold text-ink-950"
                    style={{ background: color }}
                  >
                    {hits.length}
                  </span>
                )}
                {matched && (
                  <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-44 -translate-x-1/2 border border-edge bg-ink-950 p-2 text-left shadow-xl group-hover:block">
                    {hits.map((h) => (
                      <span key={h.technique} className="block font-mono text-[9px] leading-relaxed text-fog-300">
                        <span style={{ color }}>{h.technique.split("—")[0].trim()}</span>{" "}
                        {h.technique.split("—")[1] ?? ""}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-fog-700">
          lit cells = mapped tactics for the current finding · hover for techniques · click to
          filter
        </p>
      </section>

      {/* technique cards */}
      <section className="panel p-5" aria-label="Technique mappings">
        <h2 className="mb-3 font-display text-sm font-bold tracking-[0.28em] text-fog-300">
          TECHNIQUE<span className="text-pulse-400">/</span>MAP
        </h2>
        {mappings.length === 0 ? (
          <p className="font-mono text-[11px] leading-relaxed text-fog-700">
            No confident mapping for the current payload — see assumptions panel.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {mappings
              .filter((m) => !selected || m.tactic === selected)
              .map((m) => (
                <li
                  key={`${m.tactic}-${m.technique}`}
                  className="border border-edge/60 bg-ink-900/40 p-3 transition-colors hover:border-pulse-400/40"
                >
                  <p className="font-mono text-[10px] tracking-[0.2em] text-fog-700">
                    {m.tactic.toUpperCase()}
                  </p>
                  <p className="mt-0.5 font-display text-[15px] font-semibold leading-snug text-fog-100">
                    <span className="text-pulse-400">{m.technique.split("—")[0].trim()}</span>
                    {m.technique.includes("—") && (
                      <span className="text-fog-300"> — {m.technique.split("—").slice(1).join("—").trim()}</span>
                    )}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-fog-500">{m.reason}</p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* session correlation */}
      <section className="panel p-5" aria-label="Session correlation">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold tracking-[0.28em] text-fog-300">
            <IconLink size={14} className="text-pulse-400" />
            CORRELATE<span className="text-pulse-400">/</span>SESSION
          </h2>
          <span className="font-mono text-[10px] text-fog-700">{analyzed} ANALYZED</span>
        </header>
        <div className="flex h-24 items-end gap-2.5">
          {sevCounts.map(({ sev, count }) => (
            <div key={sev} className="group flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`font-mono text-[10px] tabular-nums transition-opacity ${
                  count > 0 ? "opacity-100" : "opacity-30"
                }`}
                style={{ color: SEV_COLOR[sev] }}
              >
                {count}
              </span>
              <div className="relative w-full border border-edge/40 bg-ink-950/60" style={{ height: 64 }}>
                <div
                  className="bar-anim absolute bottom-0 left-0 right-0"
                  style={{
                    height: `${(count / maxCount) * 100}%`,
                    background: `linear-gradient(180deg, ${SEV_COLOR[sev]}cc, ${SEV_COLOR[sev]}33)`,
                  }}
                />
              </div>
              <span className="font-mono text-[8px] tracking-wider text-fog-700">
                {sev.slice(0, 4).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-fog-700">
          triage mix across this session · stored locally, resets with browser storage
        </p>
      </section>
    </div>
  );
}
