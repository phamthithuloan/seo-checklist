"use client";

import type { AnalysisResult, CheckStatus, OutlineComparison } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

const TOKEN_KEY = "seo:token";

/* ───────── Types mirroring backend ───────── */

export type AvatarColor =
  | "emerald"
  | "sky"
  | "violet"
  | "rose"
  | "amber"
  | "indigo"
  | "slate"
  | "teal";

export interface NotificationPrefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  analysisDone: boolean;
  weeklyReport: boolean;
  criticalErrors: boolean;
  productNews: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  avatarColor?: AvatarColor;
  notificationPrefs?: NotificationPrefs;
  createdAt: string;
}

export interface UserUpdate {
  name?: string | null;
  phone?: string | null;
  email?: string;
  avatarColor?: AvatarColor;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

export type SourceType = "paste" | "file" | "gdocs" | "url";

export interface AnalysisConfig {
  secondaryKeywords?: string[];
  pronouns?: string[];
  brandVoiceKeywords?: string[];
  brandMessage?: string;
  adForbiddenWords?: string[];
  competitors?: string[];
  personaKeywords?: string[];
  awardsMentions?: string[];
  productUrls?: string[];
  lsiKeywords?: string[];
}

export interface AnalysisCreate {
  keyword: string;
  metaDescription?: string;
  content: string;
  sourceType: SourceType;
  sourceUrl?: string | null;
  title?: string | null;
  enabledChecks?: string[] | null;
  config?: AnalysisConfig | null;
  outline?: string | null;
  aiProofread?: boolean;
}

export interface AnalysisOut extends AnalysisResult {
  id: string;
  userId: string;
  title: string | null;
  keyword: string;
  metaDescription: string;
  content: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  outline?: string | null;
  outlineComparison?: OutlineComparison | null;
  createdAt: string;
}

export interface AnalysisListItem {
  id: string;
  title: string | null;
  keyword: string;
  sourceType: SourceType;
  score: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  wordCount: number;
  createdAt: string;
}

export interface GoogleDocsOut {
  title: string | null;
  text: string;
}

/* ───────── Token helpers ───────── */

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

/* ───────── Error class ───────── */

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

/* ───────── Core fetch wrapper ───────── */

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenStore.get();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, `Không kết nối được tới máy chủ (${API_URL}).`);
  }

  if (res.status === 204) return undefined as T;

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const detail =
      (payload && typeof payload.detail === "string" && payload.detail) ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, detail);
  }

  return payload as T;
}

/* ───────── Public API ───────── */

export const api = {
  auth: {
    async register(data: { email: string; password: string; name?: string }) {
      const r = await request<{ accessToken: string; tokenType: string }>(
        "/auth/register",
        { method: "POST", body: data, auth: false },
      );
      tokenStore.set(r.accessToken);
      return r;
    },
    async login(data: { email: string; password: string }) {
      const r = await request<{ accessToken: string; tokenType: string }>(
        "/auth/login",
        { method: "POST", body: data, auth: false },
      );
      tokenStore.set(r.accessToken);
      return r;
    },
    me() {
      return request<User>("/auth/me");
    },
    updateMe(data: UserUpdate) {
      return request<User>("/auth/me", { method: "PATCH", body: data });
    },
    changePassword(data: PasswordChange) {
      return request<void>("/auth/password/change", { method: "POST", body: data });
    },
    updateNotifications(prefs: NotificationPrefs) {
      return request<User>("/auth/me/notifications", { method: "PUT", body: prefs });
    },
    logout() {
      tokenStore.clear();
    },
  },

  analysis: {
    create(data: AnalysisCreate) {
      return request<AnalysisOut>("/analysis", { method: "POST", body: data });
    },
    list() {
      return request<AnalysisListItem[]>("/analysis");
    },
    get(id: string) {
      return request<AnalysisOut>(`/analysis/${id}`);
    },
    delete(id: string) {
      return request<void>(`/analysis/${id}`, { method: "DELETE" });
    },
    /** Build a URL the browser can download directly. Auth handled in download helper. */
    exportUrl(id: string, format: "markdown" | "html" = "markdown") {
      return `${API_URL}/analysis/${id}/export?format=${format}`;
    },
    async downloadExport(id: string, format: "markdown" | "html" = "markdown") {
      const token = tokenStore.get();
      const res = await fetch(`${API_URL}/analysis/${id}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new ApiError(res.status, `Export thất bại (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      // Parse filename from Content-Disposition if present
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `bao-cao-seo.${format === "html" ? "html" : "md"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  },

  sources: {
    googleDocs(url: string) {
      return request<GoogleDocsOut>("/sources/google-docs", {
        method: "POST",
        body: { url },
      });
    },
    url(url: string) {
      return request<GoogleDocsOut>("/sources/url", {
        method: "POST",
        body: { url },
      });
    },
  },
};

/* ───────── Re-export for convenience ───────── */
export type { AnalysisResult, CheckStatus };
