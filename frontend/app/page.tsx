"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { type ViewMode } from "@/components/Sidebar";
import InputForm from "@/components/InputForm";
import ScoreCard from "@/components/ScoreCard";
import CategorySection, { CATEGORIES } from "@/components/CategorySection";
import HistoryList from "@/components/HistoryList";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type AnalysisOut, type SourceType } from "@/lib/api";

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

  /* Result / flow */
  const [result, setResult] = useState<AnalysisOut | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const handleAnalyze = async () => {
    setAnalyzeError(null);
    setAnalyzing(true);
    try {
      const data = await api.analysis.create({
        keyword: keyword.trim(),
        metaDescription: meta,
        content,
        sourceType,
        sourceUrl: sourceUrl || undefined,
        title: title || undefined,
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
    setResult(null);
    setAnalyzeError(null);
    setResultVersion((v) => v + 1);
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
      <div className="min-h-screen grid place-items-center text-sm text-slate-500">
        Đang tải…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        view={view}
        onChangeView={setView}
        resultVersion={resultVersion}
      />

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-slate-200/70">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                {view === "review" ? "SEO Reviewer" : "Lịch sử"}
              </p>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900 truncate">
                {view === "review" ? "Content Checklist" : "Bài đã phân tích"}
              </h1>
            </div>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Backend live
            </span>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">
          {view === "review" ? (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                  Phân tích bài viết SEO
                </h2>
                <p className="text-sm text-slate-600">
                  Dán bài viết và nhập từ khóa chính. Hệ thống chấm điểm 11 tiêu chí, lưu lịch sử và cho phép xem lại.
                </p>
              </div>

              <InputForm
                keyword={keyword}
                meta={meta}
                content={content}
                title={title}
                sourceType={sourceType}
                onKeywordChange={setKeyword}
                onMetaChange={setMeta}
                onContentChange={setContent}
                onTitleChange={setTitle}
                onSourceTypeChange={setSourceType}
                onSourceUrlChange={setSourceUrl}
                onAnalyze={handleAnalyze}
                onClear={handleClear}
                analyzing={analyzing}
                error={analyzeError}
              />

              {result ? (
                <>
                  <div id="overview" className="scroll-mt-24">
                    <ScoreCard result={result} />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                      Checklist chi tiết
                    </h2>
                    <p className="text-sm text-slate-600">
                      {result.totalChecks} tiêu chí, nhóm theo 4 lĩnh vực — ưu tiên xử lý các mục Fail trước.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {CATEGORIES.map((cat) => (
                      <CategorySection
                        key={cat.id}
                        meta={cat}
                        checks={result.checks.filter(
                          (c) => c.category === cat.id,
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState />
              )}
            </>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                  Lịch sử kiểm tra
                </h2>
                <p className="text-sm text-slate-600">
                  Click một bài để mở lại điểm chi tiết + recommendation.
                </p>
              </div>
              <HistoryList
                refreshKey={historyVersion}
                onOpen={handleOpenFromHistory}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70 p-10 md:p-14 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center shadow-glow">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
        Chưa có kết quả phân tích
      </h3>
      <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
        Nhập từ khóa chính + dán nội dung bài viết phía trên rồi bấm{" "}
        <span className="font-medium text-slate-800">Phân tích</span> để xem điểm SEO và checklist chi tiết.
      </p>
    </div>
  );
}
