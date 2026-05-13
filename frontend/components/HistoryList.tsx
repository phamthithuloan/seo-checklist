"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type AnalysisListItem } from "@/lib/api";

interface Props {
  /** Bump to force reload (after creating a new analysis) */
  refreshKey?: number;
  onOpen: (id: string) => void;
}

function tierColor(score: number) {
  if (score >= 85) return "text-emerald-600 bg-emerald-50 ring-emerald-100";
  if (score >= 70) return "text-emerald-600 bg-emerald-50 ring-emerald-100";
  if (score >= 50) return "text-amber-600 bg-amber-50 ring-amber-100";
  return "text-rose-600 bg-rose-50 ring-rose-100";
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function sourceLabel(t: string) {
  if (t === "gdocs") return "Google Docs";
  if (t === "file") return "File upload";
  return "Paste";
}

export default function HistoryList({ refreshKey = 0, onOpen }: Props) {
  const [items, setItems] = useState<AnalysisListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await api.analysis.list();
      setItems(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Không tải được lịch sử.",
      );
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá bản phân tích này?")) return;
    setDeletingId(id);
    try {
      await api.analysis.delete(id);
      setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Xoá thất bại.");
    } finally {
      setDeletingId(null);
    }
  };

  if (items === null && !error) {
    return (
      <div className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70 p-10 text-center text-sm text-slate-500">
        Đang tải lịch sử…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-200 p-6 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70 p-10 md:p-14 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-glow">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
          Chưa có bài phân tích nào
        </h3>
        <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
          Bài viết bạn phân tích sẽ tự động lưu vào đây.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70 overflow-hidden">
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li
            key={it.id}
            className="group flex items-center gap-4 px-5 md:px-6 py-4 hover:bg-slate-50/60 transition"
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpen(it.id)}
                className="text-left w-full"
              >
                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand-700">
                  {it.title || it.keyword || "Bài viết không tiêu đề"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-slate-400">Từ khoá</span>
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">
                      {it.keyword}
                    </span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="num">{it.wordCount} từ</span>
                  <span className="text-slate-300">·</span>
                  <span>{sourceLabel(it.sourceType)}</span>
                  <span className="text-slate-300">·</span>
                  <span>{formatDate(it.createdAt)}</span>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${tierColor(it.score)}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className="num">{it.score}/100</span>
              </span>
              <span className="hidden md:inline-flex items-center gap-2 text-[11px] text-slate-500 num">
                <span className="text-emerald-600">{it.passCount}</span>
                <span className="text-amber-500">{it.warnCount}</span>
                <span className="text-rose-500">{it.failCount}</span>
              </span>
              <button
                type="button"
                onClick={() => handleDelete(it.id)}
                disabled={deletingId === it.id}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                aria-label="Xoá"
                title="Xoá"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
