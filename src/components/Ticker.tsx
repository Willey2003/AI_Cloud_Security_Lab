const LINES = [
  "guardduty: finding b7f7c3a8 severity=8 type=UnauthorizedAccess:EC2/TorIPCaller",
  "cloudtrail: CreateAccessKey principal=svc-deploy src=203.0.113.9 → paged",
  "wazuh: rule 5712 fired×41 agent=bastion-01 src=91.240.118.172",
  "flowlogs: REJECT tcp 45.148.10.72:51822 → 10.0.1.14:22 (238 probes)",
  "r53-resolver: NXDOMAIN pool.stratum-xmr.examplemining.net sinkholed",
  "config: s3-bucket-public-read-prohibited NON_COMPLIANT bucket=corp-finance-reports",
  "guardduty: finding c9e2d4f6 severity=2 type=Recon:EC2/PortProbeUnprotectedPort",
  "iam: credential report generated · 2 keys rotated · 0 active anomalies",
  "scpfleet: guardrail deny-iam-self-elevation APPLIED org-wide",
  "cost-anomaly: us-west-2 c5.4xlarge spend +412% vs baseline → correlated w/ miner DNS",
];

export default function Ticker() {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center">
      {LINES.map((line, i) => (
        <span
          key={`${key}-${i}`}
          className="flex items-center gap-2 px-5 font-mono text-[11px] text-fog-500"
        >
          <span className="text-pulse-400/70">▸</span>
          <span className="whitespace-nowrap">
            <span className="mr-2 text-fog-700">[02:{String(41 + i).padStart(2, "0")}:1Z]</span>
            {line}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="ticker relative overflow-hidden border-b border-edge/60 bg-ink-900/70">
      <div className="ticker-track py-1.5">
        {row("a")}
        {row("b")}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-950 to-transparent" />
    </div>
  );
}
