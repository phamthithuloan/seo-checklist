"use client";

import { useState } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/mindgate-logo.png"
            alt="MindGate"
            className="h-32 w-auto"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            SEO Content Reviewer
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700 p-6 md:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          )}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-800">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 px-3 py-2 text-sm text-rose-700">
      {message}
    </div>
  );
}

const PWD_INPUT_CLS =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition";

export function PasswordInput({
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={PWD_INPUT_CLS}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700 transition"
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
