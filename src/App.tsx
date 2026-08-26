import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TopBar from "./components/TopBar";
import Ticker from "./components/Ticker";
import IntakePanel from "./components/IntakePanel";
import AnalysisPanel, { type View } from "./components/AnalysisPanel";
import AttackMatrix from "./components/AttackMatrix";
import Roadmap from "./components/Roadmap";
import DeployGuide from "./components/DeployGuide";
import Reveal from "./components/Reveal";
import { IconShield } from "./components/icons";
import { SAMPLES } from "./data/samples";
import { analyze, SEV_COLOR, type AnalyzeOutput } from "./lib/analyzer";
import type { QueueItem, Severity, StepListKey } from "./lib/types";

const STAGE_LABELS = [
  "Parsing alert payload",
  "Extracting resource identifiers",
  "Matching detection rules",
  "Mapping MITRE ATT&CK signals",
  "Scoring severity & composing playbook",
];

const LEGEND: { sev: Severity; score: number }[] = [
  { sev: "Critical", score: 97 },
  { sev: "High", score: 80 },
  { sev: "Medium", score: 55 },
  { sev: "Low", score: 30 },
  { sev: "Informational", score: 12 },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — lab continues in memory */
  }
}

const initialQueue: QueueItem[] = SAMPLES.map((s) => ({
  id: s.id,
  title: s.title,
  source: s.source,
  status: "queued",
}));

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>(() => load("sentinel.queue.v1", initialQueue));
  const [checks, setChecks] = useState<Record<string, boolean[]>>(() =>
    load("sentinel.checks.v1", {}),
  );
  const [customText, setCustomText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("idle");
  const [stages, setStages] = useState<{ label: string; done: boolean }[]>([]);
  const [output, setOutput] = useState<AnalyzeOutput | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => save("sentinel.queue.v1", queue), [queue]);
  useEffect(() => save("sentinel.checks.v1", checks), [checks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "TEXTAREA" && tag !== "INPUT") {
        e.preventDefault();
        document.getElementById("alert-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const runAnalysis = useCallback((rawText: string, id: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      setError(
        `Invalid JSON — ${(err as Error).message.slice(0, 90)}. Fix the payload and re-run.`,
      );
      return;
    }
    setError(null);
    setActiveId(id);
    setSelectedTactic(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setView("running");
    setStages(STAGE_LABELS.map((label) => ({ label, done: false })));

    STAGE_LABELS.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setStages((prev) => prev.map((s, j) => (j <= i ? { ...s, done: true } : s)));
        }, 240 * (i + 1)),
      );
    });

    timers.current.push(
      window.setTimeout(() => {
        const out = analyze(parsed);
        setOutput(out);
        setView("done");
        setQueue((prev) =>
          prev.some((q) => q.id === id)
            ? prev.map((q) =>
                q.id === id
                  ? {
                      ...q,
                      status: "analyzed",
                      severity: out.result.severity_assessment,
                      analyzedAt: Date.now(),
                    }
                  : q,
              )
            : [
                ...prev,
                {
                  id,
                  title: out.meta.title.slice(0, 64),
                  source: out.meta.source,
                  status: "analyzed",
                  severity: out.result.severity_assessment,
                  analyzedAt: Date.now(),
                },
              ],
        );
      }, 240 * STAGE_LABELS.length + 380),
    );
  }, []);

  const analyzeSample = (id: string) => {
    const sample = SAMPLES.find((s) => s.id === id);
    if (sample) {
      runAnalysis(sample.json, id);
      return;
    }
    if (id === "custom-payload" && customText.trim()) {
      runAnalysis(customText, id);
      return;
    }
    setError(
      "The payload for this session entry is no longer in the intake buffer — paste the JSON again to re-analyze.",
    );
  };

  const analyzeCustom = () => {
    if (customText.trim()) runAnalysis(customText, "custom-payload");
  };

  const toggleCheck = (list: StepListKey, idx: number) => {
    if (!output || !activeId) return;
    const key = `${activeId}:${list}`;
    const total = output.result[list].length;
    setChecks((prev) => {
      const arr = [...(prev[key] ?? new Array(total).fill(false))];
      arr[idx] = !arr[idx];
      return { ...prev, [key]: arr };
    });
  };

  const resetChecks = () => {
    if (!activeId) return;
    setChecks((prev) => {
      const next: Record<string, boolean[]> = {};
      for (const [k, v] of Object.entries(prev))
        if (!k.startsWith(`${activeId}:`)) next[k] = v;
      return next;
    });
  };

  const stats = useMemo(
    () => ({
      open: queue.filter((q) => q.status === "queued").length,
      triaged: queue.filter((q) => q.status === "analyzed").length,
      techniques: output?.result.mitre_attack.length ?? 0,
    }),
    [queue, output],
  );

  return (
    <div className="relative min-h-screen font-body">
      <div className="grid-overlay" aria-hidden />
      <div className="scanline" aria-hidden />

      <div className="relative z-10">
        <TopBar />
        <Ticker />

        {/* console header */}
        <div className="mx-auto max-w-[1500px] px-4 pt-8 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] tracking-[0.3em] text-pulse-400">
                TRIAGE CONSOLE · SESSION 2026-02-12 · LOCAL LAB ENVIRONMENT
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold leading-[1.02] tracking-wide text-fog-100 sm:text-5xl xl:text-6xl">
                DEFENSIVE CLOUD
                <br />
                ANALYST<span className="text-signal-400">_</span>
              </h1>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-fog-500">
                Feed it one cloud security alert; get back a schema-strict triage — severity score,
                MITRE ATT&CK mapping, affected resources, and an evidence-first playbook. No
                exploitation guidance, no automatic destructive actions, uncertainty stated openly.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {LEGEND.map(({ sev, score }) => (
                  <span
                    key={sev}
                    className="flex items-center gap-1.5 border border-edge/70 bg-ink-900/60 px-2 py-1"
                  >
                    <span className="h-2 w-2" style={{ background: SEV_COLOR[sev] }} />
                    <span className="font-mono text-[10px] tracking-wider text-fog-300">
                      {sev.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] text-fog-700">{score}</span>
                  </span>
                ))}
              </div>
              <div className="flex gap-6 border-t border-edge/60 pt-2.5">
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-signal-400">
                    {String(stats.open).padStart(2, "0")}
                  </p>
                  <p className="font-mono text-[9.5px] tracking-[0.25em] text-fog-700">OPEN</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-ok-400">
                    {String(stats.triaged).padStart(2, "0")}
                  </p>
                  <p className="font-mono text-[9.5px] tracking-[0.25em] text-fog-700">TRIAGED</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold tabular-nums text-pulse-400">
                    {String(stats.techniques).padStart(2, "0")}
                  </p>
                  <p className="font-mono text-[9.5px] tracking-[0.25em] text-fog-700">
                    TECHNIQUES
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* console grid */}
        <main className="mx-auto mt-7 max-w-[1500px] px-4 sm:px-6">
          <Reveal>
            <div className="grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)_350px]">
              <IntakePanel
                queue={queue}
                activeId={activeId}
                running={view === "running"}
                error={error}
                customText={customText}
                onCustomChange={(v) => {
                  setCustomText(v);
                  setError(null);
                }}
                onAnalyzeSample={analyzeSample}
                onAnalyzeCustom={analyzeCustom}
              />
              <AnalysisPanel
                view={view}
                stages={stages}
                output={output}
                checksKey={activeId ?? "none"}
                checks={checks}
                onToggle={toggleCheck}
                onResetChecks={resetChecks}
              />
              <AttackMatrix
                mappings={output?.result.mitre_attack ?? []}
                resultSeverity={output?.result.severity_assessment ?? null}
                selected={selectedTactic}
                onSelect={setSelectedTactic}
                queue={queue}
              />
            </div>
          </Reveal>
        </main>

        <Roadmap />

        <DeployGuide />

        {/* footer */}
        <footer className="mx-auto mt-14 max-w-[1500px] border-t border-edge/60 px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <IconShield size={18} className="text-pulse-400" />
              <p className="max-w-xl text-[11.5px] leading-relaxed text-fog-700">
                Defensive use only. This console analyzes supplied alerts, prioritizes evidence
                preservation and least privilege, states uncertainty explicitly, and never issues
                exploitation guidance or automatic destructive actions. All payloads are synthetic
                lab data.
              </p>
            </div>
            <div className="text-right font-mono text-[10px] leading-relaxed tracking-wider text-fog-700">
              <p>
                SENTINEL<span className="text-pulse-400">//</span>LAB v0.1 · schema-strict JSON
                contract
              </p>
              <p>press <span className="border border-edge bg-ink-900 px-1.5 py-0.5 text-fog-300">/</span> to focus intake</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
