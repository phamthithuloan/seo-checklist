"use client";

import { useState } from "react";
import { api, ApiError, type AnalysisOut } from "@/lib/api";

/** AI rewrites the article fixing flagged issues → preview + download .md/.html,
 *  then re-score the fixed article to confirm it improved. */
export default function AutoFix({
  result,
  aiProofread,
  aiContentAudit,
}: {
  result: AnalysisOut;
  aiProofread: boolean;
  aiContentAudit: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixed, setFixed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [recheck, setRecheck] = useState<AnalysisOut | null>(null);
  const [recheckError, setRecheckError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setLoading(true);
    setFixed(null);
    // Send the failing/warn checks as targeted instructions.
    const issues = result.checks
      .filter((c) => !c.inactive && c.status !== "pass")
      .map((c) => `${c.label}: ${c.recommendation || c.detail}`)
      .slice(0, 30);
    try {
      const r = await api.analysis.autofix({
        keyword: result.keyword,
        content: result.content,
        issues,
      });
      setFixed(r.content);
      setRecheck(null);
      setRecheckError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Tự động sửa thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const recheckFixed = async () => {
    if (!fixed) return;
    setRecheckError(null);
    setRechecking(true);
    try {
      const r = await api.analysis.create({
        keyword: result.keyword,
        metaDescription: result.metaDescription || "",
        content: fixed,
        sourceType: "paste",
        title: result.title ? `${result.title} (đã sửa)` : undefined,
        aiProofread: aiProofread || undefined,
        aiContentAudit: aiContentAudit || undefined,
      });
      setRecheck(r);
    } catch (e) {
      setRecheckError(e instanceof ApiError ? e.detail : "Chấm lại thất bại.");
    } finally {
      setRechecking(false);
    }
  };

  const download = (kind: "md" | "html") => {
    if (!fixed) return;
    const name = (result.title || result.keyword || "bai-viet").replace(/[^\w-]+/g, "-").slice(0, 60);
    const blob =
      kind === "md"
        ? new Blob([fixed], { type: "text/markdown;charset=utf-8" })
        : new Blob(
            [`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${name}</title></head><body><pre style="white-space:pre-wrap;font-family:-apple-system,sans-serif;line-height:1.6">${fixed.replace(/</g, "&lt;")}</pre></body></html>`],
            { type: "text/html;charset=utf-8" },
          );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-da-sua.${kind}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (!fixed) return;
    await navigator.clipboard.writeText(fixed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div id="auto-fix" className="scroll-mt-24 rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70">
      <div className="px-5 md:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Tự động sửa bài (AI)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gemini viết lại bài, sửa các lỗi đã chấm (chính tả, văn phong, cấu trúc) — giữ nguyên ý &amp; nguồn. Không bịa số liệu mới.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-medium shadow-glow disabled:opacity-50 transition shrink-0"
        >
          {loading ? "Đang sửa…" : fixed ? "Sửa lại" : "✦ Tự động sửa"}
        </button>
      </div>

      <div className="p-5 md:p-6 space-y-3">
        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-900/30 ring-1 ring-rose-200 dark:ring-rose-700 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</div>
        )}
        {loading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Gemini đang viết lại bài… 10–30s (có thể lâu hơn ~1 phút nếu đang chờ giới hạn free tier reset — cứ chờ nhé).</p>
        )}
        {fixed && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => download("md")} className="text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Tải .md</button>
              <button type="button" onClick={() => download("html")} className="text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">Tải .html</button>
              <button type="button" onClick={copy} className="text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">{copied ? "Đã copy ✓" : "Copy"}</button>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto">
              {fixed}
            </div>

            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={recheckFixed}
                disabled={rechecking}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl ring-1 ring-brand-200 dark:ring-brand-700 text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-sm font-medium disabled:opacity-50 transition"
              >
                {rechecking ? "Đang chấm lại…" : "↻ Chấm lại bài đã sửa"}
              </button>
              {recheckError && (
                <div className="mt-2 rounded-lg bg-rose-50 dark:bg-rose-900/30 ring-1 ring-rose-200 dark:ring-rose-700 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{recheckError}</div>
              )}
              {recheck &&
                (() => {
                  const up = recheck.score >= result.score;
                  const fails = recheck.checks.filter((c) => !c.inactive && c.status === "fail");
                  return (
                    <div className="mt-3 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 p-4 bg-white dark:bg-slate-900">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        Bài đã sửa: điểm{" "}
                        <span className="num text-slate-500">{result.score}</span>
                        {" → "}
                        <span className={`num font-bold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {recheck.score}
                        </span>
                        <span className="text-slate-400">/100</span>{" "}
                        {up ? "▲" : "▼"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Pass {recheck.passCount} · Warn {recheck.warnCount} · Fail {recheck.failCount}
                        {fails.length === 0 ? " — không còn lỗi Fail 🎉" : ""}
                      </p>
                      {fails.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          {fails.slice(0, 8).map((c) => (
                            <li key={c.id} className="flex gap-2">
                              <span className="text-rose-500">✕</span>
                              <span>{c.label} — {c.detail}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
