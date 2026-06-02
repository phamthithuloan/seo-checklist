"use client";

import { useEffect, useState } from "react";

/** Shown while an analysis is running. Gives a live elapsed timer + the steps
 *  in progress so the user knows it's working (AI steps can take 10-30s). */
export default function AnalyzingCard({ aiOn }: { aiOn: boolean }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const steps = [
    "Chấm 43 tiêu chí cấu trúc (tức thì)",
    ...(aiOn
      ? [
          "Gọi AI: ngữ pháp & chính tả",
          "Gọi AI: fact-check (Google Search)",
          "Gọi AI: đối chiếu outline",
        ]
      : []),
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 p-6">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="h-6 w-6 animate-spin text-brand-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.2-8.55" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Đang phân tích… <span className="num">{sec}s</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {aiOn
              ? "Các bước AI có thể mất 10–30s (tuỳ tải Gemini). Cứ chờ nhé."
              : "Gần xong rồi."}
          </p>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 animate-pulse" />
      </div>

      <ul className="mt-4 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
