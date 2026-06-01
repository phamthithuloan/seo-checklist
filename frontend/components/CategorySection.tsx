"use client";

import type { CategoryId, CheckResult } from "@/lib/types";
import { ALL_RULES, type RuleMeta } from "@/lib/checklist-rules";
import ChecklistItem, { SkippedRuleItem } from "./ChecklistItem";

type IconProps = { className?: string };

const TechnicalIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3.5" />
  </svg>
);
const ReadabilityIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h11a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
    <path d="M4 4v14h12" />
    <path d="M8 9h6M8 13h6" />
  </svg>
);
const BrandingIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6" />
    <path d="M9 13l-2 8 5-3 5 3-2-8" />
  </svg>
);
const CtaIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l18-7-7 18-2-8z" />
  </svg>
);
const UlLiIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
);
const AiIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v3M12 19v3M5 12H2M22 12h-3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);
const EeatIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-8.5L2 9h7z" />
  </svg>
);
const GrammarIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V5h16v2M9 5v14M15 5v14M6 19h12" />
  </svg>
);
const TrustAiIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V5z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

interface CategoryMeta {
  id: CategoryId;
  label: string;
  description: string;
  Icon: (p: IconProps) => JSX.Element;
  iconBg: string;
  iconText: string;
  ringTint: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "technical",
    label: "Technical SEO",
    description: "Heading, meta, link, mật độ keyword, Sapo, kết bài",
    Icon: TechnicalIcon,
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
    ringTint: "ring-indigo-100",
  },
  {
    id: "readability",
    label: "Tốt cho người đọc",
    description: "Độ dài câu, đoạn, câu dẫn sau heading",
    Icon: ReadabilityIcon,
    iconBg: "bg-sky-50",
    iconText: "text-sky-600",
    ringTint: "ring-sky-100",
  },
  {
    id: "ul-li",
    label: "UL-LI",
    description: "Bullet list, in đậm, định dạng văn bản",
    Icon: UlLiIcon,
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
    ringTint: "ring-amber-100",
  },
  {
    id: "ai-opt",
    label: "Tối ưu cho AI",
    description: "TL;DR, heading dạng câu hỏi",
    Icon: AiIcon,
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    ringTint: "ring-emerald-100",
  },
  {
    id: "branding",
    label: "Branding",
    description: "FAQ, CTA, xưng hô, brand voice, message, từ cấm",
    Icon: BrandingIcon,
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    ringTint: "ring-violet-100",
  },
  {
    id: "eeat",
    label: "E-E-A-T",
    description: "Experience / Expertise / Authoritativeness / Trust",
    Icon: EeatIcon,
    iconBg: "bg-orange-50",
    iconText: "text-orange-600",
    ringTint: "ring-orange-100",
  },
  {
    id: "grammar",
    label: "Ngữ pháp - Chính tả",
    description: "AI proofread bằng Google Gemini (opt-in, free tier)",
    Icon: GrammarIcon,
    iconBg: "bg-slate-100",
    iconText: "text-slate-700",
    ringTint: "ring-slate-200",
  },
  {
    id: "trust-ai",
    label: "Tin cậy & Kiểm chứng AI",
    description: "Claim thiếu nguồn, link nguồn, văn phong AI (free) + fact-check Gemini",
    Icon: TrustAiIcon,
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    ringTint: "ring-rose-100",
  },
];

function statusColor(passPct: number) {
  if (passPct === 100) return { ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-500", label: "All passed" };
  if (passPct >= 60) return { ring: "ring-amber-200", text: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-400", label: "Cần cải thiện" };
  return { ring: "ring-rose-200", text: "text-rose-700", bg: "bg-rose-50", bar: "bg-rose-500", label: "Yếu" };
}

type Row =
  | { kind: "scored"; rule: RuleMeta; check: CheckResult }
  | { kind: "needs-config"; rule: RuleMeta; check: CheckResult }
  | { kind: "needs-api"; rule: RuleMeta; check: CheckResult }
  | { kind: "disabled"; rule: RuleMeta }
  | { kind: "not-run"; rule: RuleMeta };

const ROW_ORDER = { scored: 0, "needs-config": 1, "needs-api": 2, "not-run": 3, disabled: 4 };

export default function CategorySection({
  meta,
  checks,
  disabledRuleIds,
}: {
  meta: CategoryMeta;
  checks: CheckResult[];
  disabledRuleIds?: Set<string>;
}) {
  const rules = ALL_RULES.filter((r) => r.category === meta.id);
  const disabled = disabledRuleIds ?? new Set<string>();
  const byId = new Map(checks.map((c) => [c.id, c]));

  const rows: Row[] = rules.map((rule) => {
    const c = byId.get(rule.id);
    if (c && c.inactive === "needs-config") return { kind: "needs-config", rule, check: c };
    if (c && c.inactive === "needs-api") return { kind: "needs-api", rule, check: c };
    if (c) return { kind: "scored", rule, check: c };
    if (disabled.has(rule.id)) return { kind: "disabled", rule };
    return { kind: "not-run", rule };
  });
  const ordered = [...rows].sort((a, b) => ROW_ORDER[a.kind] - ROW_ORDER[b.kind]);

  // Score = only checks that actually ran (inactive excluded).
  const scored = checks.filter((c) => !c.inactive);
  const pass = scored.filter((c) => c.status === "pass").length;
  const warn = scored.filter((c) => c.status === "warn").length;
  const fail = scored.filter((c) => c.status === "fail").length;
  const scoredTotal = scored.length;
  const denom = Math.max(scoredTotal, 1);
  const passPct = (pass / denom) * 100;
  const warnPct = (warn / denom) * 100;
  const failPct = (fail / denom) * 100;
  const tone = statusColor(scoredTotal ? passPct : 0);
  const inactiveCount = rows.length - scoredTotal;
  const Icon = meta.Icon;

  return (
    <section id={`cat-${meta.id}`} className="scroll-mt-24 rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 animate-fade-up">
      <header className="px-5 md:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-11 w-11 rounded-xl ${meta.iconBg} ${meta.iconText} grid place-items-center ring-1 ${meta.ringTint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {meta.label}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{meta.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {scoredTotal > 0 ? (
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {tone.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full ring-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-700">
                Chưa chấm
              </span>
            )}
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 num">
              {pass}/{scoredTotal}
            </span>
          </div>
        </div>

        {scoredTotal > 0 && (
          <div className="mt-4">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              {passPct > 0 && <div className="bg-emerald-500" style={{ width: `${passPct}%` }} />}
              {warnPct > 0 && <div className="bg-amber-400" style={{ width: `${warnPct}%` }} />}
              {failPct > 0 && <div className="bg-rose-500" style={{ width: `${failPct}%` }} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <Pill dot="bg-emerald-500" label="Pass" value={pass} />
              <Pill dot="bg-amber-400" label="Warn" value={warn} />
              <Pill dot="bg-rose-500" label="Fail" value={fail} />
              {inactiveCount > 0 && <Pill dot="bg-slate-300 dark:bg-slate-600" label="Chưa chấm" value={inactiveCount} />}
            </div>
          </div>
        )}
        {scoredTotal === 0 && inactiveCount > 0 && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {inactiveCount} tiêu chí chưa được chấm — xem trạng thái từng mục bên dưới.
          </p>
        )}
      </header>

      <ul className="p-4 md:p-5 space-y-3">
        {ordered.map((row) => {
          if (row.kind === "scored") return <ChecklistItem key={row.rule.id} check={row.check} />;
          if (row.kind === "disabled")
            return (
              <SkippedRuleItem
                key={row.rule.id}
                label={row.rule.label}
                threshold={row.rule.threshold}
                description={row.rule.description}
                reason="Bạn đã tắt tiêu chí này trong Checklist SEO → không tính vào điểm."
              />
            );
          const check = row.kind === "not-run" ? undefined : row.check;
          return <InactiveItem key={row.rule.id} kind={row.kind} rule={row.rule} check={check} />;
        })}
      </ul>
    </section>
  );
}

const INACTIVE_STYLE = {
  "needs-config": {
    pill: "Chưa có thông tin",
    pillCls:
      "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-700",
    bar: "bg-amber-300 dark:bg-amber-600",
    fallback: "Cần nhập thông tin cấu hình trong Checklist SEO để chấm.",
  },
  "needs-api": {
    pill: "Chưa có API",
    pillCls:
      "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-700",
    bar: "bg-violet-300 dark:bg-violet-600",
    fallback: "Cần GEMINI_API_KEY ở backend để chạy tính năng AI này.",
  },
  "not-run": {
    pill: "Chưa bật",
    pillCls:
      "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-600",
    bar: "bg-slate-300 dark:bg-slate-600",
    fallback: "",
  },
} as const;

function InactiveItem({
  kind,
  rule,
  check,
}: {
  kind: "needs-config" | "needs-api" | "not-run";
  rule: RuleMeta;
  check?: CheckResult;
}) {
  const st = INACTIVE_STYLE[kind];
  const isAi = rule.category === "grammar" || rule.category === "trust-ai";
  const reason =
    check?.detail ||
    (kind === "not-run"
      ? isAi
        ? "Chưa bật — tick ô AI ở form nhập bài để dùng tính năng này."
        : "Không áp dụng cho bài này."
      : st.fallback);
  return (
    <li className="relative overflow-hidden rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 ring-1 ring-slate-200/60 dark:ring-slate-700/60">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="font-medium text-slate-700 dark:text-slate-300 leading-tight">{rule.label}</p>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${st.pillCls}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {st.pill}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{reason}</p>
      </div>
    </li>
  );
}

function Pill({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
      <span className="font-semibold text-slate-900 dark:text-slate-100 num">{value}</span>
    </span>
  );
}
