"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface Props {
  outline: string;
  onOutlineChange: (v: string) => void;
}

const SpinIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.2-8.55" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" className={`h-4 w-4 transition${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

type Tab = "paste" | "file" | "gdocs" | "url";
const MAX_BYTES = 5 * 1024 * 1024;

export default function OutlineInput({ outline, onOutlineChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("paste");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gdocsUrl, setGdocsUrl] = useState("");
  const [gdocsFetching, setGdocsFetching] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);

  const lineCount = outline.split("\n").filter((l) => l.trim()).length;
  const headingCount = (outline.match(/^#{1,4}\s+/gm) || []).length;

  const handleFile = async (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    const isTxt = name.endsWith(".txt");
    const isDocx = name.endsWith(".docx");
    if (!isTxt && !isDocx) {
      setError("Chỉ hỗ trợ .txt và .docx.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File vượt quá 5 MB.");
      return;
    }
    setUploading(true);
    try {
      let text = "";
      if (isTxt) {
        text = await file.text();
      } else {
        const mammoth = await import("mammoth/mammoth.browser");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      }
      text = text.replace(/\r\n/g, "\n").trim();
      if (!text) {
        setError("File rỗng.");
        return;
      }
      onOutlineChange(text);
    } catch (err) {
      console.error(err);
      setError("Không đọc được file.");
    } finally {
      setUploading(false);
    }
  };

  const handleFetchGdocs = async () => {
    setError(null);
    const url = gdocsUrl.trim();
    if (!url) return;
    setGdocsFetching(true);
    try {
      const r = await api.sources.googleDocs(url);
      onOutlineChange(r.text);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Không tải được Google Doc.",
      );
    } finally {
      setGdocsFetching(false);
    }
  };

  const handleFetchUrl = async () => {
    setError(null);
    const url = urlInput.trim();
    if (!url) return;
    setUrlFetching(true);
    try {
      const r = await api.sources.url(url);
      onOutlineChange(r.text);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Không tải được URL.");
    } finally {
      setUrlFetching(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/60 transition rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <ChevronIcon open={open} />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              So sánh với Outline{" "}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                (tuỳ chọn)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Nhập outline + annotation (vd <span className="font-mono">## H2 (200 từ, bullet)</span>) để so sánh cấu trúc, độ dài, format.
            </p>
          </div>
        </div>
        {outline && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700">
            {headingCount} heading · {lineCount} dòng
          </span>
        )}
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2 space-y-3 border-t border-slate-100">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-700 p-1 flex-wrap">
            {(
              [
                { id: "paste", label: "Paste text" },
                { id: "file", label: "Upload file" },
                { id: "gdocs", label: "Google Docs URL" },
                { id: "url", label: "URL bài viết" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition${
                  tab === t.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "file" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
              >
                {uploading ? <SpinIcon /> : <UploadIcon />}
                {uploading ? "Đang đọc..." : "Chọn outline .txt / .docx"}
              </button>
            </div>
          )}

          {tab === "gdocs" && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={gdocsUrl}
                onChange={(e) => setGdocsUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/.../edit (outline)"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
              />
              <button
                type="button"
                onClick={handleFetchGdocs}
                disabled={gdocsFetching || !gdocsUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {gdocsFetching ? <SpinIcon /> : null}
                {gdocsFetching ? "Đang tải..." : "Tải outline"}
              </button>
            </div>
          )}

          {tab === "url" && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://blog.com/outline-da-publish"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
              />
              <button
                type="button"
                onClick={handleFetchUrl}
                disabled={urlFetching || !urlInput.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {urlFetching ? <SpinIcon /> : null}
                {urlFetching ? "Đang crawl..." : "Crawl URL"}
              </button>
            </div>
          )}

          <textarea
            value={outline}
            onChange={(e) => onOutlineChange(e.target.value)}
            rows={10}
            placeholder={
              "# Tiêu đề chính\n## Mở đầu (Sapo) (200 từ, text)\n## Phần 1 (300, bullet)\n### Chi tiết 1.1 (150)\n## Phần 2\n## Kết luận (100, text)"
            }
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 text-sm font-mono leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition resize-y"
          />

          {error && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-900/30 ring-1 ring-rose-200 dark:ring-rose-700 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mỗi heading <span className="font-mono">## …</span> có thể kèm{" "}
            <span className="font-mono">(số_từ, format)</span> — format:{" "}
            <span className="font-mono">text</span> /{" "}
            <span className="font-mono">bullet</span> /{" "}
            <span className="font-mono">bảng</span>. Bỏ qua annotation cũng được, tool sẽ chỉ kiểm tra cấu trúc tiêu đề.
          </p>

          {outline && (
            <button
              type="button"
              onClick={() => onOutlineChange("")}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600"
            >
              Xoá outline
            </button>
          )}
        </div>
      )}
    </section>
  );
}
