import type { QueueItem } from "../lib/types";
import { SEV_COLOR } from "../lib/analyzer";
import { IconPlay, IconTerminal, IconWarn } from "./icons";

interface Props {
  queue: QueueItem[];
  activeId: string | null;
  running: boolean;
  error: string | null;
  customText: string;
  onCustomChange: (v: string) => void;
  onAnalyzeSample: (id: string) => void;
  onAnalyzeCustom: () => void;
}

export default function IntakePanel({
  queue,
  activeId,
  running,
  error,
  customText,
  onCustomChange,
  onAnalyzeSample,
  onAnalyzeCustom,
}: Props) {
  const analyzed = queue.filter((q) => q.status === "analyzed").length;

  return (
    <section className="panel flex h-full flex-col p-5" aria-label="Alert intake">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold tracking-[0.28em] text-fog-300">
          INTAKE<span className="text-pulse-400">/</span>QUEUE
        </h2>
        <span className="font-mono text-[10px] tracking-widest text-fog-700">
          {analyzed}/{queue.length} TRIAGED
        </span>
      </header>

      {/* triage queue */}
      <ul className="space-y-2">
        {queue.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                onClick={() => onAnalyzeSample(item.id)}
                disabled={running}
                className={`step-row group w-full border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-pulse-400/60 bg-pulse-400/10"
                    : "border-edge/70 bg-ink-900/40 hover:border-pulse-400/40 hover:bg-ink-800/60"
                } ${running ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: item.severity ? SEV_COLOR[item.severity] : "#31456c",
                      boxShadow: item.severity ? `0 0 8px ${SEV_COLOR[item.severity]}` : "none",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fog-100">
                      {item.title}
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-fog-700">
                      {item.source.toUpperCase()} ·{" "}
                      {item.status === "analyzed" && item.severity ? (
                        <span style={{ color: SEV_COLOR[item.severity] }}>
                          {item.severity.toUpperCase()}
                        </span>
                      ) : (
                        "QUEUED"
                      )}
                    </span>
                  </span>
                  <IconPlay
                    size={14}
                    className={`shrink-0 text-fog-700 transition-colors ${
                      running ? "" : "group-hover:text-signal-400"
                    } ${active ? "text-signal-400" : ""}`}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* paste intake */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-edge/60 pt-4">
        <label
          htmlFor="alert-input"
          className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-fog-500"
        >
          <IconTerminal size={13} className="text-pulse-400" />
          PASTE ALERT JSON · {"{{ALERT_JSON}}"}
        </label>
        <textarea
          id="alert-input"
          spellCheck={false}
          value={customText}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder='{ "type": "...", "severity": 8, "resource": { ... } }'
          className="min-h-[132px] flex-1 resize-y border border-edge/70 bg-ink-950/80 p-3 font-mono text-[11px] leading-relaxed text-fog-300 placeholder:text-fog-700/70"
        />
        {error && (
          <p className="mt-2 flex items-start gap-1.5 border border-alert-400/40 bg-alert-400/10 px-2.5 py-1.5 text-[11px] text-alert-300">
            <IconWarn size={13} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        <button
          onClick={onAnalyzeCustom}
          disabled={running || customText.trim().length === 0}
          className="mt-3 flex items-center justify-center gap-2 border border-signal-400/70 bg-signal-400/15 px-4 py-2.5 font-display text-xs font-bold tracking-[0.24em] text-signal-300 transition-all hover:bg-signal-400/25 hover:shadow-[0_0_22px_-6px_#ffb020] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconPlay size={13} />
          {running ? "ANALYZING…" : "RUN ANALYZER"}
        </button>
        <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-fog-700">
          deterministic fallback engine · payload never leaves this browser
        </p>
      </div>
    </section>
  );
}
