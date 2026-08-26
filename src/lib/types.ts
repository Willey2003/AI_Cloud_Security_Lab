export type Severity =
  | "Critical"
  | "High"
  | "Medium"
  | "Low"
  | "Informational";

export interface MitreMapping {
  tactic: string;
  technique: string;
  reason: string;
}

/** Exact schema the defensive analyst contract returns. */
export interface AnalysisResult {
  executive_summary: string;
  severity_assessment: Severity;
  affected_resources: string[];
  mitre_attack: MitreMapping[];
  investigation_steps: string[];
  containment_steps: string[];
  remediation_steps: string[];
  validation_steps: string[];
  assumptions_and_unknowns: string[];
}

export interface SampleAlert {
  id: string;
  source: string;
  chip: string;
  title: string;
  vendorSeverity: string;
  json: string;
}

export type QueueStatus = "queued" | "analyzed";

export interface QueueItem {
  id: string;
  title: string;
  source: string;
  status: QueueStatus;
  severity?: Severity;
  analyzedAt?: number;
}

export type StepListKey =
  | "investigation_steps"
  | "containment_steps"
  | "remediation_steps"
  | "validation_steps";

export interface AlertMeta {
  title: string;
  source: string;
  region?: string;
  account?: string;
  firstSeen?: string;
}
