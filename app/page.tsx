"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import InputForm from "@/components/InputForm";
import ScoreCard from "@/components/ScoreCard";
import CategorySection, { CATEGORIES } from "@/components/CategorySection";
import { analyzeContent } from "@/lib/seoAnalyzer";
import type { AnalysisResult } from "@/lib/types";

export default function Page() {
  const [keyword, setKeyword] = useState("");
  const [meta, setMeta] = useState("");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resultVersion, setResultVersion] = useState(0);

  const handleAnalyze = () => {
    setResult(analyzeContent(content, keyword, meta));
    setResultVersion((v) => v + 1);
  };

  const handleClear = () => {
    setKeyword("");
    setMeta("");
    setContent("");
    setResult(null);
    setResultVersion((v) => v + 1);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar resultVersion={resultVersion} />

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-slate-200/70">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                SEO Reviewer
              </p>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900 truncate">
                Content Checklist
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 transition">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export
              </button>
              <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Rule-based
              </span>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
              Phân tích bài viết SEO
            </h2>
            <p className="text-sm text-slate-600">
              Dán bài viết và nhập từ khóa chính. Hệ thống sẽ chấm điểm theo 11 tiêu chí và đề xuất cách cải thiện.
            </p>
          </div>

          <InputForm
            keyword={keyword}
            meta={meta}
            content={content}
            onKeywordChange={setKeyword}
            onMetaChange={setMeta}
            onContentChange={setContent}
            onAnalyze={handleAnalyze}
            onClear={handleClear}
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
                  {result.totalChecks} tiêu chí được nhóm theo 4 lĩnh vực — ưu tiên xử lý các mục Fail trước.
                </p>
              </div>

              <div className="space-y-5">
                {CATEGORIES.map((meta) => (
                  <CategorySection
                    key={meta.id}
                    meta={meta}
                    checks={result.checks.filter((c) => c.category === meta.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState />
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
