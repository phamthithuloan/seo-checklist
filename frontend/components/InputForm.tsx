"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type SourceType } from "@/lib/api";

interface Props {
  keyword: string;
  meta: string;
  content: string;
  title: string | null;
  sourceType: SourceType;
  aiProofread: boolean;
  onKeywordChange: (v: string) => void;
  onMetaChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onTitleChange: (v: string | null) => void;
  onSourceTypeChange: (v: SourceType) => void;
  onSourceUrlChange: (v: string | null) => void;
  onAiProofreadChange: (v: boolean) => void;
  onAnalyze: () => void;
  onClear: () => void;
  analyzing?: boolean;
  error?: string | null;
}

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    <path d="M19 14v4M21 16h-4" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const SpinIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.2-8.55" />
  </svg>
);

const MAX_BYTES = 5 * 1024 * 1024;

export default function InputForm({
  keyword,
  meta,
  content,
  title,
  sourceType,
  aiProofread,
  onKeywordChange,
  onMetaChange,
  onContentChange,
  onTitleChange,
  onSourceTypeChange,
  onSourceUrlChange,
  onAiProofreadChange,
  onAnalyze,
  onClear,
  analyzing = false,
  error = null,
}: Props) {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const metaLeft = 165 - meta.length;
  const canAnalyze = !!keyword.trim() && !!content.trim() && !analyzing;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [gdocsUrl, setGdocsUrl] = useState("");
  const [gdocsFetching, setGdocsFetching] = useState(false);
  const [gdocsError, setGdocsError] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (content === "") {
      setUploadedName(null);
      setUploadError(null);
    }
  }, [content]);

  const handleFile = async (file: File) => {
    setUploadError(null);
    const name = file.name.toLowerCase();
    const isDocx = name.endsWith(".docx");
    const isTxt = name.endsWith(".txt");

    if (!isDocx && !isTxt) {
      setUploadError("Chỉ hỗ trợ .txt và .docx.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("File vượt quá 5 MB.");
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
        setUploadError("File rỗng hoặc không có nội dung text.");
        return;
      }
      onContentChange(text);
      setUploadedName(file.name);
      onSourceTypeChange("file");
      onSourceUrlChange(null);
      if (!title) onTitleChange(file.name.replace(/\.(txt|docx)$/i, ""));
    } catch (err) {
      console.error(err);
      setUploadError("Không đọc được file. Hãy kiểm tra định dạng.");
    } finally {
      setUploading(false);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleFetchGdocs = async () => {
    setGdocsError(null);
    const url = gdocsUrl.trim();
    if (!url) return;
    setGdocsFetching(true);
    try {
      const r = await api.sources.googleDocs(url);
      onContentChange(r.text);
      if (r.title && !title) onTitleChange(r.title);
      onSourceTypeChange("gdocs");
      onSourceUrlChange(url);
      setUploadedName(null);
    } catch (err) {
      setGdocsError(
        err instanceof ApiError ? err.detail : "Không tải được Google Doc.",
      );
    } finally {
      setGdocsFetching(false);
    }
  };

  const handleFetchUrl = async () => {
    setUrlError(null);
    const url = urlInput.trim();
    if (!url) return;
    setUrlFetching(true);
    try {
      const r = await api.sources.url(url);
      onContentChange(r.text);
      if (r.title && !title) onTitleChange(r.title);
      onSourceTypeChange("url");
      onSourceUrlChange(url);
      setUploadedName(null);
    } catch (err) {
      setUrlError(
        err instanceof ApiError ? err.detail : "Không tải được URL.",
      );
    } finally {
      setUrlFetching(false);
    }
  };

  const setSourceTab = (t: SourceType) => {
    onSourceTypeChange(t);
    if (t !== "gdocs") setGdocsError(null);
    if (t !== "url") setUrlError(null);
  };

  return (
    <section className="rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">
            Phân tích bài viết
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Paste text, upload file, hoặc dán URL Google Docs (công khai).
          </p>
        </div>
        <span className="text-xs text-slate-500 num">{wordCount} từ</span>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Field label="Từ khóa chính" required hint="Kiểm tra trong H2 và mật độ.">
            <input
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="vd: dịch vụ SEO tổng thể"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
            />
          </Field>

          <Field
            label="Meta description"
            hint="Tối đa 165 ký tự."
            right={
              <span className={`text-xs num ${metaLeft < 0 ? "text-rose-600" : "text-slate-500"}`}>
                {meta.length}/165
              </span>
            }
          >
            <input
              value={meta}
              onChange={(e) => onMetaChange(e.target.value)}
              placeholder="Mô tả ngắn cho thẻ meta..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
            />
          </Field>
        </div>

        <Field label="Tiêu đề bài (tuỳ chọn)" hint="Để dễ nhận trong lịch sử.">
          <input
            value={title || ""}
            onChange={(e) => onTitleChange(e.target.value || null)}
            placeholder="vd: Hướng dẫn SEO 2026"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
          />
        </Field>

        <div>
          <label className="text-sm font-medium text-slate-800">Nguồn nội dung</label>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 my-2 flex-wrap">
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
                onClick={() => setSourceTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  sourceType === t.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {sourceType === "file" && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx"
                className="hidden"
                onChange={onFileInput}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
              >
                {uploading ? <SpinIcon /> : <UploadIcon />}
                {uploading ? "Đang đọc..." : "Chọn file .txt / .docx"}
              </button>
              {uploadedName && !uploadError && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <FileIcon />
                  <span className="font-medium">{uploadedName}</span>
                  <span className="text-emerald-500">·</span>
                  <span className="text-emerald-600">{wordCount} từ</span>
                  <button
                    type="button"
                    onClick={() => {
                      onContentChange("");
                      setUploadedName(null);
                    }}
                    className="ml-1 -mr-0.5 p-0.5 rounded hover:bg-emerald-100"
                  >
                    <XIcon />
                  </button>
                </span>
              )}
              {uploadError && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {uploadError}
                </span>
              )}
            </div>
          )}

          {sourceType === "gdocs" && (
            <div className="mb-3 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={gdocsUrl}
                  onChange={(e) => setGdocsUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/.../edit"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
                />
                <button
                  type="button"
                  onClick={handleFetchGdocs}
                  disabled={gdocsFetching || !gdocsUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl ring-1 ring-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  {gdocsFetching ? <SpinIcon /> : null}
                  {gdocsFetching ? "Đang tải..." : "Tải nội dung"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Doc phải đặt quyền <span className="font-mono">Anyone with link can view</span>.
              </p>
              {gdocsError && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {gdocsError}
                </span>
              )}
            </div>
          )}

          {sourceType === "url" && (
            <div className="mb-3 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://your-blog.com/bai-viet-da-publish"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
                />
                <button
                  type="button"
                  onClick={handleFetchUrl}
                  disabled={urlFetching || !urlInput.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl ring-1 ring-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  {urlFetching ? <SpinIcon /> : null}
                  {urlFetching ? "Đang crawl..." : "Crawl URL"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Paste URL bài viết đã publish trên website. Tool sẽ fetch HTML, strip nav/footer/script, chuyển thành markdown.
              </p>
              {urlError && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {urlError}
                </span>
              )}
            </div>
          )}

          <div
            onDragEnter={(e) => {
              if (sourceType !== "file") return;
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              if (sourceType !== "file") return;
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              if (sourceType !== "file") return;
              onDrop(e);
            }}
            className={`relative rounded-xl transition ${
              dragActive ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-white" : ""
            }`}
          >
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              rows={14}
              placeholder={
                sourceType === "gdocs"
                  ? "Nội dung sẽ tự fill sau khi tải Google Doc..."
                  : "# Tiêu đề\n\n## Mở đầu\n...\n\n## TL;DR\n- ...\n\n## FAQ\n..."
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-mono leading-relaxed placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition resize-y"
            />
            {dragActive && (
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-brand-50/80 backdrop-blur-sm grid place-items-center">
                <div className="text-center">
                  <UploadIcon />
                  <p className="mt-2 text-sm font-medium text-brand-700">Thả file để tải lên</p>
                  <p className="text-xs text-brand-600">.txt hoặc .docx · tối đa 5 MB</p>
                </div>
              </div>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Markdown được khuyến nghị — <span className="font-mono">## Heading</span>, <span className="font-mono">[anchor](/path)</span>.
          </p>
        </div>

        <label className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-slate-50 ring-1 ring-slate-200 cursor-pointer hover:bg-slate-100 transition">
          <input
            type="checkbox"
            checked={aiProofread}
            onChange={(e) => onAiProofreadChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900">
                AI proofread ngữ pháp + chính tả
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                Mất phí
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gọi Claude Sonnet 4.6 phát hiện lỗi ngữ pháp + chính tả tiếng Việt.
              ~$0.01–0.03 / bài. Cần <span className="font-mono">ANTHROPIC_API_KEY</span> ở backend.
            </p>
          </div>
        </label>

        {error && (
          <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            {analyzing
              ? "Đang phân tích..."
              : canAnalyze
              ? "Sẵn sàng phân tích"
              : "Nhập từ khóa và nội dung để bắt đầu"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClear}
              className="px-4 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-100 transition"
            >
              Xoá
            </button>
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!canAnalyze}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-medium shadow-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition"
            >
              {analyzing ? <SpinIcon /> : <SparkleIcon />}
              {analyzing ? "Đang phân tích..." : "Phân tích"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  right,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-slate-800">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {right}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
