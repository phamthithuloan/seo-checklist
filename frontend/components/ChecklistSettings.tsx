"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_RULES,
  ALL_RULE_IDS,
  type ConfigField,
  type RuleMeta,
} from "@/lib/checklist-rules";
import {
  getEnabledRules,
  setEnabledRules,
  getConfig,
  setConfig,
} from "@/lib/checklist-prefs";
import type { AnalysisConfig } from "@/lib/api";
import type { CategoryId } from "@/lib/types";

interface Props {
  onChange?: () => void;
}

const CATEGORY_META: Record<
  CategoryId,
  { label: string; iconBg: string; iconText: string; ringTint: string }
> = {
  technical: {
    label: "Technical SEO",
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
    ringTint: "ring-indigo-100",
  },
  readability: {
    label: "Tốt cho người đọc",
    iconBg: "bg-sky-50",
    iconText: "text-sky-600",
    ringTint: "ring-sky-100",
  },
  "ul-li": {
    label: "UL-LI",
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
    ringTint: "ring-amber-100",
  },
  "ai-opt": {
    label: "Tối ưu cho AI",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    ringTint: "ring-emerald-100",
  },
  branding: {
    label: "Branding",
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
    ringTint: "ring-violet-100",
  },
  eeat: {
    label: "E-E-A-T",
    iconBg: "bg-orange-50",
    iconText: "text-orange-600",
    ringTint: "ring-orange-100",
  },
  grammar: {
    label: "Ngữ pháp - Chính tả",
    iconBg: "bg-slate-100",
    iconText: "text-slate-700",
    ringTint: "ring-slate-200",
  },
  "trust-ai": {
    label: "Tin cậy & Kiểm chứng AI",
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    ringTint: "ring-rose-100",
  },
  cta: {
    label: "CTA",
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    ringTint: "ring-rose-100",
  },
};

// grammar + trust-ai cố ý KHÔNG ở đây: chúng là các tiêu chí AID, bật/tắt theo
// từng bài qua 2 checkbox AI ở form phân tích (tránh điều khiển trùng 2 nơi).
const CATEGORY_ORDER: CategoryId[] = [
  "technical",
  "readability",
  "ul-li",
  "ai-opt",
  "branding",
  "eeat",
];

function groupByCategory(rules: RuleMeta[]) {
  const m = new Map<CategoryId, RuleMeta[]>();
  for (const c of CATEGORY_ORDER) m.set(c, []);
  for (const r of rules) m.get(r.category)?.push(r);
  return m;
}

function valueAsString(cfg: AnalysisConfig, field: ConfigField): string {
  const v = cfg[field];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join("\n");
  return "";
}

function parseConfigInput(
  value: string,
  inputType: "list" | "text" | undefined,
): string | string[] {
  if (inputType === "text") return value;
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ChecklistSettings({ onChange }: Props) {
  const [enabled, setEnabledState] = useState<Set<string>>(
    new Set(ALL_RULE_IDS),
  );
  const [cfg, setCfg] = useState<AnalysisConfig>({});
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setEnabledState(new Set(getEnabledRules()));
    setCfg(getConfig());
  }, []);

  const groups = useMemo(() => groupByCategory(ALL_RULES), []);

  const toggle = (id: string) => {
    setEnabledState((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const updateConfig = (field: ConfigField, value: string | string[]) => {
    setCfg((prev) => ({ ...prev, [field]: value }));
  };

  const selectAll = () => setEnabledState(new Set(ALL_RULE_IDS));
  const selectNone = () => setEnabledState(new Set());

  const save = () => {
    const ids = ALL_RULE_IDS.filter((id) => enabled.has(id));
    setEnabledRules(ids);
    setConfig(cfg);
    onChange?.();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const stats = (() => {
    // Only the rule-based categories shown here (AI checks live in the analyze form).
    const shown = ALL_RULES.filter((r) => CATEGORY_ORDER.includes(r.category));
    const total = shown.length;
    const byKind = { auto: 0, config: 0, heuristic: 0 };
    let enabledCount = 0;
    for (const r of shown)
      if (enabled.has(r.id)) {
        enabledCount++;
        byKind[r.kind]++;
      }
    return { total, enabledCount, ...byKind };
  })();

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70 px-5 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Đang bật{" "}
            <span className="num text-brand-600">{stats.enabledCount}</span> /{" "}
            {stats.total} tiêu chí
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="text-emerald-700 dark:text-emerald-300 font-mono">Auto</span> tự chấm ·{" "}
            <span className="text-violet-700 font-mono">Config</span> cần điền
            input để tool chấm ·{" "}
            <span className="text-sky-700 font-mono">Heuristic</span> tool đoán
            best-effort
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Các tiêu chí AI (ngữ pháp, chính tả, kiểm chứng nội dung) bật/tắt theo từng bài bằng 2 ô tick ở form phân tích — không cấu hình ở đây.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Chọn hết
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Bỏ chọn
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white shadow-glow transition"
          >
            Lưu lựa chọn
          </button>
          {savedToast && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Đã lưu
            </span>
          )}
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const rules = groups.get(cat) || [];
        if (rules.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const checked = rules.filter((r) => enabled.has(r.id)).length;
        return (
          <section
            key={cat}
            className="rounded-2xl bg-white dark:bg-slate-900 shadow-soft ring-1 ring-slate-200/70 dark:ring-slate-700/70"
          >
            <header className="px-5 md:px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-9 w-9 rounded-xl ${meta.iconBg} ${meta.iconText} grid place-items-center ring-1 ${meta.ringTint}`}
                >
                  <span className="text-sm font-semibold">{meta.label[0]}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {meta.label}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {rules.length} tiêu chí
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 num">
                {checked}/{rules.length}
              </span>
            </header>

            <ul className="divide-y divide-slate-100">
              {rules.map((r) => {
                const isOn = enabled.has(r.id);
                const isConfig = r.kind === "config";
                return (
                  <li key={r.id} className="px-5 md:px-6 py-3.5">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => toggle(r.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {r.label}
                          </span>
                          <KindChip kind={r.kind} />
                          {r.threshold && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                              {r.threshold}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                            {r.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {r.description}
                        </p>
                      </div>
                    </label>

                    {isConfig && isOn && r.configField && (
                      <div className="mt-3 ml-7">
                        {r.inputType === "text" ? (
                          <input
                            type="text"
                            value={valueAsString(cfg, r.configField)}
                            onChange={(e) =>
                              updateConfig(
                                r.configField!,
                                parseConfigInput(
                                  e.target.value,
                                  r.inputType,
                                ) as string,
                              )
                            }
                            placeholder={r.placeholder}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
                          />
                        ) : (
                          <textarea
                            value={valueAsString(cfg, r.configField)}
                            onChange={(e) =>
                              updateConfig(
                                r.configField!,
                                parseConfigInput(
                                  e.target.value,
                                  r.inputType,
                                ) as string[],
                              )
                            }
                            rows={3}
                            placeholder={r.placeholder}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition resize-y"
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function KindChip({ kind }: { kind: "auto" | "config" | "heuristic" }) {
  const styles = {
    auto: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    config: "bg-violet-50 text-violet-700 ring-violet-200",
    heuristic: "bg-sky-50 text-sky-700 ring-sky-200",
  } as const;
  const label = { auto: "Auto", config: "Config", heuristic: "Heuristic" }[
    kind
  ];
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 ${styles[kind]}`}
    >
      {label}
    </span>
  );
}
