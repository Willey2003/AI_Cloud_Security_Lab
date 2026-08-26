import Reveal from "./Reveal";
import {
  IconCloud,
  IconDb,
  IconDoc,
  IconGit,
  IconLink,
  IconLock,
  IconPulse,
  IconRoute,
  IconTerminal,
} from "./icons";

type Status = "SHIPPED" | "LIVE" | "NEXT" | "IN PROGRESS" | "PLANNED" | "ONGOING";

const STATUS_STYLE: Record<Status, { color: string; label: string }> = {
  SHIPPED: { color: "#35e0a1", label: "SHIPPED" },
  LIVE: { color: "#39d7e6", label: "LIVE · THIS CONSOLE" },
  "IN PROGRESS": { color: "#7ce7f2", label: "IN PROGRESS" },
  NEXT: { color: "#ffb020", label: "NEXT" },
  PLANNED: { color: "#8ca0c3", label: "PLANNED" },
  ONGOING: { color: "#b9c8e4", label: "ONGOING" },
};

const STEPS: { icon: typeof IconTerminal; title: string; note: string; status: Status }[] = [
  {
    icon: IconTerminal,
    title: "Local API + deterministic fallback analyzer",
    note: "Schema-strict triage engine — running client-side in this console as the reference implementation.",
    status: "LIVE",
  },
  {
    icon: IconDb,
    title: "SQLite / PostgreSQL persistence",
    note: "Durable alert + analysis store. This demo stands in with localStorage for triage state.",
    status: "NEXT",
  },
  {
    icon: IconCloud,
    title: "Security Hub / GuardDuty read-only ingestion",
    note: "Pull findings via least-privilege, read-only IAM role. No write access to the production account.",
    status: "PLANNED",
  },
  {
    icon: IconPulse,
    title: "Wazuh alert ingestion",
    note: "Consume Wazuh manager events (rules 5503/5712 family) into the same schema pipeline.",
    status: "PLANNED",
  },
  {
    icon: IconLock,
    title: "LLM provider via env vars + fallback kept",
    note: "Model calls configured by environment; the deterministic analyzer stays as the audited fallback.",
    status: "PLANNED",
  },
  {
    icon: IconRoute,
    title: "React dashboard",
    note: "Triage console, ATT&CK rail, playbooks — you are looking at it right now.",
    status: "SHIPPED",
  },
  {
    icon: IconLock,
    title: "Terraform for secure deployment",
    note: "Immutable infra: locked-down buckets, KMS, VPC endpoints, explicit deny-by-default policies.",
    status: "PLANNED",
  },
  {
    icon: IconGit,
    title: "CI: secret scanning · Trivy · Checkov · tests",
    note: "Workflow shipped at .github/workflows/ci.yaml — four gates arm on the first push.",
    status: "IN PROGRESS",
  },
  {
    icon: IconLink,
    title: "Alert correlation + ATT&CK dashboards",
    note: "Cross-source correlation and coverage heat — the rail above is v0.1 of this step.",
    status: "IN PROGRESS",
  },
  {
    icon: IconDoc,
    title: "Document every design decision",
    note: "README now carries six ADRs — deterministic-first, contract-boundary, evidence-first, read-only ingest, static console, local-cluster posture.",
    status: "SHIPPED",
  },
];

export default function Roadmap() {
  return (
    <section className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6" aria-label="Lab build pipeline">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-pulse-400">
              LAB BUILD PIPELINE · AWS + WAZUH + TERRAFORM + PYTHON
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-wide text-fog-100 sm:text-3xl">
              FROM LOCAL API TO CORRELATED DETECTIONS
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {(["SHIPPED", "LIVE", "NEXT", "IN PROGRESS", "PLANNED"] as Status[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-fog-500">
                <span className="h-2 w-2" style={{ background: STATUS_STYLE[s].color }} />
                {s}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="relative mt-8 overflow-x-auto pb-4">
          <div className="dashline absolute left-0 right-0 top-[26px] h-[2px] opacity-50" />
          <ol className="flex min-w-max gap-4 pr-4">
            {STEPS.map((step, i) => {
              const st = STATUS_STYLE[step.status];
              const Icon = step.icon;
              return (
                <li key={step.title} className="group w-[248px] shrink-0">
                  <div className="relative z-10 mb-3 grid h-[52px] w-[52px] place-items-center border border-edge bg-ink-900 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-pulse-400/60 group-hover:shadow-[0_10px_28px_-10px_rgba(57,215,230,0.45)]">
                    <Icon size={20} className="text-pulse-400" />
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center border border-edge bg-ink-950 font-mono text-[10px] font-bold text-fog-300">
                      {i + 1}
                    </span>
                  </div>
                  <p
                    className="font-mono text-[9.5px] font-semibold tracking-[0.2em]"
                    style={{ color: st.color }}
                  >
                    {st.label}
                  </p>
                  <h3 className="mt-1 font-display text-[14px] font-semibold leading-snug text-fog-100">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog-500">{step.note}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </Reveal>
    </section>
  );
}
