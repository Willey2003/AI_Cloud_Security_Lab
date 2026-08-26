import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult, StepListKey } from "../lib/types";
import type { AnalyzeOutput } from "../lib/analyzer";
import { SEV_COLOR, SEV_SCORE } from "../lib/analyzer";
import {
  IconCheckCircle,
  IconCopy,
  IconDownload,
  IconLock,
  IconScope,
  IconWarn,
  IconWrench,
} from "./icons";

export type View = "idle" | "running" | "done";

interface Props {
  view: View;
  stages: { label: string; done: boolean }[];
  output: AnalyzeOutput | null;
  checksKey: string;
  checks: Record<string, boolean[]>;
  onToggle: (list: StepListKey, idx: number) => void;
  onResetChecks: () => void;
}

const LISTS: { key: StepListKey; label: string; Icon: typeof IconScope; tint: string }[] = [
  { key: "investigation_steps", label: "INVESTIGATE", Icon: IconScope, tint: "#39d7e6" },
  { key: "containment_steps", label: "CONTAIN", Icon: IconLock, tint: "#ffb020" },
  { key: "remediation_steps", label: "REMEDIATE", Icon: IconWrench, tint: "#ff8a2a" },
  { key: "validation_steps", label: "VALIDATE", Icon: IconCheckCircle, tint: "#35e0a1" },
];

function useCountUp(target: number, run: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 1000;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return val;
}

function Gauge({ severity }: { severity: AnalysisResult["severity_assessment"] }) {
  const score = SEV_SCORE[severity];
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(raf);
  }, [severity]);
  const shown = useCountUp(score, armed);
  const color = SEV_COLOR[severity];

  return (
    <div className="relative w-[168px] shrink-0">
      <svg viewBox="0 0 200 112" className="w-full">
        <path d="M14 100 A86 86 0 0 1 186 100" fill="none" stroke="#1b3155" strokeWidth="9" strokeLinecap="round" />
        {Array.from({ length: 11 }).map((_, i) => {
          const a = Math.PI * (1 - i / 10);
          const x1 = 100 + Math.cos(a) * 74;
          const y1 = 100 - Math.sin(a) * 74;
          const x2 = 100 + Math.cos(a) * 66;
          const y2 = 100 - Math.sin(a) * 66;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#31456c" strokeWidth="1.4" />;
        })}
        <path
          d="M14 100 A86 86 0 0 1 186 100"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={armed ? 100 - score : 100}
          className="gauge-arc"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <span className="font-display text-4xl font-bold tabular-nums" style={{ color }}>
          {shown}
        </span>
        <span className="font-mono text-xs text-fog-700">/100</span>
      </div>
    </div>
  );
}

function IdleState() {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-6 p-8 text-center">
      <svg viewBox="0 0 96 96" className="h-28 w-28 text-pulse-400" aria-hidden>
        <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeOpacity="0.22" />
        <circle cx="48" cy="48" r="27" fill="none" stroke="currentColor" strokeOpacity="0.18" />
        <circle cx="48" cy="48" r="12" fill="none" stroke="currentColor" strokeOpacity="0.14" />
        <g className="radar-sweep" style={{ transformOrigin: "48px 48px" }}>
          <path d="M48 48 L48 6 A42 42 0 0 1 78 19 Z" fill="currentColor" fillOpacity="0.2" />
        </g>
        <circle cx="66" cy="35" r="2.6" fill="#ffb020" className="blip" />
        <circle cx="33" cy="61" r="2.2" fill="#ff5163" className="blip" style={{ animationDelay: "1.4s" }} />
        <circle cx="57" cy="66" r="1.8" fill="#35e0a1" className="blip" style={{ animationDelay: "2.2s" }} />
        <circle cx="48" cy="48" r="2.4" fill="currentColor" />
      </svg>
      <div>
        <p className="font-display text-lg font-semibold tracking-[0.2em] text-fog-300">
          AWAITING ALERT PAYLOAD
        </p>
        <p className="caret mx-auto mt-2 max-w-sm font-mono text-[11px] leading-relaxed text-fog-500">
          select a queued finding or paste JSON — the deterministic engine maps severity, ATT&CK
          signals, and an evidence-first playbook
        </p>
      </div>
      <p className="font-mono text-[10px] tracking-[0.3em] text-fog-700">SCAN ACTIVE · 0 FINDINGS LOADED</p>
    </div>
  );
}

function RunningState({ stages }: { stages: Props["stages"] }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col justify-center gap-3 p-8">
      <p className="mb-4 font-display text-sm font-bold tracking-[0.28em] text-signal-300">
        PIPELINE<span className="text-pulse-400">//</span>RUNNING
      </p>
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <span
            className={`grid h-5 w-5 place-items-center border font-mono text-[10px] ${
              s.done
                ? "border-ok-400/60 bg-ok-400/10 text-ok-400"
                : i === stages.findIndex((x) => !x.done)
                  ? "border-signal-400/70 text-signal-400"
                  : "border-edge text-fog-700"
            }`}
          >
            {s.done ? "✓" : i === stages.findIndex((x) => !x.done) ? (
              <span className="h-2 w-2 animate-spin rounded-full border border-signal-400 border-t-transparent" />
            ) : (
              "·"
            )}
          </span>
          <span
            className={`font-mono text-[12px] ${
              s.done ? "text-fog-300" : "text-fog-500"
            }`}
          >
            {s.label}
          </span>
          {!s.done && i === stages.findIndex((x) => !x.done) && (
            <span className="h-px flex-1 max-w-[180px] dashline" />
          )}
        </div>
      ))}
      <p className="caret mt-4 font-mono text-[11px] text-fog-700">composing schema-strict response</p>
    </div>
  );
}

export default function AnalysisPanel({
  view,
  stages,
  output,
  checksKey,
  checks,
  onToggle,
  onResetChecks,
}: Props) {
  const [tab, setTab] = useState<StepListKey>("investigation_steps");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTab("investigation_steps");
    setCopied(false);
  }, [checksKey]);

  const json = useMemo(
    () => (output ? JSON.stringify(output.result, null, 2) : ""),
    [output],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel-analysis-${checksKey || "alert"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel flex h-full flex-col" aria-label="Analysis output">
      <header className="flex items-center justify-between border-b border-edge/60 px-5 py-3">
        <h2 className="font-display text-sm font-bold tracking-[0.28em] text-fog-300">
          ANALYSIS<span className="text-pulse-400">/</span>OUTPUT
        </h2>
        <span className="border border-pulse-400/40 bg-pulse-400/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-pulse-300">
          schema v1.0 · fallback:deterministic
        </span>
      </header>

      {view === "idle" && <IdleState />}
      {view === "running" && <RunningState stages={stages} />}

      {view === "done" && output && (
        <div className="flex-1 overflow-y-auto p-5">
          {/* severity header */}
          <div className="flex flex-col gap-4 border border-edge/60 bg-ink-900/50 p-4 sm:flex-row sm:items-center">
            <Gauge severity={output.result.severity_assessment} />
            <div className="min-w-0 flex-1">
              <p
                className="font-display text-3xl font-bold uppercase leading-none tracking-wide sm:text-4xl"
                style={{ color: SEV_COLOR[output.result.severity_assessment] }}
              >
                {output.result.severity_assessment}
              </p>
              <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-fog-100">
                {output.meta.title}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {[
                  output.meta.source && `SRC:${output.meta.source.toUpperCase()}`,
                  output.meta.region && `REGION:${output.meta.region}`,
                  output.meta.account && `ACCT:${output.meta.account}`,
                  output.meta.firstSeen && `FIRST-SEEN:${output.meta.firstSeen.slice(0, 16)}Z`,
                  output.matchedRules.length > 0 &&
                    `RULES:${output.matchedRules.join("+").toUpperCase()}`,
                ]
                  .filter(Boolean)
                  .map((chip) => (
                    <span
                      key={chip as string}
                      className="border border-edge bg-ink-950/70 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider text-fog-500"
                    >
                      {chip}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* executive summary */}
          <div className="mt-4 border-l-2 border-signal-400 bg-ink-900/40 py-3 pl-4 pr-3">
            <p className="font-mono text-[10px] tracking-[0.25em] text-signal-300">
              EXECUTIVE SUMMARY
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog-300">
              {output.result.executive_summary}
            </p>
          </div>

          {/* affected resources */}
          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] tracking-[0.25em] text-fog-500">
              AFFECTED RESOURCES · {output.result.affected_resources.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {output.result.affected_resources.map((r) => (
                <span
                  key={r}
                  className="border border-pulse-600/50 bg-pulse-400/5 px-2 py-1 font-mono text-[11px] text-pulse-300"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          {/* playbook tabs */}
          <div className="mt-5">
            <div className="grid grid-cols-4 border border-edge/70">
              {LISTS.map(({ key, label, Icon, tint }) => {
                const total = output.result[key].length;
                const done = (checks[`${checksKey}:${key}`] ?? []).filter(Boolean).length;
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`relative flex flex-col items-center gap-1 px-1 py-2.5 transition-colors ${
                      active ? "bg-ink-700/60" : "bg-ink-900/30 hover:bg-ink-800/60"
                    }`}
                  >
                    <Icon size={15} style={{ color: active ? tint : "#5f7396" }} />
                    <span
                      className="font-display text-[10px] font-bold tracking-[0.14em]"
                      style={{ color: active ? tint : "#8ca0c3" }}
                    >
                      {label}
                    </span>
                    <span className="font-mono text-[9px] text-fog-700">
                      {done}/{total}
                    </span>
                    <span
                      className="absolute bottom-0 left-0 h-0.5 transition-all duration-500"
                      style={{ width: active ? "100%" : `${(done / Math.max(1, total)) * 100}%`, background: tint }}
                    />
                  </button>
                );
              })}
            </div>

            <ul className="mt-3 space-y-1.5">
              {output.result[tab].map((step, i) => {
                const key = `${checksKey}:${tab}`;
                const arr = checks[key] ?? [];
                const done = !!arr[i];
                return (
                  <li key={step}>
                    <button
                      onClick={() => onToggle(tab, i)}
                      className={`step-row flex w-full items-start gap-3 border px-3 py-2.5 text-left ${
                        done
                          ? "border-edge/40 bg-ink-900/20"
                          : "border-edge/60 bg-ink-900/40 hover:border-fog-700/70"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border transition-colors ${
                          done ? "border-ok-400 bg-ok-400/20 text-ok-400" : "border-fog-700 text-transparent"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="m5 12 5 5 9-10" />
                        </svg>
                      </span>
                      <span
                        className={`text-[12.5px] leading-relaxed transition-colors ${
                          done ? "text-fog-700 line-through decoration-fog-700/60" : "text-fog-300"
                        }`}
                      >
                        {step}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={onResetChecks}
              className="mt-2 font-mono text-[10px] tracking-widest text-fog-700 underline-offset-4 transition-colors hover:text-pulse-300 hover:underline"
            >
              ↺ RESET CHECKLIST PROGRESS
            </button>
          </div>

          {/* assumptions */}
          <div className="mt-5 border border-signal-400/30 bg-signal-400/5 p-3.5">
            <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-signal-300">
              <IconWarn size={13} />
              ASSUMPTIONS &amp; UNKNOWNS · {output.result.assumptions_and_unknowns.length}
            </p>
            <ul className="mt-2 space-y-1.5">
              {output.result.assumptions_and_unknowns.map((a) => (
                <li key={a} className="flex gap-2 text-[12px] leading-relaxed text-fog-500">
                  <span className="text-signal-400">▸</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>

          {/* export actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              onClick={copy}
              className={`flex items-center gap-2 border px-4 py-2 font-display text-[11px] font-bold tracking-[0.2em] transition-all ${
                copied
                  ? "border-ok-400/70 bg-ok-400/10 text-ok-400"
                  : "border-pulse-400/60 bg-pulse-400/10 text-pulse-300 hover:bg-pulse-400/20"
              }`}
            >
              <IconCopy size={13} />
              {copied ? "COPIED ✓" : "COPY SCHEMA JSON"}
            </button>
            <button
              onClick={download}
              className="flex items-center gap-2 border border-edge px-4 py-2 font-display text-[11px] font-bold tracking-[0.2em] text-fog-300 transition-colors hover:border-fog-700 hover:text-fog-100"
            >
              <IconDownload size={13} />
              DOWNLOAD .JSON
            </button>
            <span className="font-mono text-[10px] text-fog-700">
              {json.length.toLocaleString()} bytes · contract-exact schema
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
