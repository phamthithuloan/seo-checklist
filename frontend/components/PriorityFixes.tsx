"use client";

import type { CheckResult } from "@/lib/types";

/** Top issues to fix first — Fail before Warn, excludes inactive (not scored). */
export default function PriorityFixes({ checks }: { checks: CheckResult[] }) {
  const ranked = checks
    .filter((c) => !c.inactive && (c.status === "fail" || c.status === "warn"))
    .sort((a, b) => (a.status === "fail" ? 0 : 1) - (b.status === "fail" ? 0 : 1))
    .slice(0, 6);

  const jump = (id: string) => {
    const el = document.getElementById(`check-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 px-5 py-4 flex items-center gap-3">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500 text-white grid place-items-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4 4L19 7" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Không còn lỗi cần sửa gấp 🎉</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Các tiêu chí đã chấm đều Pass. Xem chi tiết bên dưới.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70">
      <div className="px-5 md:px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 grid place-items-center ring-1 ring-rose-100 dark:ring-rose-800">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 20h20z" /><path d="M12 9v5M12 17h.01" />
          </svg>
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sửa gì trước</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{ranked.length} mục ưu tiên — xử lý Fail trước, rồi Warn.</p>
        </div>
      </div>
      <ol className="p-3 md:p-4 space-y-1.5">
        {ranked.map((c, i) => {
          const isFail = c.status === "fail";
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => jump(c.id)}
                className="w-full text-left flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition group"
              >
                <span className={`mt-0.5 shrink-0 h-5 w-5 grid place-items-center rounded-md text-[11px] font-bold text-white ${isFail ? "bg-rose-500" : "bg-amber-400"}`}>
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.label}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${isFail ? "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300" : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"}`}>
                      {isFail ? "Fail" : "Warn"}
                    </span>
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{c.detail}</span>
                </span>
                <span className="shrink-0 self-center text-slate-300 dark:text-slate-600 group-hover:text-brand-500 transition">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
