"use client";

import type {
  OutlineComparison,
  OutlineFormat,
  OutlineHeading,
  OutlineHeadingStatus,
} from "@/lib/types";

interface Props {
  comparison: OutlineComparison;
}

const STATUS_META: Record<
  OutlineHeadingStatus,
  { label: string; pill: string; bar: string; icon: JSX.Element }
> = {
  match: {
    label: "Match",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    bar: "bg-emerald-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l4 4L19 7" />
      </svg>
    ),
  },
  missing: {
    label: "Thiếu",
    pill: "bg-rose-50 text-rose-700 ring-rose-200",
    bar: "bg-rose-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    ),
  },
  extra: {
    label: "Thừa",
    pill: "bg-amber-50 text-amber-700 ring-amber-200",
    bar: "bg-amber-400",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
};

const FORMAT_LABEL: Record<OutlineFormat, string> = {
  text: "Text",
  bullet: "Bullet",
  table: "Bảng",
  mixed: "Mixed",
  empty: "Trống",
};

function levelIndent(level: number): string {
  return `pl-${Math.min(8, (level - 1) * 4)}`;
}

export default function OutlineComparisonView({ comparison }: Props) {
  const { totalOutlineHeadings, totalContentHeadings, matched, missing, extra, headings } =
    comparison;

  const coverage =
    totalOutlineHeadings > 0
      ? Math.round((matched / totalOutlineHeadings) * 100)
      : 0;

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 animate-fade-up">
      <header className="px-5 md:px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              So sánh với Outline
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {totalOutlineHeadings} heading trong outline · {totalContentHeadings} trong bài
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ring-1${
                coverage >= 80
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : coverage >= 50
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Coverage <span className="num">{coverage}%</span>
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Pill dot="bg-emerald-500" label="Match" value={matched} />
          <Pill dot="bg-rose-500" label="Thiếu" value={missing} />
          <Pill dot="bg-amber-400" label="Thừa" value={extra} />
        </div>
      </header>

      <ul className="divide-y divide-slate-100">
        {headings.map((h, idx) => (
          <HeadingRow key={idx} heading={h} />
        ))}
      </ul>
    </section>
  );
}

function HeadingRow({ heading }: { heading: OutlineHeading }) {
  const meta = STATUS_META[heading.status];
  const indent = levelIndent(heading.level);

  const wordCmp =
    heading.actualWords !== null && heading.actualWords !== undefined
      ? `${heading.actualWords}${heading.targetWords ? ` / ${heading.targetWords}` : ""} từ`
      : heading.targetWords
      ? `${heading.targetWords} từ target`
      : null;

  const fmtCmp =
    heading.actualFormat && heading.targetFormat
      ? `${FORMAT_LABEL[heading.actualFormat]} / ${FORMAT_LABEL[heading.targetFormat]}`
      : heading.actualFormat
      ? FORMAT_LABEL[heading.actualFormat]
      : heading.targetFormat
      ? `${FORMAT_LABEL[heading.targetFormat]} target`
      : null;

  return (
    <li className="relative">
      <span className={`absolute left-0 top-0 bottom-0 w-1${meta.bar}`} />
      <div className={`px-5 md:px-6 py-3.5${indent}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1 shrink-0">
              H{heading.level}
            </span>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">
              {heading.title}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 shrink-0${meta.pill}`}
          >
            {meta.icon}
            {meta.label}
          </span>
        </div>

        {(wordCmp || fmtCmp) && (
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
            {wordCmp && (
              <span className="font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {wordCmp}
              </span>
            )}
            {fmtCmp && (
              <span className="font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {fmtCmp}
              </span>
            )}
          </div>
        )}

        {heading.note && (
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 italic">⚠ {heading.note}</p>
        )}
      </div>
    </li>
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
