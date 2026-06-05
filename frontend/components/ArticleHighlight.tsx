"use client";

import { useMemo, useState } from "react";
import type { CheckResult } from "@/lib/types";

type Match = { start: number; end: number; status: "fail" | "warn"; tip: string; ruleId: string };

const HIGHLIGHT_KINDS = new Set(["sentence", "paragraph", "quote", "word"]);

/** Render the article as plain text with offending sentences/quotes highlighted
 *  (rose = Fail, amber = Warn). Hover a mark to see the rule + note. */
export default function ArticleHighlight({
  content,
  checks,
}: {
  content: string;
  checks: CheckResult[];
}) {
  const [open, setOpen] = useState(false);

  const { matches, count } = useMemo(() => {
    const found: Match[] = [];
    for (const c of checks) {
      if (c.inactive || c.status === "pass") continue;
      for (const it of c.issues || []) {
        if (!HIGHLIGHT_KINDS.has(it.kind)) continue;
        const needle = (it.text || "").replace(/[…….\s]+$/, "").trim();
        if (needle.length < 4) continue;
        let idx = content.indexOf(needle);
        let len = needle.length;
        if (idx === -1 && needle.length > 60) {
          const probe = needle.slice(0, 60);
          idx = content.indexOf(probe);
          len = probe.length;
        }
        if (idx === -1) continue;
        found.push({
          start: idx,
          end: idx + len,
          status: c.status === "fail" ? "fail" : "warn",
          tip: `${c.label}${it.note ? " — " + it.note : ""} (bấm để tới tiêu chí)`,
          ruleId: c.id,
        });
      }
    }
    // sort by start, fail before warn at same spot, drop overlaps
    found.sort((a, b) => a.start - b.start || (a.status === "fail" ? -1 : 1));
    const merged: Match[] = [];
    let lastEnd = 0;
    for (const m of found) {
      if (m.start < lastEnd) continue;
      merged.push(m);
      lastEnd = m.end;
    }
    return { matches: merged, count: merged.length };
  }, [content, checks]);

  if (count === 0) return null;

  const segments: { text: string; m?: Match }[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) segments.push({ text: content.slice(cursor, m.start) });
    segments.push({ text: content.slice(m.start, m.end), m });
    cursor = m.end;
  }
  if (cursor < content.length) segments.push({ text: content.slice(cursor) });

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 md:px-6 py-4 flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 grid place-items-center ring-1 ring-amber-100 dark:ring-amber-800 shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Xem bài với lỗi được tô màu</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {count} đoạn · <span className="text-rose-600 dark:text-rose-400">đỏ = Fail</span>, <span className="text-amber-600 dark:text-amber-400">vàng = Warn</span> · di chuột để xem lỗi, bấm để tới tiêu chí
            </p>
          </div>
        </div>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {open && (
        <div className="px-5 md:px-6 pb-5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-h-[28rem] overflow-y-auto">
            {segments.map((s, i) =>
              s.m ? (
                <mark
                  key={i}
                  title={s.m.tip}
                  onClick={() => {
                    const el = document.getElementById(`check-${s.m!.ruleId}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`rounded px-0.5 cursor-pointer hover:ring-2 hover:ring-offset-1 ${
                    s.m.status === "fail"
                      ? "bg-rose-200/70 dark:bg-rose-500/30 hover:ring-rose-400 text-inherit"
                      : "bg-amber-200/70 dark:bg-amber-500/30 hover:ring-amber-400 text-inherit"
                  }`}
                >
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
