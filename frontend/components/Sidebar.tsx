"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

type IconProps = { className?: string };

/* ───────── Icons ───────── */

const ReviewIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 14l2 2 4-4" />
  </svg>
);
const HistoryIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const ChecklistSeoIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8l1.5 1.5L13 6" />
    <path d="M8 14l1.5 1.5L13 12" />
    <path d="M16 9h2M16 15h2" />
  </svg>
);
const SettingsIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
const ChevronIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);
const LogoutIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

/* ───────── Data ───────── */

export type ViewMode = "review" | "history" | "checklist" | "settings";

interface TopItem {
  id: TopId;
  label: string;
  Icon: (p: IconProps) => JSX.Element;
  badge?: string;
  soon?: boolean;
}
type TopId = ViewMode;

const TOP_LEVEL: TopItem[] = [
  { id: "review", label: "Review bài viết", Icon: ReviewIcon },
  { id: "history", label: "Lịch sử kiểm tra", Icon: HistoryIcon },
  { id: "checklist", label: "Checklist SEO", Icon: ChecklistSeoIcon },
  { id: "settings", label: "Cài đặt", Icon: SettingsIcon },
];

interface SubItem {
  id: string;
  label: string;
}

const SUB_ITEMS: SubItem[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "cat-technical", label: "Technical SEO" },
  { id: "cat-readability", label: "Tốt cho người đọc" },
  { id: "cat-ul-li", label: "UL-LI" },
  { id: "cat-ai-opt", label: "Tối ưu AI" },
  { id: "cat-branding", label: "Branding" },
  { id: "cat-eeat", label: "E-E-A-T" },
  { id: "cat-grammar", label: "Ngữ pháp" },
  { id: "cat-trust-ai", label: "Tin cậy & Kiểm chứng AI" },
  { id: "outline-comparison", label: "So sánh Outline" },
  { id: "competitor-compare", label: "So sánh đối thủ" },
];

const ALL_SUB_IDS = SUB_ITEMS.map((s) => s.id);

interface Props {
  view: ViewMode;
  onChangeView: (v: ViewMode) => void;
  resultVersion?: number;
  historyCount?: number;
}

/* ───────── Component ───────── */

export default function Sidebar({
  view,
  onChangeView,
  resultVersion = 0,
  historyCount,
}: Props) {
  const { user, logout } = useAuth();
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [availableSubs, setAvailableSubs] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Click-away for user menu */
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  /* Scroll-spy — only meaningful in review view */
  useEffect(() => {
    if (view !== "review") {
      setActiveSub(null);
      setAvailableSubs(new Set());
      return;
    }
    const present = new Set<string>();
    ALL_SUB_IDS.forEach((id) => {
      if (document.getElementById(id)) present.add(id);
    });
    setAvailableSubs(present);

    if (present.size === 0) {
      setActiveSub(null);
      return;
    }

    const OFFSET = 120;
    const update = () => {
      let bestId: string | null = null;
      let bestTop = -Infinity;
      for (const id of ALL_SUB_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= OFFSET && top > bestTop) {
          bestTop = top;
          bestId = id;
        }
      }
      if (bestId) setActiveSub(bestId);
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [resultVersion, view]);

  const handleJump = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSub(id);
    }
  };

  const initial = (user?.name || user?.email || "?")[0]?.toUpperCase();

  const AVATAR_COLOR_BG: Record<string, string> = {
    emerald: "from-emerald-400 to-teal-500",
    sky: "from-sky-400 to-blue-500",
    violet: "from-violet-400 to-purple-500",
    rose: "from-rose-400 to-pink-500",
    amber: "from-amber-400 to-orange-500",
    indigo: "from-indigo-400 to-blue-600",
    slate: "from-slate-400 to-slate-600",
    teal: "from-teal-400 to-cyan-500",
  };
  const avatarBg = AVATAR_COLOR_BG[user?.avatarColor || "emerald"] || AVATAR_COLOR_BG.emerald;

  return (
    <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 h-screen">
      <div className="px-4 pt-3 pb-1 overflow-hidden">
        <a href="/" className="block">
          <img
            src="/mindgate-logo.png"
            alt="MindGate"
            className="w-full h-auto object-contain block dark:hidden -my-6"
          />
          <img
            src="/mindgate-logo-dark.png"
            alt="MindGate"
            className="w-full h-auto object-contain hidden dark:block -my-6"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2 text-center">
            SEO Content Reviewer · v0.3
          </p>
        </a>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto scrollbar-thin pb-4">
        <p className="px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        <ul className="space-y-0.5">
          {TOP_LEVEL.map((item) => {
            const isActive = view === item.id;
            const onClick = () => {
              if (item.soon) return;
              onChangeView(item.id as ViewMode);
            };
            const badge =
              item.id === "history" && typeof historyCount === "number"
                ? String(historyCount)
                : item.badge;
            return (
              <li key={item.id}>
                <TopButton
                  item={{ ...item, badge }}
                  active={isActive}
                  onClick={onClick}
                />
                {isActive && item.id === "review" && (
                  <SubMenu
                    activeSub={activeSub}
                    available={availableSubs}
                    onJump={handleJump}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70 relative" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl bg-white dark:bg-slate-800 shadow-soft ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition"
            >
              <LogoutIcon className="h-4 w-4 text-slate-400" />
              Đăng xuất
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
        >
          <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarBg} text-white grid place-items-center text-sm font-semibold shrink-0`}>
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {user?.name || user?.email || "Khách"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
          <ChevronIcon
            className={`h-4 w-4 text-slate-400 transition ${
              menuOpen ? "-rotate-90" : "rotate-90"
            }`}
          />
        </button>
      </div>
    </aside>
  );
}

/* ───────── Sub-components ───────── */

function TopButton({
  item,
  active,
  onClick,
}: {
  item: TopItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        active
          ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium"
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-gradient-to-b from-brand-500 to-brand-700" />
      )}
      <Icon
        className={`h-5 w-5 shrink-0 ${
          active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
        }`}
      />
      <span className="flex-1 text-left truncate">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 num">
          {item.badge}
        </span>
      )}
      {item.soon && !item.badge && (
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          Soon
        </span>
      )}
      {active && (
        <ChevronIcon className="h-3.5 w-3.5 text-brand-500 rotate-90" />
      )}
    </button>
  );
}

function SubMenu({
  activeSub,
  available,
  onJump,
}: {
  activeSub: string | null;
  available: Set<string>;
  onJump: (id: string) => void;
}) {
  const empty = available.size === 0;

  return (
    <div className="mt-1 mb-2 ml-[26px] pl-3 border-l border-slate-200 dark:border-slate-700">
      {empty && (
        <p className="px-2 py-2 text-[12px] text-slate-400 dark:text-slate-500 italic">
          Phân tích bài để xem mục lục
        </p>
      )}

      {!empty && (
        <div className="space-y-0.5">
          {/* Only show sections that actually exist on the page (e.g. "So sánh
              Outline" hides when the article has no outline) — no dead/greyed items. */}
          {SUB_ITEMS.filter((s) => available.has(s.id)).map((s) => (
            <SubButton
              key={s.id}
              label={s.label}
              active={activeSub === s.id}
              disabled={false}
              onClick={() => onJump(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative block w-full text-left text-[13px] pl-3 pr-2 py-1.5 -ml-[13px] rounded-r-lg transition outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        active
          ? "border-l-2 border-brand-500 bg-brand-50/60 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium"
          : disabled
          ? "border-l border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed"
          : "border-l border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}
