"use client";

import { useState } from "react";
import type {
  OutlineAIAnalysis,
  OutlineComparison,
  OutlineDepthVerdict,
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
    pill: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-700",
    bar: "bg-emerald-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l4 4L19 7" />
      </svg>
    ),
  },
  missing: {
    label: "Thiếu",
    pill: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-700",
    bar: "bg-rose-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    ),
  },
  extra: {
    label: "Thừa",
    pill: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-700",
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

const DEPTH_META: Record<OutlineDepthVerdict, { label: string; pill: string }> = {
  sketchy: {
    label: "Sơ sài",
    pill: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-700",
  },
  adequate: {
    label: "Đầy đủ",
    pill: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-700",
  },
  detailed: {
    label: "Chuyên sâu",
    pill: "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-brand-200 dark:ring-brand-700",
  },
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

function levelIndent(level: number): string {
  return `pl-${Math.min(8, (level - 1) * 4)}`;
}

export default function OutlineComparisonView({ comparison }: Props) {
  const {
    totalOutlineHeadings,
    totalContentHeadings,
    matched,
    missing,
    extra,
    headings,
    aiAnalysis,
    aiReasonUnavailable,
  } = comparison;

  const coverage =
    totalOutlineHeadings > 0
      ? Math.round((matched / totalOutlineHeadings) * 100)
      : 0;

  const [headingsOpen, setHeadingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 animate-fade-up">
      <header className="px-5 md:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              So sánh với Outline
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {totalOutlineHeadings} heading trong outline · {totalContentHeadings} trong bài
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${
              coverage >= 80
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-700"
                : coverage >= 50
                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-700"
                : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-700"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Heading coverage <span className="num">{coverage}%</span>
          </span>
        </div>
      </header>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {/* Section A: heading match details (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setHeadingsOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 md:px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ChevronIcon open={headingsOpen} />
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Cấu trúc heading (H2 / H3)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  So khớp từng heading: trùng / thiếu / thừa, kèm độ dài & format mong muốn.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
              <Pill dot="bg-emerald-500" label="Match" value={matched} />
              <Pill dot="bg-rose-500" label="Thiếu" value={missing} />
              <Pill dot="bg-amber-400" label="Thừa" value={extra} />
            </div>
          </button>

          {headingsOpen && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
              {headings.map((h, idx) => (
                <HeadingRow key={idx} heading={h} />
              ))}
            </ul>
          )}
        </div>

        {/* Section B: AI follow-through analysis (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setAiOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 md:px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ChevronIcon open={aiOpen} />
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Bài viết có follow outline không? (AI)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Phân tích semantic: format, độ phủ thông tin, chiều sâu — Claude Sonnet 4.6.
                </p>
              </div>
            </div>
            {aiAnalysis && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 num shrink-0">
                Coverage <span className="font-semibold text-slate-900 dark:text-slate-100">{aiAnalysis.infoCoverageScore}%</span>
              </span>
            )}
          </button>

          {aiOpen && (
            <div className="px-5 md:px-6 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4">
              {aiAnalysis ? (
                <AIAnalysisBlock ai={aiAnalysis} />
              ) : (
                <AIUnavailableBlock reason={aiReasonUnavailable} />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AIAnalysisBlock({ ai }: { ai: OutlineAIAnalysis }) {
  const depth = DEPTH_META[ai.depthVerdict];
  return (
    <div className="space-y-5">
      {/* A. Format followed */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${
              ai.formatFollowed
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-700"
                : "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-700"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {ai.formatFollowed ? "Format OK" : "Format mismatch"}
          </span>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Cách trình bày (bảng / bullet / text)
          </p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{ai.formatNotes}</p>
      </div>

      {/* B. Info coverage */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Độ phủ thông tin
          </p>
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 num">
            {ai.infoCoverageScore} / 100
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full ${
              ai.infoCoverageScore >= 80
                ? "bg-emerald-500"
                : ai.infoCoverageScore >= 50
                ? "bg-amber-400"
                : "bg-rose-500"
            }`}
            style={{ width: `${ai.infoCoverageScore}%` }}
          />
        </div>
        {ai.missingPoints.length > 0 ? (
          <div className="rounded-xl bg-rose-50/70 dark:bg-rose-900/20 ring-1 ring-rose-200 dark:ring-rose-800 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-1.5">
              Outline yêu cầu nhưng bài chưa cover ({ai.missingPoints.length})
            </p>
            <ul className="text-xs text-rose-700 dark:text-rose-300 space-y-1 list-disc list-inside">
              {ai.missingPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            ✓ Bài viết cover đầy đủ các điểm thông tin outline đề cập.
          </p>
        )}
      </div>

      {/* C. Depth */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${depth.pill}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {depth.label}
          </span>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Chiều sâu so với outline
          </p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{ai.depthSummary}</p>
        {ai.extraDepthPoints.length > 0 && (
          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1.5">
              Bài triển khai sâu hơn outline ({ai.extraDepthPoints.length})
            </p>
            <ul className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1 list-disc list-inside">
              {ai.extraDepthPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function AIUnavailableBlock({ reason }: { reason?: string | null }) {
  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 p-4">
      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
        ⚠ Phân tích follow-through outline chưa chạy
      </p>
      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
        {reason ||
          "Tính năng cần ANTHROPIC_API_KEY trên backend. Admin cấu hình xong, các bài phân tích tiếp theo sẽ có phần này."}
      </p>
    </div>
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
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.bar}`} />
      <div className={`px-5 md:px-6 py-3.5 ${indent}`}>
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
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 shrink-0 ${meta.pill}`}
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
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
      <span className="font-semibold text-slate-900 dark:text-slate-100 num">{value}</span>
    </span>
  );
}
