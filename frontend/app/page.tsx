"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { type ViewMode } from "@/components/Sidebar";
import InputForm from "@/components/InputForm";
import ScoreCard from "@/components/ScoreCard";
import CategorySection, { CATEGORIES, type StatusFilter } from "@/components/CategorySection";
import PriorityFixes from "@/components/PriorityFixes";
import ArticleHighlight from "@/components/ArticleHighlight";
import CompetitorCompare from "@/components/CompetitorCompare";
import AnalyzingCard from "@/components/AnalyzingCard";
import HistoryList from "@/components/HistoryList";
import ChecklistSettings from "@/components/ChecklistSettings";
import OutlineInput from "@/components/OutlineInput";
import OutlineComparisonView from "@/components/OutlineComparisonView";
import SettingsView from "@/components/SettingsView";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type AnalysisOut, type SourceType } from "@/lib/api";
import {
  compactConfig,
  configHasValue,
  getConfig,
  getEnabledRules,
} from "@/lib/checklist-prefs";
import { ALL_RULES, ALL_RULE_IDS } from "@/lib/checklist-rules";

export default function Page() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const [view, setView] = useState<ViewMode>("review");

  /* Form state */
  const [keyword, setKeyword] = useState("");
  const [meta, setMeta] = useState("");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("paste");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [outline, setOutline] = useState("");
  const [aiProofread, setAiProofread] = useState(false);
  const [aiContentAudit, setAiContentAudit] = useState(false);

  /* Result / flow */
  const [result, setResult] = useState<AnalysisOut | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<StatusFilter>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const handleAnalyze = async () => {
    setAnalyzeError(null);
    const enabled = new Set(getEnabledRules());
    const rawCfg = getConfig();

    // Skip config rules whose input is empty — user intent: don't show
    // "chưa cấu hình" warns when checkbox is ticked but field is blank.
    const effectiveEnabled = ALL_RULE_IDS.filter((id) => {
      if (!enabled.has(id)) return false;
      const rule = ALL_RULES.find((r) => r.id === id);
      if (!rule || rule.kind !== "config") return true;
      return rule.configField ? configHasValue(rawCfg, rule.configField) : false;
    });

    if (effectiveEnabled.length === 0) {
      setAnalyzeError(
        "Không có tiêu chí nào để chấm. Mở Checklist SEO bật rule auto hoặc nhập input cho rule config.",
      );
      return;
    }

    const cfg = compactConfig(rawCfg);
    setAnalyzing(true);
    try {
      const data = await api.analysis.create({
        keyword: keyword.trim(),
        metaDescription: meta,
        content,
        sourceType,
        sourceUrl: sourceUrl || undefined,
        title: title || undefined,
        enabledChecks:
          effectiveEnabled.length === ALL_RULE_IDS.length
            ? undefined
            : effectiveEnabled,
        config: Object.keys(cfg).length > 0 ? cfg : undefined,
        outline: outline.trim() ? outline : undefined,
        aiProofread: aiProofread || undefined,
        aiContentAudit: aiContentAudit || undefined,
      });
      setResult(data);
      setResultVersion((v) => v + 1);
      setHistoryVersion((v) => v + 1);
    } catch (err) {
      setAnalyzeError(
        err instanceof ApiError ? err.detail : "Phân tích thất bại.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClear = () => {
    setKeyword("");
    setMeta("");
    setContent("");
    setTitle(null);
    setSourceType("paste");
    setSourceUrl(null);
    setOutline("");
    setResult(null);
    setAnalyzeError(null);
    setResultVersion((v) => v + 1);
  };

  const handleChangeView = (v: ViewMode) => {
    // Clicking "Review bài viết" while a finished analysis is shown (e.g. one
    // opened from history) should start a fresh analysis — clear the old result
    // and form. While still drafting (no result yet), keep the typed content.
    if (v === "review" && result) {
      handleClear();
    }
    setView(v);
  };

  const handleOpenFromHistory = async (id: string) => {
    setView("review");
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const data = await api.analysis.get(id);
      setKeyword(data.keyword);
      setMeta(data.metaDescription);
      setContent(data.content);
      setTitle(data.title);
      setSourceType(data.sourceType);
      setSourceUrl(data.sourceUrl);
      setOutline(data.outline || "");
      setResult(data);
      setResultVersion((v) => v + 1);
    } catch (err) {
      setAnalyzeError(
        err instanceof ApiError ? err.detail : "Không tải được bài.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-slate-500 dark:text-slate-400">
        Đang tải…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        view={view}
        onChangeView={handleChangeView}
        resultVersion={resultVersion}
      />

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-700/70">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                {view === "review"
                  ? "MindGate · Review"
                  : view === "history"
                  ? "MindGate · Lịch sử"
                  : view === "checklist"
                  ? "MindGate · Checklist"
                  : "MindGate · Cài đặt"}
              </p>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {view === "review"
                  ? "Content Checklist"
                  : view === "history"
                  ? "Bài đã phân tích"
                  : view === "checklist"
                  ? "Tiêu chí áp dụng"
                  : "Tài khoản & Tuỳ chỉnh"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {view === "review" && result && (
                <ExportMenu analysisId={result.id} result={result} />
              )}
              <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Online
              </span>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">
          {view === "review" ? (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Phân tích bài viết SEO
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Dán bài viết và nhập từ khóa chính. Hệ thống có 43 tiêu chí (tự động, cấu hình, AI) — chỉ tính điểm các tiêu chí áp dụng cho bài.
                </p>
              </div>

              <InputForm
                keyword={keyword}
                meta={meta}
                content={content}
                title={title}
                sourceType={sourceType}
                aiProofread={aiProofread}
                aiContentAudit={aiContentAudit}
                onKeywordChange={setKeyword}
                onMetaChange={setMeta}
                onContentChange={setContent}
                onTitleChange={setTitle}
                onSourceTypeChange={setSourceType}
                onSourceUrlChange={setSourceUrl}
                onAiProofreadChange={setAiProofread}
                onAiContentAuditChange={setAiContentAudit}
                onAnalyze={handleAnalyze}
                onClear={handleClear}
                analyzing={analyzing}
                error={analyzeError}
              />

              <OutlineInput outline={outline} onOutlineChange={setOutline} />

              {analyzing ? (
                <AnalyzingCard aiOn={aiProofread || aiContentAudit || !!outline.trim()} />
              ) : result ? (
                <>
                  <div id="overview" className="scroll-mt-24">
                    <ScoreCard result={result} />
                  </div>

                  <PriorityFixes checks={result.checks} />

                  <ArticleHighlight content={result.content} checks={result.checks} />

                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                        Checklist chi tiết
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {result.totalChecks}/{ALL_RULE_IDS.length} tiêu chí được chấm điểm — các mục chưa chạy hiện riêng, không tính điểm.
                      </p>
                    </div>
                    <div className="inline-flex rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 p-0.5 bg-white dark:bg-slate-900 text-xs font-medium">
                      {([
                        ["all", "Tất cả"],
                        ["todo", "Cần sửa"],
                        ["fail", "Chỉ Fail"],
                      ] as const).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setReviewFilter(val)}
                          className={`px-3 py-1.5 rounded-lg transition ${
                            reviewFilter === val
                              ? "bg-brand-500 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    {(() => {
                      const enabled = new Set(getEnabledRules());
                      const disabled = new Set(
                        ALL_RULE_IDS.filter((id) => !enabled.has(id)),
                      );
                      return CATEGORIES.map((cat) => (
                        <CategorySection
                          key={cat.id}
                          meta={cat}
                          checks={result.checks.filter(
                            (c) => c.category === cat.id,
                          )}
                          disabledRuleIds={disabled}
                          statusFilter={reviewFilter}
                        />
                      ));
                    })()}
                  </div>

                  {result.outlineComparison && (
                    <div id="outline-comparison" className="scroll-mt-24">
                      <OutlineComparisonView
                        comparison={result.outlineComparison}
                      />
                    </div>
                  )}

                  <CompetitorCompare keyword={result.keyword} content={result.content} />
                </>
              ) : (
                <EmptyState />
              )}
            </>
          ) : view === "settings" ? (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Cài đặt
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Tài khoản, hiển thị, thông báo.
                </p>
              </div>
              <SettingsView />
            </>
          ) : view === "history" ? (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Lịch sử kiểm tra
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Click một bài để mở lại điểm chi tiết + recommendation.
                </p>
              </div>
              <HistoryList
                refreshKey={historyVersion}
                onOpen={handleOpenFromHistory}
              />
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Checklist SEO
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Chọn tiêu chí muốn áp dụng. Lựa chọn lưu trên trình duyệt và áp dụng cho các lần phân tích tiếp theo.
                </p>
              </div>
              <ChecklistSettings />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const PDF_CAT_LABELS: Record<string, string> = {
  technical: "Technical SEO",
  readability: "Tốt cho người đọc",
  "ul-li": "UL-LI",
  "ai-opt": "Tối ưu cho AI",
  branding: "Branding",
  eeat: "E-E-A-T",
  grammar: "Ngữ pháp - Chính tả",
  "trust-ai": "Tin cậy & Kiểm chứng AI",
  cta: "CTA",
};

function buildPrintHtml(r: AnalysisOut): string {
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scored = r.checks.filter((c) => !c.inactive);
  const cats = Array.from(new Set(r.checks.map((c) => c.category)));
  const badge = (c: { status: string; inactive?: string | null }) => {
    if (c.inactive) return `<span style="color:#94a3b8">○ Chưa chấm</span>`;
    if (c.status === "pass") return `<span style="color:#059669">✓ Pass</span>`;
    if (c.status === "warn") return `<span style="color:#d97706">▲ Warn</span>`;
    return `<span style="color:#e11d48">✕ Fail</span>`;
  };
  const sections = cats
    .map((cat) => {
      const items = r.checks.filter((c) => c.category === cat);
      if (!items.length) return "";
      const rows = items
        .map((c) => {
          const rec =
            c.status !== "pass" && c.recommendation
              ? `<div style="margin-top:4px;color:#0e7490;font-size:12px"><b>→ Cách sửa:</b> ${esc(c.recommendation)}</div>`
              : "";
          const iss = (c.issues || []).slice(0, 8);
          const issHtml = iss.length
            ? `<ul style="margin:4px 0 0;padding-left:16px;color:#64748b;font-size:12px">${iss
                .map(
                  (it) =>
                    `<li>${esc((it.text || "").slice(0, 200))}${it.note ? ` <i>— ${esc(it.note)}</i>` : ""}</li>`,
                )
                .join("")}</ul>`
            : "";
          return `<tr><td style="padding:6px 10px;white-space:nowrap;vertical-align:top">${badge(c)}</td><td style="padding:6px 10px"><b>${esc(c.label)}</b><br><span style="color:#475569;font-size:12px">${esc(c.detail)}</span>${rec}${issHtml}</td></tr>`;
        })
        .join("");
      return `<h3 style="margin:18px 0 6px;color:#0f172a">${esc(PDF_CAT_LABELS[cat] || cat)}</h3><table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>`;
    })
    .join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo SEO — ${esc(r.title || r.keyword)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:820px;margin:24px auto;padding:0 20px;line-height:1.5}
h1{font-size:22px;margin:0 0 4px}.muted{color:#64748b;font-size:13px}
.score{display:inline-block;font-size:34px;font-weight:700;color:#0e7490}
.sum{margin:10px 0 4px;font-size:14px}tr{border-top:1px solid #f1f5f9}
@media print{body{margin:0}}</style></head><body>
<h1>Báo cáo SEO — ${esc(r.title || r.keyword)}</h1>
<p class="muted">Từ khoá: <b>${esc(r.keyword)}</b> · ${r.wordCount} từ · mật độ ${r.keywordDensity}%</p>
<p><span class="score">${r.score}</span><span class="muted">/100</span></p>
<p class="sum">Chấm ${scored.length} tiêu chí — <b style="color:#059669">${r.passCount} Pass</b> · <b style="color:#d97706">${r.warnCount} Warn</b> · <b style="color:#e11d48">${r.failCount} Fail</b></p>
<p class="muted">Điểm = (Pass×1 + Warn×0,5 + Fail×0) ÷ ${scored.length} × 100 = ${r.score}/100. Dưới đây là chi tiết từng tiêu chí kèm cách sửa.</p>
${sections}
<p class="muted" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px">MindGate · SEO Content Reviewer</p>
</body></html>`;
}

function ExportMenu({ analysisId, result }: { analysisId: string; result: AnalysisOut }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async (format: "markdown" | "html") => {
    setOpen(false);
    setError(null);
    setBusy(true);
    try {
      await api.analysis.downloadExport(analysisId, format);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Export thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const printPdf = () => {
    setOpen(false);
    const w = window.open("", "_blank");
    if (!w) {
      setError("Trình duyệt chặn cửa sổ in — cho phép pop-up rồi thử lại.");
      return;
    }
    w.document.write(buildPrintHtml(result));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </svg>
        {busy ? "Đang xuất..." : "Export"}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden z-20">
          <button
            type="button"
            onClick={printPdf}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            PDF (in / lưu PDF)
          </button>
          <button
            type="button"
            onClick={() => download("markdown")}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Markdown (.md)
          </button>
          <button
            type="button"
            onClick={() => download("html")}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            HTML (.html)
          </button>
        </div>
      )}
      {error && (
        <div className="absolute right-0 top-full mt-1 px-2 py-1 text-xs bg-rose-50 dark:bg-rose-900/30 ring-1 ring-rose-200 dark:ring-rose-700 text-rose-700 dark:text-rose-300 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 p-10 md:p-14 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-glow">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Chưa có kết quả phân tích
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
        Nhập từ khóa chính + dán nội dung bài viết phía trên rồi bấm{" "}
        <span className="font-medium text-slate-800 dark:text-slate-200">Phân tích</span> để xem điểm SEO và checklist chi tiết.
      </p>
    </div>
  );
}
