"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AuthShell, Field, ErrorBanner } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.auth.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Có lỗi, thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Đã gửi yêu cầu"
        subtitle="Kiểm tra hộp thư của bạn"
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Nếu email <strong>{email}</strong> tồn tại trong hệ thống, bạn sẽ nhận
          được link đặt lại mật khẩu trong vài phút. Link có hiệu lực 60 phút.
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Không thấy email? Kiểm tra thư mục Spam, hoặc liên hệ admin
          {" "}
          <a
            href="mailto:gcontent@seongon.com"
            className="text-brand-600 hover:text-brand-700"
          >
            gcontent@seongon.com
          </a>
          .
        </p>
        <p className="mt-5 text-center text-xs text-slate-500">
          <Link
            href="/login"
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            ← Quay lại đăng nhập
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Nhập email tài khoản, chúng tôi sẽ gửi link đặt lại"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
          />
        </Field>

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-medium shadow-glow disabled:opacity-50 transition"
        >
          {submitting ? "Đang gửi..." : "Gửi link đặt lại"}
        </button>

        <p className="text-center text-xs text-slate-500">
          Nhớ ra mật khẩu?{" "}
          <Link
            href="/login"
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
