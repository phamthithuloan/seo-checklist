"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  api,
  ApiError,
  type AvatarColor,
  type NotificationPrefs,
  type User,
} from "@/lib/api";
import {
  applyDisplayPrefs,
  getDisplayPrefs,
  setDisplayPrefs,
  type FontSize,
  type Language,
  type Theme,
} from "@/lib/theme";

type Tab = "account" | "display" | "notifications";

export default function SettingsView() {
  const [tab, setTab] = useState<Tab>("account");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700">
        <nav className="flex flex-wrap gap-1 p-2 border-b border-slate-100 dark:border-slate-700">
          {(
            [
              { id: "account", label: "Tài khoản" },
              { id: "display", label: "Hiển thị" },
              { id: "notifications", label: "Thông báo" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                tab === t.id
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-5 md:p-6">
          {tab === "account" && <AccountTab />}
          {tab === "display" && <DisplayTab />}
          {tab === "notifications" && <NotificationsTab />}
        </div>
      </div>
    </div>
  );
}

/* ───────── Account tab ───────── */

const AVATAR_COLORS: { id: AvatarColor; bg: string; ring: string }[] = [
  { id: "emerald", bg: "bg-gradient-to-br from-emerald-400 to-teal-500", ring: "ring-emerald-400" },
  { id: "sky", bg: "bg-gradient-to-br from-sky-400 to-blue-500", ring: "ring-sky-400" },
  { id: "violet", bg: "bg-gradient-to-br from-violet-400 to-purple-500", ring: "ring-violet-400" },
  { id: "rose", bg: "bg-gradient-to-br from-rose-400 to-pink-500", ring: "ring-rose-400" },
  { id: "amber", bg: "bg-gradient-to-br from-amber-400 to-orange-500", ring: "ring-amber-400" },
  { id: "indigo", bg: "bg-gradient-to-br from-indigo-400 to-blue-600", ring: "ring-indigo-400" },
  { id: "slate", bg: "bg-gradient-to-br from-slate-400 to-slate-600", ring: "ring-slate-400" },
  { id: "teal", bg: "bg-gradient-to-br from-teal-400 to-cyan-500", ring: "ring-teal-400" },
];

function AccountTab() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [color, setColor] = useState<AvatarColor>(user?.avatarColor || "emerald");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwToast, setPwToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  if (!user) return null;
  const initial = (name || email || "?")[0]?.toUpperCase();
  const colorMeta = AVATAR_COLORS.find((c) => c.id === color) ?? AVATAR_COLORS[0];

  const saveProfile = async () => {
    setToast(null);
    setSaving(true);
    try {
      const updated = await api.auth.updateMe({
        name: name.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || undefined,
        avatarColor: color,
      });
      setUser(updated);
      setToast({ kind: "ok", msg: "Đã lưu thay đổi tài khoản." });
    } catch (err) {
      setToast({
        kind: "err",
        msg: err instanceof ApiError ? err.detail : "Lưu thất bại.",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setPwToast(null);
    if (newPw !== confirmPw) {
      setPwToast({ kind: "err", msg: "Mật khẩu mới và xác nhận không khớp." });
      return;
    }
    if (newPw.length < 8) {
      setPwToast({ kind: "err", msg: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      return;
    }
    setPwSaving(true);
    try {
      await api.auth.changePassword({
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwToast({ kind: "ok", msg: "Đã đổi mật khẩu." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwToast({
        kind: "err",
        msg: err instanceof ApiError ? err.detail : "Đổi mật khẩu thất bại.",
      });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Avatar + color */}
      <Section title="Ảnh đại diện">
        <div className="flex items-center gap-5">
          <div
            className={`h-16 w-16 rounded-full ${colorMeta.bg} text-white grid place-items-center text-2xl font-semibold shrink-0`}
          >
            {initial}
          </div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                className={`h-8 w-8 rounded-full ${c.bg} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition ${
                  color === c.id
                    ? c.ring
                    : "ring-transparent hover:ring-slate-300"
                }`}
                title={c.id}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Thông tin cá nhân">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Tên hiển thị">
            <Input value={name} onChange={setName} placeholder="vd: Loan Phạm" />
          </Field>
          <Field label="Số điện thoại">
            <Input value={phone} onChange={setPhone} placeholder="vd: 0901234567" />
          </Field>
          <Field label="Email" hint="Đổi email không qua xác minh — dùng email bạn kiểm soát.">
            <Input value={email} onChange={setEmail} type="email" />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-medium shadow-glow disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
          {toast && <Toast {...toast} />}
        </div>
      </Section>

      <Section title="Đổi mật khẩu">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Mật khẩu hiện tại">
            <Input value={currentPw} onChange={setCurrentPw} type="password" />
          </Field>
          <Field label="Mật khẩu mới" hint="≥ 8 ký tự">
            <Input value={newPw} onChange={setNewPw} type="password" />
          </Field>
          <Field label="Xác nhận">
            <Input value={confirmPw} onChange={setConfirmPw} type="password" />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={savePassword}
            disabled={pwSaving || !currentPw || !newPw || !confirmPw}
            className="px-4 py-2 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium disabled:opacity-50"
          >
            {pwSaving ? "Đang đổi..." : "Đổi mật khẩu"}
          </button>
          {pwToast && <Toast {...pwToast} />}
        </div>
      </Section>
    </div>
  );
}

/* ───────── Display tab ───────── */

function DisplayTab() {
  const [theme, setTheme] = useState<Theme>("system");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [language, setLanguage] = useState<Language>("vi");

  useEffect(() => {
    const p = getDisplayPrefs();
    setTheme(p.theme);
    setFontSize(p.fontSize);
    setLanguage(p.language);
  }, []);

  const update = <K extends keyof ReturnType<typeof getDisplayPrefs>>(
    key: K,
    value: ReturnType<typeof getDisplayPrefs>[K],
  ) => {
    setDisplayPrefs({ [key]: value } as Record<K, typeof value>);
    applyDisplayPrefs();
  };

  return (
    <div className="space-y-8">
      <Section title="Chủ đề">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "light", label: "Sáng" },
              { id: "dark", label: "Tối" },
              { id: "system", label: "Theo hệ thống" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTheme(t.id);
                update("theme", t.id);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ring-1 ${
                theme === t.id
                  ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400/40"
                  : "ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Cỡ chữ">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "sm", label: "Nhỏ", sz: "text-sm" },
              { id: "md", label: "Vừa", sz: "text-base" },
              { id: "lg", label: "Lớn", sz: "text-lg" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFontSize(f.id);
                update("fontSize", f.id);
              }}
              className={`px-4 py-2 rounded-xl font-medium transition ring-1 ${f.sz} ${
                fontSize === f.id
                  ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400/40"
                  : "ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Áp dụng ngay không cần reload.
        </p>
      </Section>

      <Section title="Ngôn ngữ">
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value as Language);
            update("language", e.target.value as Language);
          }}
          className="w-full md:w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm"
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en" disabled>
            English (sắp có)
          </option>
        </select>
      </Section>
    </div>
  );
}

/* ───────── Notifications tab ───────── */

function NotificationsTab() {
  const { user, setUser } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    user?.notificationPrefs || {
      emailEnabled: true,
      pushEnabled: false,
      analysisDone: true,
      weeklyReport: false,
      criticalErrors: true,
      productNews: false,
    },
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const save = async () => {
    setToast(null);
    setSaving(true);
    try {
      const updated = await api.auth.updateNotifications(prefs);
      setUser(updated);
      setToast({ kind: "ok", msg: "Đã lưu thiết lập thông báo." });
    } catch (err) {
      setToast({
        kind: "err",
        msg: err instanceof ApiError ? err.detail : "Lưu thất bại.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-400/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
        ⚠ Hệ thống email + push hiện chưa hoạt động. Thiết lập của bạn được lưu sẵn — sẽ áp dụng khi backend hỗ trợ.
      </div>

      <Section title="Kênh">
        <ToggleRow
          label="Thông báo qua email"
          desc="Nhận email khi có sự kiện mới."
          on={prefs.emailEnabled}
          onChange={() => toggle("emailEnabled")}
        />
        <ToggleRow
          label="Push notification"
          desc="Yêu cầu cho phép trình duyệt gửi push."
          on={prefs.pushEnabled}
          onChange={() => toggle("pushEnabled")}
        />
      </Section>

      <Section title="Loại thông báo">
        <ToggleRow
          label="Phân tích bài xong"
          desc="Khi một bài hoàn tất chấm điểm."
          on={prefs.analysisDone}
          onChange={() => toggle("analysisDone")}
        />
        <ToggleRow
          label="Báo cáo tuần"
          desc="Tổng kết score & history hàng tuần."
          on={prefs.weeklyReport}
          onChange={() => toggle("weeklyReport")}
        />
        <ToggleRow
          label="Lỗi nghiêm trọng"
          desc="Khi backend lỗi, AI proofread fail, v.v."
          on={prefs.criticalErrors}
          onChange={() => toggle("criticalErrors")}
        />
        <ToggleRow
          label="Tin tức sản phẩm"
          desc="Tính năng mới, mẹo SEO."
          on={prefs.productNews}
          onChange={() => toggle("productNews")}
        />
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white text-sm font-medium shadow-glow disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu lựa chọn"}
        </button>
        {toast && <Toast {...toast} />}
      </div>
    </div>
  );
}

/* ───────── Shared bits ───────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:focus:ring-brand-400/20 outline-none transition text-slate-900 dark:text-slate-100"
    />
  );
}

function ToggleRow({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition shrink-0 ${
          on ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-600"
        }`}
        role="switch"
        aria-checked={on}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Toast({ kind, msg }: { kind: "ok" | "err"; msg: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${
        kind === "ok"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30"
          : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          kind === "ok" ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      {msg}
    </span>
  );
}
