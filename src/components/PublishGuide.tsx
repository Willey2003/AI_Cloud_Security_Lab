import Reveal from "./Reveal";
import { Term } from "./DeployGuide";

const STAGED_FILES = [
  { file: "README.md", note: "overview · contract · deploy · 6 ADRs — pipeline step 10" },
  { file: ".github/workflows/ci.yaml", note: "TruffleHog · build · Trivy · Checkov — step 8" },
  { file: ".github/dependabot.yml", note: "weekly updates: npm · actions · docker base images" },
  { file: "SECURITY.md", note: "private-advisory reporting path + posture summary" },
  { file: "LICENSE", note: "MIT" },
  { file: "scripts/publish.sh", note: "one-command publisher — refuses to push staged secrets" },
  { file: ".gitignore", note: "keeps node_modules, dist, .env out of history" },
  { file: ".dockerignore", note: "keeps the image build context lean" },
];

const PUBLISH_SH = `# init + hygiene review (aborts on staged .env/keys/build output)
git init -b main && git status --porcelain   # you confirm before push
git add -A && git commit -m "sentinel-lab v0.1 …"

# create remote + push — private-first
gh repo create "$REPO" --private --source=. --remote=origin --push

# confirm the four CI jobs armed
gh run list --limit 4`;

const CI_YAML = `name: ci
on: [push, pull_request]
permissions: { contents: read }

jobs:
  secrets:
    # trufflesecurity/trufflehog — full-history scan, --only-verified
  build:
    # npm ci → npm run typecheck → npm run build → artifact: dist/
  image:
    # docker build deploy/Dockerfile (buildx + gha cache)
    # aquasecurity/trivy-action · severity HIGH,CRITICAL · exit-code 1
  iac:
    # bridgecrewio/checkov-action + trivy config scan over deploy/`;

function PublishFlow() {
  const nodes = [
    { label: "YOUR MACHINE", sub: "staged repo", x: 8, w: 170 },
    { label: "GIT PUSH", sub: "ssh / gh cli", x: 236, w: 150 },
    { label: "CI GATES", sub: "secrets · build · trivy · checkov", x: 444, w: 250 },
    { label: "MAIN ✓", sub: "branch protected", x: 752, w: 80 },
  ];
  return (
    <svg viewBox="0 0 840 92" className="mt-6 w-full" aria-hidden>
      {nodes.slice(0, -1).map((n, i) => {
        const next = nodes[i + 1];
        return (
          <line
            key={n.label}
            x1={n.x + n.w}
            y1={46}
            x2={next.x}
            y2={46}
            stroke="#39d7e6"
            strokeWidth="1.5"
            strokeOpacity="0.85"
            className="flowline"
          />
        );
      })}
      {nodes.map((n) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y="18"
            width={n.w}
            height="56"
            fill="rgba(14,26,46,0.9)"
            stroke="#39d7e6"
            strokeOpacity="0.7"
          />
          <text
            x={n.x + 12}
            y="41"
            className="fill-[#e8effa]"
            style={{ font: "700 11px 'Chakra Petch', sans-serif", letterSpacing: "0.12em" }}
          >
            {n.label}
          </text>
          <text
            x={n.x + 12}
            y="58"
            style={{ font: "500 9px 'IBM Plex Mono', monospace", fill: "#7ce7f2" }}
          >
            {n.sub}
          </text>
        </g>
      ))}
      <text
        x="8"
        y="10"
        style={{ font: "500 9px 'IBM Plex Mono', monospace", fill: "#5f7396", letterSpacing: "0.25em" }}
      >
        PUBLISH FLOW · GATES ARM ON FIRST PUSH
      </text>
    </svg>
  );
}

export default function PublishGuide() {
  return (
    <section
      className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6"
      aria-label="Publish to GitHub"
    >
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-pulse-400">
              PUBLISH RUNBOOK · STAGED REPO → GITHUB
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-wide text-fog-100 sm:text-3xl">
              PUSH THE LAB <span className="text-pulse-400">UPSTREAM</span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[10px] text-fog-500">
            {STAGED_FILES.map((f) => (
              <span
                key={f.file}
                title={f.note}
                className="cursor-help border border-edge bg-ink-900/60 px-2 py-1 transition-colors hover:border-pulse-400/50 hover:text-pulse-300"
              >
                {f.file}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="panel mt-7 p-5">
          <PublishFlow />

          <div className="mt-6 flex gap-3 border border-signal-400/30 bg-signal-400/5 p-4">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#ffb020"
              strokeWidth="1.8"
              className="mt-0.5 shrink-0"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5" strokeLinecap="round" />
              <circle cx="12" cy="16.4" r="0.4" fill="#ffb020" />
            </svg>
            <p className="text-[12px] leading-relaxed text-fog-500">
              <span className="font-semibold text-signal-300">Sandbox limit, stated plainly:</span>{" "}
              this environment has no git remote and no credentials, so the push itself cannot
              execute here — claiming otherwise would invent a fact. The repo is{" "}
              <em className="not-italic text-fog-300">fully staged</em> — README + ADRs, CI gates,
              Dependabot, security policy, license, and a publisher script that creates the GitHub
              repo and pushes in one command. Step 01 below is that command.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="group border border-edge/60 bg-ink-900/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-pulse-400/40 hover:shadow-[0_14px_36px_-18px_rgba(57,215,230,0.35)]">
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-display text-2xl font-bold tabular-nums text-pulse-400/80">01</span>
                <h3 className="font-display text-[14px] font-semibold tracking-wide text-fog-100">
                  ONE COMMAND — <span className="text-pulse-300">scripts/publish.sh</span>
                </h3>
              </div>
              <p className="mb-3 text-[11.5px] leading-relaxed text-fog-500">
                The staged publisher does init → hygiene review → commit →{" "}
                <span className="font-mono text-pulse-300">gh repo create</span> → push → CI
                confirmation. It <span className="text-signal-300">refuses to push</span> if a{" "}
                <span className="font-mono">.env</span>, key, or build output is staged. Flags:{" "}
                <span className="text-signal-300">--public</span>,{" "}
                <span className="text-signal-300">--org &lt;name&gt;</span>; private is the default.
              </p>
              <div className="space-y-3">
                <Term
                  id="pub-1a"
                  label="shell"
                  code={`$ gh auth login            # once\n$ bash scripts/publish.sh sentinel-lab\n# reviews staged files with you, then creates + pushes the repo`}
                />
                <Term id="pub-1b" label="scripts/publish.sh · flow" code={PUBLISH_SH} />
              </div>
            </div>

            <div className="group border border-edge/60 bg-ink-900/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-pulse-400/40 hover:shadow-[0_14px_36px_-18px_rgba(57,215,230,0.35)]">
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-display text-2xl font-bold tabular-nums text-pulse-400/80">02</span>
                <h3 className="font-display text-[14px] font-semibold tracking-wide text-fog-100">
                  MANUAL PATH — STAGE &amp; PUSH
                </h3>
              </div>
              <p className="mb-3 text-[11.5px] leading-relaxed text-fog-500">
                Prefer hands on the wheel? Same outcome in five commands. The{" "}
                <span className="font-mono">git status</span> review is the last line of defense
                against committing a secret — <span className="text-signal-300">private-first</span>{" "}
                keeps lab data off public search.
              </p>
              <div className="space-y-3">
                <Term
                  id="pub-2a"
                  label="shell"
                  code={`$ git init -b main\n$ git add -A\n$ git status          # confirm: no .env, no *.key, no node_modules/, no dist/\n$ git commit -m "sentinel-lab: defensive triage console, deploy artifacts, CI gates"`}
                />
                <Term
                  id="pub-2b"
                  label="shell · create + push"
                  code={`$ gh repo create sentinel-lab --private --source=. --remote=origin --push\n# without gh: git remote add origin git@github.com:YOU/sentinel-lab.git && git push -u origin main`}
                />
              </div>
            </div>

            <div className="group border border-edge/60 bg-ink-900/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-pulse-400/40 hover:shadow-[0_14px_36px_-18px_rgba(57,215,230,0.35)]">
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-display text-2xl font-bold tabular-nums text-pulse-400/80">03</span>
                <h3 className="font-display text-[14px] font-semibold tracking-wide text-fog-100">
                  CI GATES ARM ON FIRST PUSH
                </h3>
              </div>
              <p className="mb-3 text-[11.5px] leading-relaxed text-fog-500">
                Four jobs run on every push and PR (pipeline step 8). HIGH/CRITICAL findings and
                verified secrets fail the build — fix or document, never silence.
              </p>
              <Term id="pub-3" label=".github/workflows/ci.yaml · map" code={CI_YAML} />
            </div>

            <div className="group border border-edge/60 bg-ink-900/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-pulse-400/40 hover:shadow-[0_14px_36px_-18px_rgba(57,215,230,0.35)]">
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-display text-2xl font-bold tabular-nums text-pulse-400/80">04</span>
                <h3 className="font-display text-[14px] font-semibold tracking-wide text-fog-100">
                  PROTECT THE BRANCH
                </h3>
              </div>
              <p className="mb-3 text-[11.5px] leading-relaxed text-fog-500">
                Settings → Branches → add a rule for{" "}
                <span className="font-mono text-pulse-300">main</span>: require PR review + require
                the four status checks to pass. Then enable Dependabot alerts:
              </p>
              <Term
                id="pub-4"
                label="shell"
                code={`$ gh api repos/YOUR-USER/sentinel-lab/vulnerability-alerts -X PUT
# public repos get GitHub secret scanning free; on private repos the
# TruffleHog job above is your CI-side coverage unless your plan adds GHAS`}
              />
            </div>
          </div>

          <p className="mt-5 font-mono text-[10px] leading-relaxed tracking-wider text-fog-700">
            POST-PUBLISH CHECK · open the Actions tab → all four jobs green → then run{" "}
            <span className="text-pulse-300">npm run build</span> locally one more time; the
            in-app validation suite below re-audits the staged artifacts on every load.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
