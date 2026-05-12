"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { AuthShell, Field, ErrorBanner } from "../login/page";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, register } = useAuth();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Đăng ký thất bại, thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Tạo tài khoản" subtitle="Lưu lịch sử kiểm tra của bạn">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tên hiển thị (tuỳ chọn)">
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
          />
        </Field>
        <Field label="Mật khẩu" hint="Tối thiểu 8 ký tự.">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none transition"
          />
        </Field>

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 hover:from-brand-600 hover:to-violet-600 text-white text-sm font-medium shadow-glow disabled:opacity-50 transition"
        >
          {submitting ? "Đang tạo tài khoản..." : "Đăng ký"}
        </button>

        <p className="text-center text-xs text-slate-500">
          Đã có tài khoản?{" "}
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
