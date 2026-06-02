"use client";

import { useState } from "react";
import { api, ApiError, type CompareResult, type CompetitorMetrics } from "@/lib/api";

type MetricRow = {
  key: keyof CompetitorMetrics;
  label: string;
  /** higher is generally better → flag when yours is below the best competitor */
  moreIsBetter?: boolean;
  kind?: "bool" | "pct";
};

const ROWS: MetricRow[] = [
  { key: "wordCount", label: "Số từ", moreIsBetter: true },
  { key: "h2Count", label: "Số H2", moreIsBetter: true },
  { key: "h3Count", label: "Số H3", moreIsBetter: true },
  { key: "bulletCount", label: "Bullet list", moreIsBetter: true },
  { key: "imageCount", label: "Ảnh", moreIsBetter: true },
  { key: "linkCount", label: "Link", moreIsBetter: true },
  { key: "hasFaq", label: "Có FAQ", kind: "bool" },
  { key: "keywordDensity", label: "Mật độ keyword", kind: "pct" },
];

function fmt(v: number | boolean, kind?: string) {
  if (kind === "bool") return v ? "Có" : "Không";
  if (kind === "pct") return `${v}%`;
  return String(v);
}

export default function CompetitorCompare({
  keyword,
  content,
}: {
  keyword: string;
  content: string;
}) {
  const [urls, setUrls] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  const setUrl = (i: number, v: string) =>
    setUrls((arr) => arr.map((u, idx) => (idx === i ? v : u)));
  const addUrl = () => setUrls((arr) => (arr.length >= 3 ? arr : [...arr, ""]));
  const removeUrl = (i: number) => setUrls((arr) => arr.filter((_, idx) => idx !== i));

  const run = async () => {
    const clean = urls.map((u) => u.trim()).filter(Boolean);
    if (clean.length === 0) {
      setError("Nhập ít nhất 1 URL đối thủ.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await api.analysis.compare({ keyword, content, competitorUrls: clean });
      setResult(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "So sánh thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const okComps = result?.competitors.filter((c) => c.metrics) ?? [];

  return (
    <div id="competitor-compare" className="scroll-mt-24 rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70">
      <div className="px-5 md:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          So sánh với đối thủ
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Dán 1–3 URL bài đối thủ (top Google) — tool đối chiếu cấu trúc để biết bạn cần bổ sung gì.
        </p>
      </div>

      <div className="p-5 md:p-6 space-y-3">
        {urls.map((u, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="url"
              value={u}
              onChange={(e) => setUrl(i, e.target.value)}
              placeholder="https://doi-thu.com/bai-viet"
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
            />
            {urls.length > 1 && (
              <button
                type="button"
                onClick={() => removeUrl(i)}
                className="px-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition"
                aria-label="Xoá"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {urls.length < 3 ? (
            <button type="button" onClick={addUrl} className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
              + Thêm URL
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-medium shadow-glow disabled:opacity-50 transition"
          >
            {loading ? "Đang so sánh…" : "So sánh"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-900/30 ring-1 ring-rose-200 dark:ring-rose-700 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</div>
        )}

        {result && (
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <th className="text-left font-medium px-3 py-2">Chỉ số</th>
                  <th className="text-left font-semibold px-3 py-2 text-brand-700 dark:text-brand-300">Bài của bạn</th>
                  {okComps.map((c, i) => (
                    <th key={i} className="text-left font-medium px-3 py-2 max-w-[180px] truncate" title={c.url}>
                      {c.title || `Đối thủ ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const yours = result.yours[row.key] as number | boolean;
                  const compVals = okComps.map((c) => c.metrics![row.key] as number | boolean);
                  const bestComp = row.moreIsBetter
                    ? Math.max(0, ...compVals.map((v) => Number(v)))
                    : 0;
                  const behind = row.moreIsBetter && Number(yours) < bestComp;
                  return (
                    <tr key={row.key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.label}</td>
                      <td className={`px-3 py-2 num font-semibold ${behind ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>
                        {fmt(yours, row.kind)}
                        {behind && <span className="ml-1 text-[10px] font-medium text-rose-500">↓ thấp hơn</span>}
                      </td>
                      {compVals.map((v, i) => (
                        <td key={i} className="px-3 py-2 num text-slate-700 dark:text-slate-300">{fmt(v, row.kind)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {result && (result.contentGaps.length > 0 || result.aiNote) && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 p-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1 1.3 1 2.1V18h6v-1.2c0-.8.3-1.6 1-2.1A7 7 0 0 0 12 2zM9 22h6M10 18h4" /></svg>
              Nội dung đối thủ có mà bạn thiếu
            </p>
            {result.contentGaps.length > 0 ? (
              <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-200">
                {result.contentGaps.map((g, i) => (
                  <li key={i} className="flex gap-2"><span className="text-amber-500">+</span><span>{g}</span></li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">{result.aiNote}</p>
            )}
          </div>
        )}

        {result?.competitors.some((c) => c.error) && (
          <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
            {result.competitors.filter((c) => c.error).map((c, i) => (
              <p key={i}>⚠ Không đọc được {c.url}: {c.error}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
