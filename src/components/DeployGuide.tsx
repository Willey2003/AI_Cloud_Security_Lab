import { useState } from "react";
import Reveal from "./Reveal";
import { IconCopy } from "./icons";

type Block = { label: string; code: string };
type Step = { title: string; note?: string; blocks: Block[] };
type TabId = "docker" | "k8s";

const DOCKERFILE = `# Stage 1 — build the static console
FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — locked-down nginx, non-root
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
RUN addgroup -S lab && adduser -S lab -G lab \\
 && chown -R lab:lab /usr/share/nginx/html /var/cache/nginx /var/run
USER lab
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \\
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1`;

const COMPOSE = `services:
  console:
    build: { context: .., dockerfile: deploy/Dockerfile }
    image: sentinel-lab:0.1.0
    ports: ["8443:8080"]
    read_only: true
    tmpfs: [/var/cache/nginx, /var/run]
    mem_limit: 128m
    restart: unless-stopped
    security_opt: [no-new-privileges:true]`;

const K8S_YAML = `apiVersion: v1
kind: Namespace
metadata: { name: sentinel-lab }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sentinel-console
  namespace: sentinel-lab
spec:
  replicas: 2
  selector: { matchLabels: { app: sentinel-console } }
  template:
    metadata: { labels: { app: sentinel-console } }
    spec:
      securityContext: { runAsNonRoot: true }
      containers:
        - name: console
          image: sentinel-lab:0.1.0
          imagePullPolicy: IfNotPresent
          ports: [{ containerPort: 8080 }]
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
          resources:
            requests: { cpu: 20m, memory: 32Mi }
            limits:   { cpu: 200m, memory: 96Mi }
          readinessProbe: { httpGet: { path: /, port: 8080 } }
          volumeMounts:
            - { name: nginx-cache, mountPath: /var/cache/nginx }
            - { name: nginx-run,   mountPath: /var/run }
      volumes:
        - { name: nginx-cache, emptyDir: {} }
        - { name: nginx-run,   emptyDir: {} }
---
apiVersion: v1
kind: Service
metadata: { name: sentinel-console, namespace: sentinel-lab }
spec:
  selector: { app: sentinel-console }
  ports: [{ port: 80, targetPort: 8080 }]`;

const DOCKER_STEPS: Step[] = [
  {
    title: "Build the hardened image",
    note: "Multi-stage: Node builds dist/, nginx serves it as user lab — no shell, no root, no build tooling in the final layer.",
    blocks: [
      {
        label: "deploy/Dockerfile",
        code: DOCKERFILE,
      },
      {
        label: "shell",
        code: `$ docker build -f deploy/Dockerfile -t sentinel-lab:0.1.0 .
$ docker image ls sentinel-lab
# final image ≈ 50 MB · no node_modules, no sources`,
      },
    ],
  },
  {
    title: "Run on a single host",
    note: "Read-only root filesystem with tmpfs for nginx scratch paths; memory-capped so a lab box stays predictable.",
    blocks: [
      {
        label: "shell",
        code: `$ docker run -d --name sentinel-lab -p 8443:8080 \\
    --read-only --tmpfs /var/cache/nginx --tmpfs /var/run \\
    --memory 128m sentinel-lab:0.1.0

$ curl -fsS http://localhost:8443 | head -3
# <!doctype html>  →  console is up`,
      },
    ],
  },
  {
    title: "Or: docker compose",
    note: "Same posture, declarative. Run from the repo root so the build context resolves.",
    blocks: [
      { label: "deploy/docker-compose.yaml", code: COMPOSE },
      {
        label: "shell",
        code: `$ docker compose -f deploy/docker-compose.yaml up -d --build
$ docker compose -f deploy/docker-compose.yaml ps`,
      },
    ],
  },
  {
    title: "Tear down",
    note: "Scoped to the lab container only — never automate destructive actions against shared or production workloads.",
    blocks: [
      {
        label: "shell",
        code: `$ docker rm -f sentinel-lab
$ docker image rm sentinel-lab:0.1.0   # optional, rebuilds in ~30s`,
      },
    ],
  },
];

const K8S_STEPS: Step[] = [
  {
    title: "Start a local cluster",
    note: "Any local control plane works — kind is shown; minikube and k3d are drop-in equivalents.",
    blocks: [
      {
        label: "shell",
        code: `$ kind create cluster --name sentinel
# alternative: minikube start --cpus 2 --memory 2g
$ kubectl cluster-info --context kind-sentinel`,
      },
    ],
  },
  {
    title: "Load the image — no registry needed",
    note: "Local clusters can pull straight from your docker daemon; imagePullPolicy: IfNotPresent in the manifest makes it stick.",
    blocks: [
      {
        label: "shell",
        code: `$ docker build -f deploy/Dockerfile -t sentinel-lab:0.1.0 .
$ kind load docker-image sentinel-lab:0.1.0 --name sentinel
# minikube users: minikube image load sentinel-lab:0.1.0`,
      },
    ],
  },
  {
    title: "Apply the manifests",
    note: "Namespace-scoped Deployment (2 replicas) + Service. Non-root, read-only root FS, dropped capabilities, requests/limits, liveness & readiness probes.",
    blocks: [
      { label: "deploy/k8s/sentinel.yaml", code: K8S_YAML },
      {
        label: "shell",
        code: `$ kubectl apply -f deploy/k8s/sentinel.yaml
$ kubectl -n sentinel-lab get pods -w
# sentinel-console-xxxxx   1/1   Running   (both replicas)`,
      },
    ],
  },
  {
    title: "Expose & verify",
    note: "port-forward keeps the lab off any public surface; swap for an Ingress only when you actually need sharing.",
    blocks: [
      {
        label: "shell",
        code: `$ kubectl -n sentinel-lab port-forward svc/sentinel-console 8443:80 &
$ curl -fsS http://localhost:8443 | head -3
$ kubectl -n sentinel-lab describe deployment sentinel-console | grep -A3 Conditions`,
      },
    ],
  },
  {
    title: "Harden before you share it",
    note: "Matches pipeline step 8 (Trivy/Checkov gates): scan the image, then add a default-deny NetworkPolicy in the namespace.",
    blocks: [
      {
        label: "shell",
        code: `$ trivy image --severity HIGH,CRITICAL sentinel-lab:0.1.0
$ kubectl -n sentinel-lab get networkpolicy
# none yet → add a default-deny ingress policy, then allow only the service selector`,
      },
    ],
  },
];

function DockerMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="10" width="4.4" height="4.4" />
      <rect x="9.8" y="10" width="4.4" height="4.4" />
      <rect x="9.8" y="3.2" width="4.4" height="4.4" />
      <path d="M2 17.5h14.5c2.6 0 4.6-1.6 5.5-4-1.7-.9-3.7-.8-5 .2" strokeLinecap="round" />
    </svg>
  );
}

function KubeMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 2.5 20.2 6.7v8.6L12 21.5 3.8 15.3V6.7Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 9.4V5.8M14.3 13.3l3.1 1.8M9.7 13.3 6.6 15.1" strokeLinecap="round" />
    </svg>
  );
}

function renderLine(line: string, i: number) {
  const t = line.trim();
  if (t.startsWith("#")) {
    return (
      <span key={i} className="block text-fog-700">
        {line}
      </span>
    );
  }
  if (t.startsWith("$ ")) {
    const rest = line.replace(/^\s*\$ /, "");
    const hash = rest.indexOf(" # ");
    return (
      <span key={i} className="block">
        <span className="select-none text-pulse-400">$ </span>
        <span className="text-fog-100">{hash >= 0 ? rest.slice(0, hash) : rest}</span>
        {hash >= 0 && <span className="text-fog-700">{rest.slice(hash)}</span>}
      </span>
    );
  }
  return (
    <span key={i} className="block text-fog-300">
      {line}
    </span>
  );
}

function Term({ label, code, id }: { label: string; code: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const isShell = label === "shell";

  const copy = async () => {
    const text = code
      .split("\n")
      .map((l) => (isShell && l.trim().startsWith("$ ") ? l.replace(/^\s*\$ /, "") : l))
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="border border-edge/70 bg-ink-950/80">
      <div className="flex items-center gap-2 border-b border-edge/60 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-alert-400/70" />
          <span className="h-2 w-2 rounded-full bg-signal-400/70" />
          <span className="h-2 w-2 rounded-full bg-ok-400/70" />
        </span>
        <span className="ml-1 font-mono text-[10px] tracking-wider text-fog-500">{label}</span>
        <button
          onClick={copy}
          className={`ml-auto flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[9.5px] tracking-widest transition-all ${
            copied
              ? "border-ok-400/70 text-ok-400"
              : "border-edge text-fog-500 hover:border-pulse-400/60 hover:text-pulse-300"
          }`}
        >
          <IconCopy size={11} />
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <pre
        id={id}
        className={`overflow-x-auto p-3.5 font-mono text-[11.5px] leading-[1.75] ${
          label !== "shell" ? "max-h-72 overflow-y-auto" : ""
        }`}
      >
        {code.split("\n").map(renderLine)}
      </pre>
    </div>
  );
}

function FlowStrip() {
  const nodes = [
    { label: "YOUR BROWSER", sub: "static console", x: 8, w: 150, dash: false },
    { label: "NGINX :8080", sub: "hardened container", x: 206, w: 168, dash: false },
    { label: "ANALYZER API :8000", sub: "optional · step 5", x: 422, w: 190, dash: true },
    { label: "LAB FEEDS", sub: "wazuh · guardduty", x: 660, w: 168, dash: true },
  ];
  return (
    <svg viewBox="0 0 840 92" className="mt-6 w-full" aria-hidden>
      {nodes.slice(0, -1).map((n, i) => {
        const next = nodes[i + 1];
        const y = 46;
        return (
          <line
            key={n.label}
            x1={n.x + n.w}
            y1={y}
            x2={next.x}
            y2={y}
            stroke={next.dash ? "#5f7396" : "#39d7e6"}
            strokeWidth="1.5"
            className="flowline"
            opacity={next.dash ? 0.55 : 0.9}
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
            stroke={n.dash ? "#31456c" : "#39d7e6"}
            strokeOpacity={n.dash ? 0.6 : 0.7}
            strokeDasharray={n.dash ? "5 4" : undefined}
          />
          <text x={n.x + 12} y="41" className="fill-[#e8effa]" style={{ font: "700 11px 'Chakra Petch', sans-serif", letterSpacing: "0.12em" }}>
            {n.label}
          </text>
          <text x={n.x + 12} y="58" style={{ font: "500 9.5px 'IBM Plex Mono', monospace", fill: n.dash ? "#5f7396" : "#7ce7f2" }}>
            {n.sub}
          </text>
        </g>
      ))}
      <text x="8" y="10" style={{ font: "500 9px 'IBM Plex Mono', monospace", fill: "#5f7396", letterSpacing: "0.25em" }}>
        REQUEST FLOW · DASHED = FUTURE PIPELINE STAGES
      </text>
    </svg>
  );
}

export default function DeployGuide() {
  const [tab, setTab] = useState<TabId>("docker");
  const steps = tab === "docker" ? DOCKER_STEPS : K8S_STEPS;

  return (
    <section className="mx-auto mt-16 max-w-[1500px] px-4 sm:px-6" aria-label="Deployment runbook">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-pulse-400">
              DEPLOYMENT RUNBOOK · SINGLE DOCKER HOST → LOCAL K8S CLUSTER
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-wide text-fog-100 sm:text-3xl">
              SHIP THE CONSOLE IN <span className="text-signal-400">FOUR COMMANDS</span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[10px] text-fog-500">
            {["deploy/Dockerfile", "deploy/nginx.conf", "deploy/docker-compose.yaml", "deploy/k8s/sentinel.yaml"].map((f) => (
              <span key={f} className="border border-edge bg-ink-900/60 px-2 py-1">
                {f}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="panel mt-7 p-5">
          <FlowStrip />

          <div className="mt-6 grid gap-1.5 border border-edge/70 p-1.5 sm:w-fit sm:grid-cols-2">
            {(
              [
                { id: "docker", label: "DOCKER · SINGLE HOST", Icon: DockerMark },
                { id: "k8s", label: "KUBERNETES · LOCAL CLUSTER", Icon: KubeMark },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 font-display text-[11px] font-bold tracking-[0.18em] transition-all duration-300 ${
                  tab === id
                    ? "bg-pulse-400/15 text-pulse-300 shadow-[inset_0_0_0_1px_rgba(57,215,230,0.55)]"
                    : "text-fog-500 hover:text-fog-300"
                }`}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>

          <div key={tab} className="tabfade mt-6 grid gap-4 lg:grid-cols-2">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="group border border-edge/60 bg-ink-900/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-pulse-400/40 hover:shadow-[0_14px_36px_-18px_rgba(57,215,230,0.35)]"
              >
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="font-display text-2xl font-bold tabular-nums text-pulse-400/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-[14px] font-semibold tracking-wide text-fog-100">
                    {step.title.toUpperCase()}
                  </h3>
                </div>
                {step.note && (
                  <p className="mb-3 text-[11.5px] leading-relaxed text-fog-500">{step.note}</p>
                )}
                <div className="space-y-3">
                  {step.blocks.map((b) => (
                    <Term key={b.label} label={b.label} code={b.code} id={`${tab}-${i}-${b.label}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-3 border border-signal-400/30 bg-signal-400/5 p-4">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ffb020" strokeWidth="1.8" className="mt-0.5 shrink-0" aria-hidden>
              <path d="M12 3 2.8 19.5h18.4Z" strokeLinejoin="round" />
              <path d="M12 9.5v4.5" strokeLinecap="round" />
              <circle cx="12" cy="16.8" r="0.4" fill="#ffb020" />
            </svg>
            <p className="text-[12px] leading-relaxed text-fog-500">
              <span className="font-semibold text-signal-300">Deployment posture:</span> the console is
              static — no server-side secrets live in this container. When the LLM provider lands
              (pipeline step 5), run it as a <em className="not-italic text-fog-300">separate</em> backend
              with keys injected via environment variables; on Kubernetes store them in a Secret
              mounted as env, never committed to the repo. Tear-down commands above are scoped to lab
              resources only — nothing here targets shared or production infrastructure.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
