# Security Policy — Sentinel//Lab

This is a **training lab**, not a production service. Security is treated seriously anyway:
the whole point of the project is to model defensive practice.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ (lab-grade, active) |

## Reporting a vulnerability

1. **Do not open a public issue.**
2. Use the repository's **private security advisory** (Security tab → Advisories → Report),
   or contact the maintainer directly if that is disabled.
3. Include: steps to reproduce, affected component (`src/`, `deploy/`, CI), and impact.
4. Expect an initial response within 7 days and a remediation target within 30.

## Scope

**In scope:** the analyzer, the console, the deploy artifacts, and the CI gates.
**Out of scope:** anything requiring credentials to real cloud accounts, or testing against
infrastructure you do not own. All bundled payloads in `src/data/samples.ts` are synthetic.

## Posture summary

- Non-root containers, read-only root filesystem, dropped capabilities, unprivileged ports
- CSP + anti-sniff headers on every response
- TruffleHog (secrets), Trivy (image + config), and Checkov (IaC) gates in CI
- Dependabot enabled for npm, GitHub Actions, and Docker base images
- No secrets in the repo, ever — the console is static and serves bytes only
