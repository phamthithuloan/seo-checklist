"use client";

import type { AnalysisResult } from "@/lib/types";

function tierFor(score: number) {
  if (score >= 85) return { label: "Excellent", text: "text-emerald-600", grad: ["#10b981", "#059669"] };
  if (score >= 70) return { label: "Good", text: "text-emerald-600", grad: ["#22c55e", "#10b981"] };
  if (score >= 50) return { label: "Needs work", text: "text-amber-600", grad: ["#f59e0b", "#f97316"] };
  return { label: "Poor", text: "text-rose-600", grad: ["#f43f5e", "#e11d48"] };
}

export default function ScoreCard({ result }: { result: AnalysisResult }) {
  const tier = tierFor(result.score);
  const radius = 76;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (result.score / 100) * circ;
  const total = result.totalChecks;
  const passPct = (result.passCount / total) * 100;
  const warnPct = (result.warnCount / total) * 100;
  const failPct = (result.failCount / total) * 100;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-up">
      {/* Hero score card */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-white pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-60 w-60 rounded-full bg-gradient-to-br from-brand-200/50 to-violet-200/40 blur-3xl pointer-events-none" />

        <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center md:items-stretch gap-6">
          <div className="relative h-44 w-44 shrink-0">
            <svg className="h-44 w-44 -rotate-90" viewBox="0 0 200 200">
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={tier.grad[0]} />
                  <stop offset="100%" stopColor={tier.grad[1]} />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r={radius} stroke="#eef2f7" strokeWidth="14" fill="transparent" />
              <circle
                cx="100"
                cy="100"
                r={radius}
                stroke="url(#scoreGrad)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                fill="transparent"
                style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-5xl font-bold tracking-tight text-slate-900 num">{result.score}</p>
                <p className="text-xs uppercase tracking-wider text-slate-500 mt-1">/ 100</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white ring-1 ring-slate-200 ${tier.text}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {tier.label}
              </span>
              <span className="text-xs text-slate-500">
                {result.passCount}/{total} tiêu chí đạt
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              SEO Score Overview
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-md">
              Điểm tổng hợp từ {total} tiêu chí rule-based. Cải thiện các mục đỏ trước để tăng điểm nhanh nhất.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                  <span>Score progress</span>
                  <span className="num text-slate-700 font-semibold normal-case tracking-normal">
                    {result.score}/100
                  </span>
                </div>
                <div
                  className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={result.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r"
                    style={{
                      width: `${result.score}%`,
                      backgroundImage: `linear-gradient(90deg, ${tier.grad[0]}, ${tier.grad[1]})`,
                      transition: "width 0.6s ease-out",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  {passPct > 0 && <div className="bg-emerald-500" style={{ width: `${passPct}%` }} />}
                  {warnPct > 0 && <div className="bg-amber-400" style={{ width: `${warnPct}%` }} />}
                  {failPct > 0 && <div className="bg-rose-500" style={{ width: `${failPct}%` }} />}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                  <Legend dot="bg-emerald-500" label="Pass" value={result.passCount} />
                  <Legend dot="bg-amber-400" label="Warning" value={result.warnCount} />
                  <Legend dot="bg-rose-500" label="Fail" value={result.failCount} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: supporting stats */}
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
        <Stat
          label="Số từ"
          value={result.wordCount}
          hint={result.wordCount >= 800 ? "Đủ chiều sâu" : "Nên ≥ 800"}
          tone={result.wordCount >= 800 ? "ok" : "warn"}
        />
        <Stat
          label="Keyword density"
          value={`${result.keywordDensity.toFixed(2)}%`}
          hint={
            result.keywordDensity >= 1 && result.keywordDensity <= 3
              ? "Trong khoảng tốt"
              : "Ngoài 1–3%"
          }
          tone={result.keywordDensity >= 1 && result.keywordDensity <= 3 ? "ok" : "warn"}
        />
      </div>
    </section>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
      <span className="font-semibold text-slate-900 num">{value}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone: "ok" | "warn";
}) {
  const tones = {
    ok: "text-emerald-600 bg-emerald-50 ring-emerald-100",
    warn: "text-amber-600 bg-amber-50 ring-amber-100",
  } as const;
  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70 flex flex-col justify-between">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 num">{value}</p>
      <p className={`mt-3 inline-flex w-fit items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ring-1 ${tones[tone]}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {hint}
      </p>
    </div>
  );
}
