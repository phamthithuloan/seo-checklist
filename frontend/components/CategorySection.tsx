"use client";

import type { CategoryId, CheckResult } from "@/lib/types";
import ChecklistItem from "./ChecklistItem";

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
    description: "AI proofread bằng Claude Sonnet 4.6 (opt-in, mất phí)",
    Icon: GrammarIcon,
    iconBg: "bg-slate-100",
    iconText: "text-slate-700",
    ringTint: "ring-slate-200",
  },
];

function statusColor(passPct: number) {
  if (passPct === 100) return { ring: "ring-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-500", label: "All passed" };
  if (passPct >= 60) return { ring: "ring-amber-200", text: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-400", label: "Cần cải thiện" };
  return { ring: "ring-rose-200", text: "text-rose-700", bg: "bg-rose-50", bar: "bg-rose-500", label: "Yếu" };
}

export default function CategorySection({
  meta,
  checks,
}: {
  meta: CategoryMeta;
  checks: CheckResult[];
}) {
  if (checks.length === 0) return null;

  const total = checks.length;
  const pass = checks.filter((c) => c.status === "pass").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  const passPct = (pass / total) * 100;
  const warnPct = (warn / total) * 100;
  const failPct = (fail / total) * 100;
  const tone = statusColor(passPct);
  const Icon = meta.Icon;

  return (
    <section id={`cat-${meta.id}`} className="scroll-mt-24 rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 animate-fade-up">
      <header className="px-5 md:px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-11 w-11 rounded-xl${meta.iconBg}${meta.iconText}grid place-items-center ring-1${meta.ringTint}`}>
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
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full ring-1${tone.bg}${tone.text}${tone.ring}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {tone.label}
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 num">
              {pass}/{total}
            </span>
          </div>
        </div>

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
          </div>
        </div>
      </header>

      <ul className="p-4 md:p-5 space-y-3">
        {checks.map((c) => (
          <ChecklistItem key={c.id} check={c} />
        ))}
      </ul>
    </section>
  );
}

function Pill({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full${dot}`} />
      {label}
      <span className="font-semibold text-slate-900 dark:text-slate-100 num">{value}</span>
    </span>
  );
}
