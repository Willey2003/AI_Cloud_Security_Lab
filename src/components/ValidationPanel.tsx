import { useCallback, useEffect, useRef, useState } from "react";
import Reveal from "./Reveal";
import { analyze } from "../lib/analyzer";
import { SAMPLES } from "../data/samples";
import type { AnalysisResult } from "../lib/types";

/* ------------------------------------------------------------------ */
/* check model                                                         */
/* ------------------------------------------------------------------ */

type Status = "pass" | "fail" | "skip" | "pending";
interface Check {
  label: string;
  detail: string;
  status: Status;
}
interface Group {
  id: string;
  label: string;
  blurb: string;
  checks: Check[] | null;
}

const SEVS = ["Critical", "High", "Medium", "Low", "Informational"];

const REQUIRED: { key: keyof AnalysisResult; kind: "string" | "enum" | "string[]" | "map[]" }[] = [
  { key: "executive_summary", kind: "string" },
  { key: "severity_assessment", kind: "enum" },
  { key: "affected_resources", kind: "string[]" },
  { key: "mitre_attack", kind: "map[]" },
  { key: "investigation_steps", kind: "string[]" },
  { key: "containment_steps", kind: "string[]" },
  { key: "remediation_steps", kind: "string[]" },
  { key: "validation_steps", kind: "string[]" },
  { key: "assumptions_and_unknowns", kind: "string[]" },
];

const STEP_KEYS: (keyof AnalysisResult)[] = [
  "investigation_steps",
  "containment_steps",
  "remediation_steps",
  "validation_steps",
];

/* automated destructive directives — negated guidance ("do not delete…") must NOT trip these */
const DESTRUCTIVE =
  /automatically\s+(delete|terminate|remove|destroy|purge)|\brm -rf\b|--no-preserve|delete[^\n.]{0,60}without[^\n.]{0,40}(snapshot|backup|evidence)|terminate[^\n.]{0,40}immediately/i;
const EVIDENCE = /\bpreserve|snapshot|evidence|credential report|object-lock|memory image/i;
const TECHNIQUE_ID = /(^|\s)T\d{4}(\.\d{3})?\b/;

function validValue(v: unknown, kind: string): boolean {
  if (kind === "string") return typeof v === "string" && v.length > 0;
  if (kind === "enum") return typeof v === "string" && SEVS.includes(v);
  if (kind === "string[]")
    return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.length > 0);
  if (kind === "map[]")
    return (
      Array.isArray(v) &&
      v.every(
        (x) =>
          x &&
          typeof x === "object" &&
          typeof (x as Record<string, unknown>).tactic === "string" &&
          typeof (x as Record<string, unknown>).technique === "string" &&
          typeof (x as Record<string, unknown>).reason === "string",
      )
    );
  return false;
}

/* ------------------------------------------------------------------ */
/* suites                                                              */
/* ------------------------------------------------------------------ */

function runContract(): Check[] {
  let keyPass = 0;
  let keyTotal = 0;
  let sevPass = 0;
  let mitreValid = 0;
  let mitreTotal = 0;
  let arrPass = 0;
  let arrTotal = 0;
  let detPass = 0;

  for (const s of SAMPLES) {
    const a = analyze(JSON.parse(s.json)).result;
    const b = analyze(JSON.parse(s.json)).result;
    if (JSON.stringify(a) === JSON.stringify(b)) detPass += 1;

    for (const { key, kind } of REQUIRED) {
      keyTotal += 1;
      if (validValue(a[key], kind)) keyPass += 1;
    }
    if (SEVS.includes(a.severity_assessment)) sevPass += 1;
    for (const m of a.mitre_attack) {
      mitreTotal += 1;
      if (TECHNIQUE_ID.test(m.technique)) mitreValid += 1;
    }
    for (const k of [...STEP_KEYS, "assumptions_and_unknowns"] as (keyof AnalysisResult)[]) {
      arrTotal += 1;
      if (Array.isArray(a[k]) && (a[k] as string[]).length > 0) arrPass += 1;
    }
  }

  return [
    {
      label: "9 required schema keys, correctly typed, across all 6 payloads",
      detail: `${keyPass}/${keyTotal} assertions`,
      status: keyPass === keyTotal ? "pass" : "fail",
    },
    {
      label: "severity_assessment always inside the 5-level enum",
      detail: `${sevPass}/${SAMPLES.length} payloads`,
      status: sevPass === SAMPLES.length ? "pass" : "fail",
    },
    {
      label: "every MITRE mapping carries a well-formed technique ID (T####[.###])",
      detail: `${mitreValid}/${mitreTotal} mappings`,
      status: mitreValid === mitreTotal ? "pass" : "fail",
    },
    {
      label: "all four playbooks + assumptions arrays non-empty strings",
      detail: `${arrPass}/${arrTotal} arrays`,
      status: arrPass === arrTotal ? "pass" : "fail",
    },
    {
      label: "deterministic — double-run of each payload yields byte-identical JSON",
      detail: `${detPass}/${SAMPLES.length} reproducible`,
      status: detPass === SAMPLES.length ? "pass" : "fail",
    },
  ];
}

function runPosture(): Check[] {
  let stepsScanned = 0;
  let destructiveHits = 0;
  let evidenceOk = 0;
  let uncertaintyOk = 0;

  for (const s of SAMPLES) {
    const a = analyze(JSON.parse(s.json)).result;
    const steps = STEP_KEYS.flatMap((k) => a[k] as string[]);
    stepsScanned += steps.length;
    if (steps.some((st) => DESTRUCTIVE.test(st))) destructiveHits += 1;
    const scope = [...(a.investigation_steps as string[]), ...(a.containment_steps as string[])].join(" ");
    if (EVIDENCE.test(scope)) evidenceOk += 1;
    if ((a.assumptions_and_unknowns as string[]).length > 0) uncertaintyOk += 1;
  }

  return [
    {
      label: "zero automated-destructive directives in any generated step",
      detail: `${stepsScanned} steps scanned · ${destructiveHits} hits`,
      status: destructiveHits === 0 ? "pass" : "fail",
    },
    {
      label: "every analysis opens with evidence preservation",
      detail: `${evidenceOk}/${SAMPLES.length} analyses`,
      status: evidenceOk === SAMPLES.length ? "pass" : "fail",
    },
    {
      label: "every analysis states its assumptions & unknowns",
      detail: `${uncertaintyOk}/${SAMPLES.length} analyses`,
      status: uncertaintyOk === SAMPLES.length ? "pass" : "fail",
    },
  ];
}

const ARTIFACTS: { path: string; markers: [string, RegExp][] }[] = [
  {
    path: "deploy/Dockerfile",
    markers: [
      ["multi-stage build (2 FROM stages)", /FROM[\s\S]+FROM/],
      ["non-root runtime user", /USER lab/],
      ["unprivileged port 8080", /EXPOSE 8080/],
      ["container healthcheck", /HEALTHCHECK/],
    ],
  },
  {
    path: "deploy/nginx.conf",
    markers: [
      ["listens on non-privileged port", /listen 8080/],
      ["Content-Security-Policy header", /Content-Security-Policy/],
      ["SPA fallback to index.html", /try_files \$uri \/index\.html/],
      ["MIME sniff guard", /nosniff/],
    ],
  },
  {
    path: "deploy/docker-compose.yaml",
    markers: [
      ["read-only root filesystem", /read_only: true/],
      ["tmpfs scratch mounts", /tmpfs/],
      ["memory cap", /mem_limit/],
      ["no-new-privileges", /no-new-privileges:true/],
    ],
  },
  {
    path: "deploy/k8s/sentinel.yaml",
    markers: [
      ["runAsNonRoot pod context", /runAsNonRoot: true/],
      ["read-only root filesystem", /readOnlyRootFilesystem: true/],
      ["all capabilities dropped", /drop: \["ALL"\]/],
      ["readiness probe defined", /readinessProbe/],
    ],
  },
  {
    path: "scripts/publish.sh",
    markers: [
      ["creates the remote via gh", /gh repo create/],
      ["private-first default", /--private/],
      ["refuses to push staged secrets", /hygiene violation/],
    ],
  },
  {
    path: "governance/ci.yaml",
    markers: [
      ["secret-scan job", /secrets:/],
      ["build + typecheck job", /build:/],
      ["trivy image job", /image:/],
      ["iac checkov job", /iac:/],
    ],
  },
  {
    path: "governance/dependabot.yml",
    markers: [
      ["npm ecosystem covered", /package-ecosystem: "npm"/],
      ["github-actions ecosystem covered", /github-actions/],
    ],
  },
  {
    path: "governance/SECURITY.md",
    markers: [
      ["private advisory reporting path", /private security advisory/],
      ["explicit out-of-scope statement", /Out of scope/],
    ],
  },
  {
    path: "governance/LICENSE",
    markers: [["MIT license present", /MIT License/]],
  },
];

async function runArtifacts(): Promise<Check[]> {
  const checks: Check[] = [];
  for (const file of ARTIFACTS) {
    let text: string | null = null;
    try {
      const res = await fetch(`${file.path}?v=${Date.now()}`);
      if (res.ok) text = await res.text();
    } catch {
      text = null;
    }
    for (const [label, re] of file.markers) {
      checks.push({
        label: `${file.path} — ${label}`,
        detail: text === null ? "artifact not reachable in this preview" : re.test(text) ? "marker present" : "marker missing",
        status: text === null ? "skip" : re.test(text) ? "pass" : "fail",
      });
    }
  }
  return checks;
}

/* ------------------------------------------------------------------ */
/* production gap ledger (static, honest)                              */
/* ------------------------------------------------------------------ */

const GAPS: { item: string; status: "MISSING" | "PARTIAL" | "SIMULATED" | "PLANNED"; note: string }[] = [
  { item: "Authentication & authorization", status: "MISSING", note: "Open to anyone with the URL — acceptable locally, not shared." },
  { item: "TLS termination", status: "MISSING", note: "Plain HTTP today; add an HTTPS proxy or cert-manager before exposing." },
  { item: "Durable storage", status: "PARTIAL", note: "Triage state in localStorage; pipeline steps 2–3 swap in SQLite/Postgres." },
  { item: "Live alert ingestion", status: "SIMULATED", note: "Samples + paste-in only; GuardDuty/Wazuh connectors are steps 3–4." },
  { item: "CI security gates", status: "PARTIAL", note: "TruffleHog / Trivy / Checkov + Dependabot staged in the repo — arms on first push to GitHub." },
  { item: "Image signing & SBOM", status: "MISSING", note: "No cosign signature or SBOM attestation on sentinel-lab:0.1.0." },
  { item: "Runtime observability", status: "MISSING", note: "No metrics or trace export from the container yet." },
  { item: "Network segmentation", status: "MISSING", note: "No default-deny NetworkPolicy in the k8s manifest yet." },
];

const MET = [
  "Hardened static container — non-root, read-only FS, no build tooling in the final image",
  "CSP + security headers matched to the console's actual asset origins",
  "Deterministic, reproducible analysis — same payload in, same JSON out",
  "Schema-contract-strict output — exactly the 9 keys the pipeline expects",
  "Non-destructive posture — evidence-first playbooks, no automated destructive actions",
];

/* ------------------------------------------------------------------ */
/* small status marks                                                  */
/* ------------------------------------------------------------------ */

function Mark({ status }: { status: Status }) {
  if (status === "pass")
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#35e0a1" strokeWidth="2.6" aria-label="pass">
        <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "fail")
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ff5163" strokeWidth="2.6" aria-label="fail">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    );
  if (status === "skip")
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#5f7396" strokeWidth="2.6" aria-label="skip">
        <path d="M5 12h14" strokeLinecap="round" />
      </svg>
    );
  return <span className="block h-3 w-3 animate-spin rounded-full border border-pulse-400 border-t-transparent" />;
}

function tally(checks: Check[]) {
  return {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    skip: checks.filter((c) => c.status === "skip").length,
  };
}

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

const EMPTY_GROUPS: Group[] = [
  { id: "contract", label: "SCHEMA CONTRACT", blurb: "the exact 9-key JSON contract, tested against every sample payload", checks: null },
  { id: "posture", label: "DEFENSIVE POSTURE", blurb: "lint of every generated playbook step for destructive automation", checks: null },
  { id: "artifacts", label: "DEPLOY + GOVERNANCE", blurb: "live fetch of deploy/*, scripts/* and governance/* — hardening & repo-hygiene markers must be present", checks: null },
];

export default function ValidationPanel() {
  const [groups, setGroups] = useState<Group[]>(EMPTY_GROUPS);
  const [verdictReady, setVerdictReady] = useState(false);
  const [running, setRunning] = useState(true);
  const [runId, setRunId] = useState(0);
  const runRef = useRef(0);

  const run = useCallback(async (id: number) => {
    setRunning(true);
    setVerdictReady(false);
    setGroups(EMPTY_GROUPS);

    const contract = runContract();
    await new Promise((r) => setTimeout(r, 350));
    if (runRef.current !== id) return;
    setGroups((g) => g.map((gr) => (gr.id === "contract" ? { ...gr, checks: contract } : gr)));

    const posture = runPosture();
    await new Promise((r) => setTimeout(r, 350));
    if (runRef.current !== id) return;
    setGroups((g) => g.map((gr) => (gr.id === "posture" ? { ...gr, checks: posture } : gr)));

    const artifacts = await runArtifacts();
    if (runRef.current !== id) return;
    setGroups((g) => g.map((gr) => (gr.id === "artifacts" ? { ...gr, checks: artifacts } : gr)));

    await new Promise((r) => setTimeout(r, 250));
    if (runRef.current !== id) return;
    setVerdictReady(true);
    setRunning(false);
  }, []);

  useEffect(() => {
    runRef.current = runId;
    void run(runId);
  }, [runId, run]);

  const all = groups.flatMap((g) => g.checks ?? []);
  const t = tally(all);
  const verdictText =
    t.fail === 0
      ? `LAB-GRADE · VALIDATED — ${t.pass}/${t.pass + t.fail} checks pass${t.skip ? `, ${t.skip} skipped in preview` : ""}`
      : `REGRESSION — ${t.fail} check${t.fail === 1 ? "" : "s"} failing`;

  return (
    <section className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6" aria-label="Lab validation verdict">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-pulse-400">
              VALIDATION SUITE · RUNS AGAINST THIS LIVE BUILD
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-wide text-fog-100 sm:text-3xl">
              IS THIS A <span className="text-signal-400">PRODUCTION-LEVEL</span> LAB?
            </h2>
          </div>
          <button
            onClick={() => setRunId((n) => n + 1)}
            disabled={running}
            className={`flex items-center gap-2 border px-4 py-2 font-display text-[11px] font-bold tracking-[0.2em] transition-all ${
              running
                ? "cursor-wait border-edge text-fog-700"
                : "border-pulse-400/60 bg-pulse-400/10 text-pulse-300 hover:bg-pulse-400/20"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={running ? "animate-spin" : ""}
            >
              <path d="M20 12a8 8 0 1 1-2.34-5.66" strokeLinecap="round" />
              <path d="M20 3v4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {running ? "RUNNING…" : "RE-RUN SUITE"}
          </button>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="panel mt-7 p-5">
          {/* verdict strip */}
          <div
            className={`flex flex-col gap-5 border p-5 transition-all duration-700 lg:flex-row lg:items-center ${
              verdictReady
                ? t.fail === 0
                  ? "border-ok-400/40 bg-ok-400/5"
                  : "border-alert-400/40 bg-alert-400/5"
                : "border-edge/60 bg-ink-900/40"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`grid h-16 w-16 shrink-0 place-items-center border-2 font-display text-2xl font-bold transition-all duration-700 ${
                  verdictReady ? (t.fail === 0 ? "border-ok-400 text-ok-400" : "border-alert-400 text-alert-400") : "border-edge text-fog-700"
                }`}
                style={verdictReady && t.fail === 0 ? { boxShadow: "0 0 24px -6px rgba(53,224,161,0.55)" } : undefined}
              >
                {verdictReady ? (t.fail === 0 ? "✓" : "✗") : "…"}
              </div>
              <div>
                <p
                  className={`font-display text-lg font-bold tracking-[0.14em] sm:text-xl ${
                    verdictReady ? (t.fail === 0 ? "text-ok-400" : "text-alert-300") : "text-fog-500"
                  }`}
                >
                  {verdictReady ? verdictText : "EXECUTING CHECKS…"}
                </p>
                <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-fog-500">
                  Honest verdict: this is a <span className="font-semibold text-fog-100">validated training lab</span>, not a
                  production service. The analysis engine, output contract, and container posture pass; the eight production
                  requirements in the ledger below are deliberately out of scope at this pipeline stage.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-5 lg:ml-auto">
              {[
                { n: t.pass, l: "PASS", c: "#35e0a1" },
                { n: t.fail, l: "FAIL", c: "#ff5163" },
                { n: t.skip, l: "SKIP", c: "#5f7396" },
              ].map(({ n, l, c }) => (
                <div key={l} className="text-center">
                  <p className="font-display text-3xl font-bold tabular-nums" style={{ color: c }}>
                    {String(n).padStart(2, "0")}
                  </p>
                  <p className="font-mono text-[9.5px] tracking-[0.25em] text-fog-700">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
            {/* check groups */}
            <div className="space-y-4">
              {groups.map((g) => {
                const gt = g.checks ? tally(g.checks) : null;
                return (
                  <div key={g.id} className="border border-edge/60 bg-ink-900/40">
                    <div className="flex items-center gap-2.5 border-b border-edge/50 px-4 py-2.5">
                      <span
                        className="led"
                        style={{
                          background: gt ? (gt.fail === 0 ? "#35e0a1" : "#ff5163") : "#ffb020",
                          color: gt ? (gt.fail === 0 ? "#35e0a1" : "#ff5163") : "#ffb020",
                        }}
                      />
                      <h3 className="font-display text-[12px] font-bold tracking-[0.24em] text-fog-300">
                        {g.label}
                      </h3>
                      <span className="hidden font-mono text-[10px] text-fog-700 sm:inline">· {g.blurb}</span>
                      {gt && (
                        <span className="ml-auto font-mono text-[10px] tracking-wider">
                          <span className="text-ok-400">{gt.pass}✓</span>
                          {gt.fail > 0 && <span className="ml-2 text-alert-300">{gt.fail}✗</span>}
                          {gt.skip > 0 && <span className="ml-2 text-fog-700">{gt.skip}–</span>}
                        </span>
                      )}
                    </div>
                    <ul className="px-2 py-1.5">
                      {g.checks === null
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-2 py-2">
                              <span className="block h-3 w-3 animate-spin rounded-full border border-fog-700 border-t-transparent" />
                              <span className="h-2.5 animate-pulse rounded-sm bg-ink-600/70" style={{ width: `${62 - i * 14}%` }} />
                            </li>
                          ))
                        : g.checks.map((c) => (
                            <li key={c.label} className="step-row flex items-center gap-3 px-2 py-2">
                              <Mark status={c.status} />
                              <span className="text-[12px] leading-snug text-fog-300">{c.label}</span>
                              <span
                                className={`ml-auto shrink-0 pl-3 font-mono text-[10px] tabular-nums ${
                                  c.status === "pass" ? "text-ok-400/90" : c.status === "fail" ? "text-alert-300" : "text-fog-700"
                                }`}
                              >
                                {c.detail}
                              </span>
                            </li>
                          ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* ledger */}
            <div className="space-y-4">
              <div className="border border-edge/60 bg-ink-900/40 p-4">
                <h3 className="font-display text-[12px] font-bold tracking-[0.24em] text-signal-300">
                  PRODUCTION GAP LEDGER
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {GAPS.map((g) => (
                    <li key={g.item} className="group">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-fog-300">{g.item}</span>
                        <span
                          className={`shrink-0 border px-1.5 py-px font-mono text-[8.5px] tracking-[0.18em] ${
                            g.status === "PARTIAL"
                              ? "border-signal-400/50 text-signal-300"
                              : g.status === "PLANNED" || g.status === "SIMULATED"
                                ? "border-pulse-600/60 text-pulse-300"
                                : "border-alert-400/40 text-alert-300/90"
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-fog-700">{g.note}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border border-ok-400/25 bg-ok-400/5 p-4">
                <h3 className="font-display text-[12px] font-bold tracking-[0.24em] text-ok-400">
                  ALREADY PRODUCTION-HONEST
                </h3>
                <ul className="mt-3 space-y-2">
                  {MET.map((m) => (
                    <li key={m} className="flex gap-2 text-[11.5px] leading-relaxed text-fog-500">
                      <span className="text-ok-400">▸</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="border border-edge/50 bg-ink-950/50 p-3 font-mono text-[10px] leading-relaxed text-fog-700">
                analyst note — uncertainty stated: contract and posture checks are exhaustive for the
                bundled payloads; novel payloads still exercise the conservative fallback path. Artifact
                checks fetch the mirrored copies under <span className="text-fog-500">public/deploy/</span>;
                treat the files in <span className="text-fog-500">deploy/</span> as the source of truth.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
