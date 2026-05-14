"use client";

import { useState } from "react";
import type { CheckIssue, CheckResult, IssueKind } from "@/lib/types";

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l4 4L19 7" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.86l-8.1 14a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3l-8.1-14a2 2 0 0 0-3.4 0z" />
  </svg>
);
const BulbIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1 1.3 1 2.1V18h6v-1.2c0-.8.3-1.6 1-2.1A7 7 0 0 0 12 2z" />
  </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const STATUS = {
  pass: {
    Icon: CheckIcon,
    iconBg: "bg-emerald-500",
    iconText: "text-white",
    pillBg: "bg-emerald-50",
    pillText: "text-emerald-700",
    pillRing: "ring-emerald-200",
    label: "Pass",
    leftBar: "bg-emerald-500",
  },
  fail: {
    Icon: XIcon,
    iconBg: "bg-rose-500",
    iconText: "text-white",
    pillBg: "bg-rose-50",
    pillText: "text-rose-700",
    pillRing: "ring-rose-200",
    label: "Fail",
    leftBar: "bg-rose-500",
  },
  warn: {
    Icon: WarnIcon,
    iconBg: "bg-amber-400",
    iconText: "text-white",
    pillBg: "bg-amber-50",
    pillText: "text-amber-700",
    pillRing: "ring-amber-200",
    label: "Warning",
    leftBar: "bg-amber-400",
  },
} as const;

const KIND_LABEL: Record<IssueKind, string> = {
  sentence: "Câu",
  paragraph: "Đoạn",
  heading: "Heading",
  link: "Link",
  word: "Từ",
  quote: "Trích dẫn",
  text: "",
};

export default function ChecklistItem({ check }: { check: CheckResult }) {
  const s = STATUS[check.status];
  const Icon = s.Icon;
  const issues = check.issues || [];
  const hasIssues = issues.length > 0;
  const [open, setOpen] = useState(false);

  return (
    <li id={`check-${check.id}`} className="scroll-mt-24 group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 hover:ring-slate-300 transition">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.leftBar}`} />
      <div className="p-5 pl-6 flex gap-4">
        <div className={`h-9 w-9 shrink-0 rounded-xl ${s.iconBg} ${s.iconText} grid place-items-center shadow-sm`}>
          <Icon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{check.label}</p>
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${s.pillBg} ${s.pillText} ${s.pillRing}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {s.label}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{check.detail}</p>

          {hasIssues && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <ChevronIcon open={open} />
                {open ? "Ẩn" : "Xem"} {issues.length} điểm chi tiết
              </button>
              {open && (
                <ul className="mt-2.5 space-y-1.5">
                  {issues.map((it, idx) => (
                    <IssueRow key={idx} issue={it} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {check.recommendation && (
            <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-100 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex gap-2 items-start">
                <span className="text-brand-500 mt-0.5 shrink-0">
                  <BulbIcon />
                </span>
                <p className="whitespace-pre-line">
                  <span className="font-medium text-slate-900 dark:text-slate-100">Gợi ý: </span>
                  {check.recommendation}
                </p>
              </div>
              {check.example && (
                <pre className="mt-2.5 ml-6 overflow-x-auto rounded-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-2 text-[12.5px] leading-relaxed font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
{check.example}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function SkippedRuleItem({
  label,
  threshold,
  description,
  reason,
}: {
  label: string;
  threshold?: string;
  description?: string;
  reason: string;
}) {
  return (
    <li className="group relative overflow-hidden rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 ring-1 ring-slate-200/60 dark:ring-slate-700/60 opacity-60">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 dark:bg-slate-600" />
      <div className="p-4 pl-5 flex gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 grid place-items-center">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="font-medium text-slate-700 dark:text-slate-300 leading-tight line-through decoration-slate-300 decoration-1">
              {label}
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Bỏ qua
            </span>
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {description}
              {threshold && <span className="ml-1 num">({threshold})</span>}
            </p>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 italic">
            {reason}
          </p>
        </div>
      </div>
    </li>
  );
}

function IssueRow({ issue }: { issue: CheckIssue }) {
  const kindLabel = KIND_LABEL[issue.kind];
  const isCode = issue.kind === "sentence" || issue.kind === "paragraph" || issue.kind === "quote" || issue.kind === "link";
  return (
    <li className="rounded-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-2 text-sm">
      <div className="flex items-start gap-2.5">
        {kindLabel && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5 min-w-[55px]">
            {kindLabel}
          </span>
        )}
        <span
          className={`flex-1 min-w-0 break-words ${isCode ? "font-mono text-[12.5px] text-slate-700" : "text-slate-700"}`}
        >
          {issue.text}
        </span>
        {issue.note && (
          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-700 mt-0.5">
            {issue.note}
          </span>
        )}
      </div>
    </li>
  );
}
