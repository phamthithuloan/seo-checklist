export type CheckStatus = "pass" | "fail" | "warn";

export type CategoryId =
  | "technical"
  | "readability"
  | "branding"
  | "cta"
  | "ul-li"
  | "ai-opt"
  | "eeat"
  | "grammar";

export type IssueKind =
  | "sentence"
  | "paragraph"
  | "heading"
  | "link"
  | "word"
  | "quote"
  | "text";

export interface CheckIssue {
  kind: IssueKind;
  text: string;
  note?: string;
}

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  category: CategoryId;
  detail: string;
  recommendation?: string;
  example?: string;
  issues?: CheckIssue[];
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

export type OutlineFormat = "text" | "bullet" | "table" | "mixed" | "empty";
export type OutlineHeadingStatus = "match" | "missing" | "extra";

export interface OutlineHeading {
  level: number;
  title: string;
  targetWords?: number | null;
  targetFormat?: OutlineFormat | null;
  actualWords?: number | null;
  actualFormat?: OutlineFormat | null;
  status: OutlineHeadingStatus;
  note?: string | null;
}

export interface OutlineComparison {
  totalOutlineHeadings: number;
  totalContentHeadings: number;
  matched: number;
  missing: number;
  extra: number;
  headings: OutlineHeading[];
}
