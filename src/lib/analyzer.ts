import type {
  AnalysisResult,
  AlertMeta,
  MitreMapping,
  Severity,
} from "./types";

/* ------------------------------------------------------------------ */
/* Severity model                                                      */
/* ------------------------------------------------------------------ */

export const SEV_RANK: Record<Severity, number> = {
  Informational: 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

export const SEV_SCORE: Record<Severity, number> = {
  Informational: 12,
  Low: 30,
  Medium: 55,
  High: 80,
  Critical: 97,
};

export const SEV_COLOR: Record<Severity, string> = {
  Critical: "#ff5163",
  High: "#ff8a2a",
  Medium: "#ffd166",
  Low: "#6fd7ff",
  Informational: "#8ca0c3",
};

const maxSev = (a: Severity, b: Severity): Severity =>
  SEV_RANK[a] >= SEV_RANK[b] ? a : b;

/* ------------------------------------------------------------------ */
/* Shared playbook fragments (evidence-first, non-destructive)         */
/* ------------------------------------------------------------------ */

const F = {
  evidence:
    "Preserve the raw alert payload and this analysis JSON in the incident case record before any mutating action.",
  cloudtrail:
    "Pull CloudTrail (management + data events) for the affected account/region for ±60 min around the alert window and diff against the entity's 14-day baseline.",
  noTermination:
    "Do not terminate or reboot implicated instances yet — capture memory image and EBS snapshots first if forensics may be required.",
  centralize:
    "Ship GuardDuty, CloudTrail, Config, and VPC Flow Logs to a delegated security account with object-lock (tamper-evident) storage.",
  rerun48:
    "Re-run the detection query that produced this finding and confirm zero new matches for 48 hours before closing.",
  baseline:
    "Confirm dashboard metrics (alert volume by severity, technique coverage) return to baseline.",
};

/* ------------------------------------------------------------------ */
/* Extraction context                                                  */
/* ------------------------------------------------------------------ */

interface Ctx {
  text: string;
  obj: unknown;
  title: string;
  source: string;
  region?: string;
  account?: string;
  firstSeen?: string;
  resources: string[];
  ips: string[];
  users: string[];
}

const USER_KEYS = new Set([
  "userName",
  "user",
  "srcuser",
  "dstuser",
  "username",
  "principalId",
]);

function walkCollect(
  node: unknown,
  ips: Set<string>,
  users: Set<string>,
  resources: Set<string>,
  depth = 0,
): void {
  if (depth > 12 || node == null) return;
  if (typeof node === "string") {
    const arn = node.match(
      /arn:aws[a-z-]*:[a-z0-9-]+:[a-z0-9-]*:\d{12}:[^\s",]+/i,
    );
    if (arn) resources.add(arn[0]);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => walkCollect(n, ips, users, resources, depth + 1));
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === "string") {
        if (k === "ipAddressV4" || k === "srcip" || k === "ip") ips.add(v);
        if (USER_KEYS.has(k)) users.add(v);
        if (k === "instanceId") resources.add(v);
        if (k === "name" && (node as Record<string, unknown>).arn)
          resources.add(v);
      }
      walkCollect(v, ips, users, resources, depth + 1);
    }
  }
}

function str(obj: unknown, path: string[]): string | undefined {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return typeof cur === "string" || typeof cur === "number"
    ? String(cur)
    : undefined;
}

function buildCtx(obj: unknown): Ctx {
  const text = JSON.stringify(obj ?? {});
  const ips = new Set<string>();
  const users = new Set<string>();
  const resources = new Set<string>();
  walkCollect(obj, ips, users, resources);

  // fallback regex sweeps
  for (const m of text.matchAll(/\bi-[0-9a-f]{8,17}\b/gi)) resources.add(m[0]);
  for (const m of text.matchAll(/\b(?:AKIA|ASIA|AIDA|AROA)[A-Z0-9]{16}\b/g))
    resources.add(m[0]);

  const title =
    str(obj, ["title"]) ?? str(obj, ["type"]) ?? str(obj, ["rule", "description"]) ?? "Cloud security alert";
  const region = str(obj, ["region"]);
  const account = str(obj, ["accountId"]);
  const firstSeen =
    str(obj, ["service", "eventFirstSeen"]) ?? str(obj, ["timestamp"]);

  const ipList = [...ips].filter((ip) =>
    /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && ip.split(".").every((o) => +o <= 255),
  );

  return {
    text,
    obj,
    title,
    source:
      str(obj, ["rule", "id"]) !== undefined
        ? "Wazuh"
        : str(obj, ["type"])?.includes(":")
          ? "GuardDuty"
          : "Cloud alert feed",
    region,
    account,
    firstSeen,
    resources: [...resources].slice(0, 12),
    ips: ipList.slice(0, 10),
    users: [...users].slice(0, 6),
  };
}

/* ------------------------------------------------------------------ */
/* Detection rules                                                     */
/* ------------------------------------------------------------------ */

interface Rule {
  id: string;
  test: (c: Ctx) => boolean;
  severity: (c: Ctx) => Severity;
  headline: (c: Ctx) => string;
  mitre: MitreMapping[];
  investigate: string[];
  contain: string[];
  remediate: string[];
  validate: string[];
  assumptions: string[];
}

const RULES: Rule[] = [
  {
    id: "tor",
    test: (c) => /tor(?:ipcaller|client|relay)|tor entry guard|:9001|:9030/i.test(c.text),
    severity: () => "High",
    headline: (c) =>
      `${c.title} Outbound Tor connectivity from a production workload is rarely legitimate and is frequently associated with anonymized command-and-control or exfiltration.`,
    mitre: [
      {
        tactic: "Command and Control",
        technique: "T1090.003 — Proxy: Multi-hop Proxy",
        reason:
          "Connections to a Tor entry guard show traffic being anonymized — a common C2 path for compromised cloud workloads.",
      },
      {
        tactic: "Exfiltration",
        technique: "T1041 — Exfiltration Over C2 Channel",
        reason:
          "If the host is compromised, the anonymized channel can move data out; treat as possible until flow logs prove otherwise.",
      },
    ],
    investigate: [
      "Identify the owning process: query your EDR/osquery fleet for the binary holding the outbound socket (port 9001/9030) at the alert time.",
      "Inspect instance user-data, launch template, and AMI lineage — Tor binaries on a freshly launched instance suggest launch-time compromise.",
      "Search VPC Flow Logs for other hosts contacting Tor ports (9001, 9030) to size the blast radius.",
      "Review the instance-profile role's permissions and any use of those credentials from the instance's private IP.",
      F.cloudtrail,
    ],
    contain: [
      "Apply a restrictive security group / NACL denying egress to the Tor node IP and ports 9001/9030, keeping only forensic access paths open.",
      "Revoke temporary credentials issued to the instance role and rotate any long-lived keys reachable from the host.",
      "Isolate the instance into a quarantine subnet rather than terminating it.",
      F.noTermination,
    ],
    remediate: [
      "Rebuild the instance from a known-good AMI; do not attempt to 'clean' a compromised host in place.",
      "Enforce egress filtering (NAT with allowlist or network firewall) so workloads cannot reach anonymization infrastructure.",
      "Require IMDSv2 and strip instance-profile permissions the workload does not use (least privilege).",
      F.centralize,
    ],
    validate: [
      F.rerun48,
      "Verify the egress allowlist blocks Tor relays with a canary connection test from a non-production instance in the same subnet.",
      F.baseline,
    ],
    assumptions: [
      "Assumes the remote IP is a genuine Tor entry node per the detector's threat-intel match; not independently verified here.",
      "The payload does not identify which process or user initiated the connection.",
      "Severity assumes this workload has no approved anonymity requirement (e.g., research use) — confirm with the owning team.",
    ],
  },
  {
    id: "portprobe",
    test: (c) => /portprobe|portscan|port_probe|recon:ec2/i.test(c.text),
    severity: (c) =>
      /"port":\s*(22|3389)\b/.test(c.text) && /0\.0\.0\.0/.test(c.text)
        ? "High"
        : "Medium",
    headline: (c) =>
      `Repeated external port probing against ${c.resources[0] ?? "an EC2 instance"} maps exposed services — reconnaissance that escalates sharply if administrative ports answer from the open internet.`,
    mitre: [
      {
        tactic: "Reconnaissance",
        technique: "T1595.001 — Active Scanning: Scanning IP Blocks",
        reason:
          "Repeated probes from external infrastructure match active scanning of cloud-facing assets.",
      },
      {
        tactic: "Initial Access",
        technique: "T1190 — Exploit Public-Facing Application",
        reason:
          "Scanning typically precedes exploitation attempts against exposed admin interfaces; the objective is inferred, not yet observed.",
      },
    ],
    investigate: [
      "Enumerate which ports were probed and which were open: correlate the finding with VPC Flow Logs ACCEPT/REJECT records for the source IPs.",
      "Check whether the probed port is exposed via security group (0.0.0.0/0) or an internet-facing load balancer.",
      "Look the source IPs up in threat intel; note ASN and whether other accounts in the organization saw the same sources.",
      "Verify the instance's patch level and the services actually listening on the probed ports.",
    ],
    contain: [
      "Tighten the security group: replace 0.0.0.0/0 on administrative ports with bastion/VPN CIDRs.",
      "Close any port that is not strictly required; otherwise front the service with SSM Session Manager or a VPN.",
      "Enable Shield/WAF on any internet-facing endpoint identified during scoping.",
    ],
    remediate: [
      "Adopt default-deny security groups managed by IaC with CI policy checks (no 0.0.0.0/0 on 22/3389/3306).",
      "Enable additional coverage (e.g., GuardDuty RDS Protection) if database ports were targeted.",
      F.centralize,
    ],
    validate: [
      "Re-scan from an approved external vantage point to confirm administrative ports no longer respond.",
      F.rerun48,
      F.baseline,
    ],
    assumptions: [
      "Probing alone is not a compromise; no successful authentication is evidenced in this payload.",
      "Actual exposure depends on security-group state that is not fully included in the alert.",
    ],
  },
  {
    id: "iam-anomaly",
    test: (c) =>
      /iamuser\/anomalous|createaccesskey|attachuserpolicy|anomalousbehavior/i.test(c.text),
    severity: (c) =>
      /administratoraccess|attachuserpolicy|stoplogging|deletetrail/i.test(c.text)
        ? "Critical"
        : "High",
    headline: (c) =>
      `API behavior from IAM principal "${c.users[0] ?? "unknown"}" deviates from its established pattern — credential-backed activity consistent with account persistence and privilege escalation.`,
    mitre: [
      {
        tactic: "Persistence",
        technique: "T1098.001 — Account Manipulation: Additional Cloud Credentials",
        reason:
          "Creating a new access key for an existing user is a durable way for an attacker to keep access.",
      },
      {
        tactic: "Privilege Escalation",
        technique: "T1078.004 — Valid Accounts: Cloud Accounts",
        reason:
          "A valid cloud identity used from an anomalous source IP/user agent to gain higher privileges.",
      },
      {
        tactic: "Defense Evasion",
        technique: "T1562.001 — Impair Defenses: Disable or Modify Tools",
        reason:
          "Check the same window for StopLogging/DeleteTrail calls — a common follow-on action after privilege gains.",
      },
    ],
    investigate: [
      "Generate an IAM credential report and list all keys for the user; flag anything created inside the alert window and its last-used IP/service.",
      "Trace the source IP and user agent across CloudTrail: which APIs succeeded, which resources were touched.",
      "Confirm MFA status for the user and whether the activity bypassed expected MFA (API vs console paths).",
      "Diff attached policies and group memberships before/after the window for privilege changes.",
      F.cloudtrail,
    ],
    contain: [
      "Disable (do not delete yet — evidence value) any newly created access keys; suspend the user's console access pending review.",
      "Revoke all active sessions for the principal and force credential rotation.",
      "Apply an SCP guardrail denying iam:Attach*Policy and iam:CreateAccessKey outside break-glass roles.",
      "Do not delete the IAM user or CloudTrail logs — they are the investigation evidence.",
    ],
    remediate: [
      "Enforce MFA, IAM Access Analyzer, and permissions boundaries for human users; give service accounts scoped roles, never static admin keys.",
      "Replace long-lived access keys with short-lived STS credentials (IRSA / IAM Roles Anywhere).",
      "Add detective Config rules for policy-attach events on privileged principals.",
      F.centralize,
    ],
    validate: [
      "Confirm the credential report shows only expected, recently rotated credentials for the user.",
      "Monitor for new anomalous IAM events across the account for 7 days.",
      F.rerun48,
    ],
    assumptions: [
      "Anomalous-behavior findings are ML-based; benign explanations exist (new automation, migrated pipeline, vendor tooling).",
      "The payload does not prove the actor controls the account — correlation with sign-in and identity-provider logs is required.",
    ],
  },
  {
    id: "cryptomining",
    test: (c) =>
      /bitcoin|cryptomining|xmrig|stratum|miningpool|minexmr|monero|coinminer/i.test(c.text),
    severity: () => "High",
    headline: (c) =>
      `DNS/network indicators of cryptocurrency mining tooling on ${c.resources[0] ?? "a workload"} — resource hijacking that inflates cost and usually rides on a prior intrusion.`,
    mitre: [
      {
        tactic: "Impact",
        technique: "T1496 — Resource Hijacking",
        reason:
          "Mining-pool traffic is the canonical signature of compute diverted to cryptocurrency generation.",
      },
      {
        tactic: "Command and Control",
        technique: "T1071.001 — Application Layer Protocol: Web Protocols",
        reason:
          "Stratum/HTTP(S) communication with the pool endpoint functions as the ongoing control channel.",
      },
    ],
    investigate: [
      "Correlate with CloudWatch CPUUtilization: sustained near-100% CPU since launch strongly supports active mining.",
      "Hunt for miner artifacts: xmrig-family binaries in /tmp, /dev/shm, or as systemd units; check running processes via your EDR.",
      "Inspect cloud-init/user-data and container images deployed in the last 7 days — miners frequently arrive at launch time via exposed docker APIs or CI secrets.",
      "Search DNS resolver logs for the mining domain across all VPCs to find sibling infections.",
      "Check Cost Explorer for spend spikes aligned with instance or Auto Scaling launch times.",
    ],
    contain: [
      "Block/sinkhole the mining domain at the DNS firewall and deny egress to the pool IP/port.",
      "Snapshot volumes first, then isolate or stop the instance; revoke its instance-profile credentials.",
      "Quarantine the associated container image tag and pause the pipeline that deployed it.",
      F.noTermination,
    ],
    remediate: [
      "Rebuild from a trusted AMI; add miner-signature scanning (YARA/ClamAV) to the golden-image pipeline.",
      "Close the entry vector: remove any public docker API exposure and rotate CI/CD secrets reachable from the workload.",
      "Add budget alarms and GuardDuty Malware Protection for the account.",
      F.centralize,
    ],
    validate: [
      "Confirm CPU baselines and cost curves return to normal after the rebuild.",
      F.rerun48,
      F.baseline,
    ],
    assumptions: [
      "A DNS match to a mining domain is high-confidence but could reflect an engineer's test — verify intent with the owning team.",
      "The initial access vector is not shown in this payload; investigation must establish how the miner was deployed.",
    ],
  },
  {
    id: "c2",
    test: (c) => /c&cactivity|c2activity|backdoor|commandandcontrol|trojan/i.test(c.text),
    severity: () => "Critical",
    headline: (c) =>
      `Outbound traffic matches known command-and-control infrastructure involving ${c.resources[0] ?? "a resource"} — treat the host as compromised until disproven.`,
    mitre: [
      {
        tactic: "Command and Control",
        technique: "T1071 — Application Layer Protocol",
        reason: "Beaconing to C2 domains/IPs matches adversary control traffic.",
      },
      {
        tactic: "Exfiltration",
        technique: "T1041 — Exfiltration Over C2 Channel",
        reason:
          "Established C2 provides a ready exfiltration path; assumed possible until flow data shows otherwise.",
      },
    ],
    investigate: [
      "Initiate the IR runbook: timeline the first/last seen window and every connection from the host inside it.",
      "Capture memory and disk snapshots before any disruptive action.",
      "Pivot the C2 indicator across threat intel and your own DNS/flow logs to find other affected hosts.",
      "Hunt for lateral movement: internal VPC Flow Log connections from the host to other subnets.",
      "Sweep for credential use from the host's private IP in CloudTrail and the identity provider.",
    ],
    contain: [
      "Egress-block the C2 indicator org-wide (DNS firewall + NACL) immediately.",
      "Network-isolate the host in a forensics subnet; revoke all credentials reachable from it.",
      "Preserve logs and snapshots under case control; restrict who can modify them.",
      F.noTermination,
    ],
    remediate: [
      "Rebuild the host from a known-good image after evidence capture.",
      "Patch or remove the entry vector identified during the timeline (exposed service, stolen key, vulnerable dependency).",
      "Roll credentials the host could access; review IAM for unused permissions.",
      F.centralize,
    ],
    validate: [
      "Confirm the C2 indicator no longer resolves or connects anywhere in the estate.",
      F.rerun48,
      "Hold heightened monitoring on the affected subnet for 7 days.",
    ],
    assumptions: [
      "Assumes the detector's threat-intel match is current and accurate; verify the indicator independently.",
      "Scope of compromise (other hosts, identities, data) is unknown from this single alert.",
    ],
  },
  {
    id: "s3-exposure",
    test: (c) =>
      /blockpublicaccess|bucketpublic|public_readable|s3\/bucket|deletebucketpublicaccessblock|anomalous.*getobject/i.test(
        c.text,
      ),
    severity: (c) =>
      /public_readable|deleteobject|getobject.*anomalous|finance|pii|sensitive/i.test(c.text)
        ? "High"
        : "Medium",
    headline: (c) =>
      `S3 protections were weakened or data access deviated from baseline${c.resources[0] ? ` around "${c.resources[0]}"` : ""} — creating an exposure path for stored data.`,
    mitre: [
      {
        tactic: "Defense Evasion",
        technique: "T1562.001 — Impair Defenses: Disable or Modify Tools",
        reason:
          "Disabling Block Public Access removes a protective control, whether by error or intent.",
      },
      {
        tactic: "Collection",
        technique: "T1530 — Data from Cloud Storage Object",
        reason:
          "Anomalous object-read patterns indicate bulk access to cloud-stored data.",
      },
      {
        tactic: "Exfiltration",
        technique: "T1567 — Exfiltration Over Web Service",
        reason:
          "If objects subsequently leave toward external endpoints; requires DNS/flow correlation to confirm.",
      },
    ],
    investigate: [
      "Identify who made the change: principal, source IP, user agent, and whether the change followed a support ticket or change record.",
      "Check bucket access logs / CloudTrail data events for GetObject spikes or reads from anonymous principals after the change.",
      "List current bucket policy, ACLs, and effective public accessibility for the bucket and its account.",
      "Classify the data at risk (finance exports, PII) to drive notification obligations.",
    ],
    contain: [
      "Re-enable account- and bucket-level Block Public Access (this is restorative, not destructive).",
      "If anonymous reads occurred, take the bucket offline behind a bucket policy deny until scoping completes.",
      "Suspend the acting principal's sessions pending review of their recent activity.",
    ],
    remediate: [
      "Enforce account-level Block Public Access plus an SCP that prevents member accounts from weakening it.",
      "Add Config rules (s3-bucket-public-read-prohibited, s3-bucket-logging-enabled) with auto-remediation to the safe state.",
      "Enable S3 server access logging / CloudTrail data events for sensitive buckets.",
      F.centralize,
    ],
    validate: [
      "Confirm the bucket reports 'not publicly accessible' and the Config rule is COMPLIANT.",
      "Verify access-log volume returned to baseline with no anonymous principal reads.",
      F.rerun48,
    ],
    assumptions: [
      "The change may be legitimate but undocumented maintenance; intent cannot be determined from the payload.",
      "Whether data was actually read or exfiltrated is unknown without access logs.",
    ],
  },
  {
    id: "bruteforce",
    test: (c) =>
      /authentication fail|failed password|multiple.*failures|brute|:5712\b|:5503\b/i.test(c.text),
    severity: (c) =>
      /"level":\s*1[0-5]\b/.test(c.text) || /"srcuser":\s*"root"/.test(c.text)
        ? "High"
        : "Medium",
    headline: (c) =>
      `Repeated authentication failures from ${c.ips[0] ?? "an external IP"} targeting "${c.users[0] ?? "system accounts"}" on ${str(c.obj, ["agent", "name"]) ?? "a host"} — consistent with brute-force or password-spraying activity.`,
    mitre: [
      {
        tactic: "Credential Access",
        technique: "T1110.003 — Brute Force: Password Spraying",
        reason:
          "High volumes of failed logins from a single source against privileged accounts match brute-force behavior.",
      },
      {
        tactic: "Initial Access",
        technique: "T1078 — Valid Accounts",
        reason:
          "Any success converts this into valid-account access; auth logs must be checked for a success from the same source.",
      },
    ],
    investigate: [
      "Search auth logs (auth.log / journald) for any SUCCESS from the source IP — failures alone are noise, one success is an incident.",
      "Count targeted usernames: a single account suggests brute force; many accounts suggests spraying.",
      "Check the source IP against threat intel and whether sister hosts saw the same source.",
      "Verify SSH configuration: password auth enabled? root login permitted? port exposed publicly?",
    ],
    contain: [
      "Block the source IP at the host firewall/security group (deny-list, reversible).",
      "Temporarily lock the targeted account(s) or require step-up MFA if identity-provider backed.",
      "Rate-limit SSH at the edge (fail2ban or WAF rules) while hardening is scheduled.",
    ],
    remediate: [
      "Disable SSH password authentication and root login; require key-based auth via SSM Session Manager or a bastion with MFA.",
      "Remove public exposure of administrative ports; route through VPN/bastion.",
      "Tune the SIEM rule threshold so bursts page on-call instead of silently accumulating.",
      F.centralize,
    ],
    validate: [
      "Confirm zero further authentication failures from the blocked source and no new sources rotating in.",
      "Verify no successful logins occurred during the window (decisive for incident vs. attempt).",
      F.rerun48,
    ],
    assumptions: [
      "Failed logins are expected background noise on internet-facing SSH; severity depends on exposure and any success.",
      "The alert does not include whether the source IP is already on a shared deny-list.",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface AnalyzeOutput {
  result: AnalysisResult;
  meta: AlertMeta;
  matchedRules: string[];
}

const dedupe = (arr: string[]): string[] => [...new Set(arr)];

export function analyze(obj: unknown): AnalyzeOutput {
  const ctx = buildCtx(obj);
  const matched = RULES.filter((r) => r.test(ctx));

  let severity: Severity = "Informational";
  const mitre: MitreMapping[] = [];
  let investigate: string[] = [];
  let contain: string[] = [];
  let remediate: string[] = [];
  let validate: string[] = [];
  let assumptions: string[] = [];
  let headline: string;

  if (matched.length === 0) {
    headline = `The supplied payload did not match any deterministic detection rule. It is preserved for manual review; no confident ATT&CK mapping is asserted from this payload alone.`;
    investigate = [
      "Manually review the raw payload field-by-field and identify the emitting detector and its confidence.",
      "Locate the originating log source and pull ±60 min of surrounding events for the implicated entity.",
      F.cloudtrail,
    ];
    contain = [
      "No destructive containment is warranted from an uncorroborated signal; apply heightened monitoring on implicated resources instead.",
      F.evidence,
    ];
    remediate = [
      "Ensure the alert source is onboarded to the correlation pipeline so future occurrences match a rule.",
      F.centralize,
    ];
    validate = [F.rerun48, F.baseline];
    assumptions = [
      "No detection rule matched; this is a schema-complete fallback, not an assessment of safety.",
      "The payload may be truncated or custom-formatted, limiting field extraction.",
    ];
  } else {
    for (const r of matched) {
      severity = maxSev(severity, r.severity(ctx));
      for (const m of r.mitre)
        if (!mitre.some((x) => x.technique === m.technique && x.tactic === m.tactic))
          mitre.push(m);
      investigate = investigate.concat(r.investigate);
      contain = contain.concat(r.contain);
      remediate = remediate.concat(r.remediate);
      validate = validate.concat(r.validate);
      assumptions = assumptions.concat(r.assumptions);
    }
    headline = matched[0].headline(ctx);
    if (matched.length > 1)
      headline += ` Note: ${matched.length} detection rules co-fired; steps are merged below.`;
  }

  const resourceList = dedupe([
    ...ctx.resources,
    ...ctx.users.map((u) => `iam-user:${u}`),
    ...ctx.ips.filter((ip) => !/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip)),
  ]);

  const closer =
    SEV_RANK[severity] >= SEV_RANK.High
      ? "Immediate containment is recommended before eradication; preserve evidence throughout."
      : "Proceed with an evidence-led investigation; no disruptive action is warranted from this payload alone.";

  const result: AnalysisResult = {
    executive_summary: `${headline} ${closer}`,
    severity_assessment: severity,
    affected_resources: resourceList.length ? resourceList : ["none extracted from payload"],
    mitre_attack: mitre,
    investigation_steps: dedupe([F.evidence, ...investigate]),
    containment_steps: dedupe(contain),
    remediation_steps: dedupe(remediate),
    validation_steps: dedupe(validate),
    assumptions_and_unknowns: dedupe(assumptions),
  };

  return {
    result,
    matchedRules: matched.map((r) => r.id),
    meta: {
      title: ctx.title,
      source: ctx.source,
      region: ctx.region,
      account: ctx.account,
      firstSeen: ctx.firstSeen,
    },
  };
}

/* ATT&CK enterprise tactic rail (subset labels used by the matrix) */
export const TACTICS: { id: string; name: string; short: string }[] = [
  { id: "TA0043", name: "Reconnaissance", short: "RECON" },
  { id: "TA0042", name: "Resource Development", short: "RES DEV" },
  { id: "TA0001", name: "Initial Access", short: "INIT" },
  { id: "TA0002", name: "Execution", short: "EXEC" },
  { id: "TA0003", name: "Persistence", short: "PERSIST" },
  { id: "TA0004", name: "Privilege Escalation", short: "PRIV ESC" },
  { id: "TA0005", name: "Defense Evasion", short: "DEF EVAS" },
  { id: "TA0006", name: "Credential Access", short: "CRED ACC" },
  { id: "TA0007", name: "Discovery", short: "DISCOV" },
  { id: "TA0008", name: "Lateral Movement", short: "LAT MOV" },
  { id: "TA0009", name: "Collection", short: "COLLECT" },
  { id: "TA0011", name: "Command and Control", short: "C2" },
  { id: "TA0010", name: "Exfiltration", short: "EXFIL" },
  { id: "TA0040", name: "Impact", short: "IMPACT" },
];
