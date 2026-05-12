export type CheckStatus = "pass" | "fail" | "warn";

export type CategoryId = "technical" | "readability" | "branding" | "cta";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  category: CategoryId;
  detail: string;
  recommendation?: string;
  example?: string;
}

export interface AnalysisResult {
  score: number;
  totalChecks: number;
  passCount: number;
  failCount: number;
  warnCount: number;
  wordCount: number;
  keywordDensity: number;
  checks: CheckResult[];
}
