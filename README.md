# Sentinel//Lab — Defensive AI Cloud Security Analyst Console

`LAB-GRADE` · `schema v1.0` · `defensive-only` · `static + hardenable`

A cloud-alert triage console built as a **training lab**: it ingests cloud security alert JSON
(GuardDuty / Wazuh-shaped payloads), runs a **deterministic fallback analyzer**, and returns a
schema-strict response with severity, MITRE ATT&CK mapping, and an evidence-first playbook —
investigation, containment, remediation, validation, and stated assumptions.

The browser console ships with real deployment artifacts (Docker + Kubernetes) and a CI gate
(secret scanning · Trivy · Checkov · build tests). Everything runs locally; nothing phones home
except Google Fonts.

---

## Scope — what this is and is not

| It is | It is not |
|---|---|
| A deterministic triage engine with an auditable output contract | An autonomous responder |
| A portfolio-grade training lab (synthetic payloads included) | A production SOC service (see [Production gap ledger](#production-gap-ledger)) |
| Evidence-first playbooks: snapshot before isolate, disable-don't-delete | Anything that issues exploitation, evasion, or destructive automation |
| Honest about uncertainty — unknowns are part of the output | A black box; every rule lives in `src/lib/analyzer.ts` |

## Quickstart

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # production bundle → dist/
npm run typecheck  # tsc --noEmit
```

## Analysis contract

`analyze(payload) →` exactly this shape, no more, no less:

```json
{
  "executive_summary": "string",
  "severity_assessment": "Critical | High | Medium | Low | Informational",
  "affected_resources": ["string"],
  "mitre_attack": [{ "tactic": "string", "technique": "string", "reason": "string" }],
  "investigation_steps": ["string"],
  "containment_steps": ["string"],
  "remediation_steps": ["string"],
  "validation_steps": ["string"],
  "assumptions_and_unknowns": ["string"]
}
```

## Deploy

Full runbook is inside the console (`SHIP THE CONSOLE` section). The short version:

```bash
# Single Docker host
docker build -f deploy/Dockerfile -t sentinel-lab:0.1.0 .
docker run -d -p 8443:8080 --read-only \
  --tmpfs /var/cache/nginx --tmpfs /var/run --memory 128m sentinel-lab:0.1.0

# Local Kubernetes cluster (kind / minikube / k3d)
kind load docker-image sentinel-lab:0.1.0 --name sentinel
kubectl apply -f deploy/k8s/sentinel.yaml
kubectl -n sentinel-lab port-forward svc/sentinel-console 8443:80
```

Artifacts: `deploy/Dockerfile` (multi-stage, non-root, unprivileged port, healthcheck),
`deploy/nginx.conf` (CSP tuned to the app's font origins), `deploy/docker-compose.yaml`
(read-only root FS, tmpfs scratch, memory cap, no-new-privileges), `deploy/k8s/sentinel.yaml`
(runAsNonRoot, dropped capabilities, probes, requests/limits).

## Publish to GitHub — one command

```bash
gh auth login
bash scripts/publish.sh sentinel-lab        # private (default)
# flags: --public · --org <name>
```

The publisher reviews staged files with you, **refuses to push** if a `.env`, key, or build
output is staged, then runs `gh repo create … --private --source=. --remote=origin --push`
and confirms the CI jobs armed. Manual path: `git init -b main && git add -A && git commit`
then the same `gh repo create` line.

## CI gates & repo governance

`.github/workflows/ci.yaml` runs on every push/PR (arms on first push):

1. **secrets** — TruffleHog scan of full history
2. **build** — `npm ci` → `typecheck` → `build`, dist uploaded as artifact
3. **image** — builds `deploy/Dockerfile`, Trivy scan (HIGH/CRITICAL fails the gate)
4. **iac** — Checkov + Trivy config scans over `deploy/`

Findings must be fixed or explicitly documented — the gates fail by design.

Governance layer: `.github/dependabot.yml` (weekly npm / actions / docker updates),
`SECURITY.md` (private-advisory reporting), `LICENSE` (MIT), issue + PR templates with a
contract-preservation checklist.

## Pipeline status (recommended learning sequence)

| # | Step | Status | Artifact |
|---|---|---|---|
| 1 | Local API + deterministic fallback analyzer | ✅ live (client-side reference impl) | `src/lib/analyzer.ts` |
| 2 | SQLite / PostgreSQL persistence | ⏭ next (localStorage stand-in today) | — |
| 3 | Security Hub / GuardDuty read-only ingestion | 📋 planned | — |
| 4 | Wazuh alert ingestion | 📋 planned | — |
| 5 | LLM provider via env vars (fallback kept) | 📋 planned | — |
| 6 | React dashboard | ✅ shipped | `src/` |
| 7 | Terraform for secure deployment | 📋 planned | — |
| 8 | CI: secret scanning · Trivy · Checkov · tests | 🔄 shipped, activates on first push | `.github/workflows/ci.yaml` |
| 9 | Alert correlation + ATT&CK dashboards | 🔄 in progress (session rail v0.1) | `src/components/AttackMatrix.tsx` |
| 10 | Document every design decision | ✅ shipped | this README + in-app validation suite |

## Architecture decision records

- **ADR-001 — Deterministic-first.** The analyzer is rules-over-payloads, not a model. Output is
  reproducible byte-for-byte (the in-app validation suite asserts this), auditable line-by-line,
  and safe to run air-gapped. An LLM provider may *augment* later via env vars — never replace —
  the fallback.
- **ADR-002 — Contract over features.** The nine-key JSON schema is the product boundary. UI,
  future API, and future LLM path are all graded against it; extra keys are a contract violation.
- **ADR-003 — Evidence-first, never auto-destructive.** Every analysis opens with evidence
  preservation; containment steps disable and isolate rather than delete; rebuilds happen from
  known-good images only. No step in any generated playbook performs automated destruction —
  asserted by automated posture lint in the validation suite.
- **ADR-004 — Read-only ingestion.** Future feed connections (steps 3–4) must use least-privilege
  read-only roles. The console itself never receives write credentials.
- **ADR-005 — Static console, separate brain.** The shipped container serves bytes only — no
  server-side secrets exist to steal. The LLM backend (step 5) will be a separate workload with
  keys injected via environment / Kubernetes Secrets, never baked into an image.
- **ADR-006 — Local-cluster-first deployment.** kind/minikube + port-forward before any ingress.
  Hardening defaults (non-root, read-only FS, dropped capabilities, CSP) are set at v0.1, not
  retrofitted.

## Production gap ledger

Validated as a training lab; deliberately not a production service. Remaining, mapped to steps:
authN/authZ + TLS, durable storage (2), live read-only ingestion (3–4), LLM backend (5),
Terraform-managed infra (7), image signing/SBOM + Dependabot (8), observability/alerting on the
console itself, default-deny NetworkPolicy before sharing the namespace.

## Security notes

- Create the repo **private** first; review `git status` before any push (no `.env`, no keys).
- Synthetic payloads only — accounts, IPs, and IDs in `src/data/samples.ts` are fictional.
- TruffleHog in CI covers pre-push misses; rotate anything that ever lands in history.

## Validation

The console includes a self-audit suite (`IS THIS A PRODUCTION-LEVEL LAB?`): schema-contract
assertions over all bundled payloads, defensive-posture lint of every generated step, and runtime
fetch-checks of the deployed artifacts' hardening markers. Run it after any change to the
analyzer or deploy files.
