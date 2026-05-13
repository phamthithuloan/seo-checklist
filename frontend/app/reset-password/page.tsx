"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AuthShell, Field, ErrorBanner, PasswordInput } from "@/components/AuthShell";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { refreshUser } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthShell title="Link không hợp lệ" subtitle="Thiếu mã đặt lại">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Link đặt lại mật khẩu thiếu thông tin. Vui lòng yêu cầu lại.
        </p>
        <p className="mt-5 text-center text-xs">
          <Link
            href="/forgot-password"
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            ← Yêu cầu link mới
          </Link>
        </p>
      </AuthShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Hai mật khẩu không khớp.");
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.resetPassword(token, password);
      await refreshUser();
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Có lỗi, thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Đặt mật khẩu mới" subtitle="Chọn mật khẩu cho tài khoản của bạn">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự.">
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
          />
        </Field>
        <Field label="Nhập lại mật khẩu">
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={8}
          />
        </Field>

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-medium shadow-glow disabled:opacity-50 transition"
        >
          {submitting ? "Đang lưu..." : "Đặt mật khẩu mới"}
        </button>
      </form>
    </AuthShell>
  );
}
