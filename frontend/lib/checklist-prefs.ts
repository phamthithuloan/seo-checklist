import { ALL_RULE_IDS, CONFIG_RULES, type ConfigField } from "./checklist-rules";
import type { AnalysisConfig } from "./api";

/**
 * Storage strategy: persist *disabled* rule IDs (not enabled).
 * Default = everything enabled. User adds to the disabled list to opt out.
 * This way new rules added in future versions are automatically enabled
 * (instead of falling out because they weren't in the stored "enabled" list).
 */
const KEY_DISABLED = "seo:disabled-rules";
const KEY_CONFIG = "seo:config";
const LEGACY_KEY_ENABLED = "seo:enabled-rules";
const LEGACY_KEY_ENABLED_MANUAL = "seo:enabled-manual-rules";

function migrateLegacy(): void {
  if (typeof window === "undefined") return;
  // Old versions stored "enabled" lists. Rule set has expanded since;
  // discard to start fresh with all-enabled defaults.
  for (const k of [LEGACY_KEY_ENABLED, LEGACY_KEY_ENABLED_MANUAL]) {
    if (window.localStorage.getItem(k) !== null) {
      window.localStorage.removeItem(k);
    }
  }
}

function readDisabled(): string[] {
  if (typeof window === "undefined") return [];
  migrateLegacy();
  try {
    const raw = window.localStorage.getItem(KEY_DISABLED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x: unknown): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function getEnabledRules(): string[] {
  const disabled = new Set(readDisabled());
  return ALL_RULE_IDS.filter((id) => !disabled.has(id));
}

export function setEnabledRules(ids: string[]): void {
  if (typeof window === "undefined") return;
  const enabled = new Set(ids);
  const disabled = ALL_RULE_IDS.filter((id) => !enabled.has(id));
  window.localStorage.setItem(KEY_DISABLED, JSON.stringify(disabled));
}

export function getConfig(): AnalysisConfig {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_CONFIG);
    if (!raw) return {};
    return JSON.parse(raw) as AnalysisConfig;
  } catch {
    return {};
  }
}

export function setConfig(cfg: AnalysisConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
}

/** Determine if a config rule has been filled in by the user. */
export function configHasValue(
  cfg: AnalysisConfig,
  field: ConfigField,
): boolean {
  const v = cfg[field];
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.filter((x) => x.trim().length > 0).length > 0;
  return false;
}

/** Return only config entries that have non-empty values. */
export function compactConfig(cfg: AnalysisConfig): AnalysisConfig {
  const out: AnalysisConfig = {};
  for (const r of CONFIG_RULES) {
    if (!r.configField) continue;
    const v = cfg[r.configField];
    if (typeof v === "string") {
      if (v.trim()) (out as any)[r.configField] = v.trim();
    } else if (Array.isArray(v)) {
      const cleaned = v.map((x) => x.trim()).filter(Boolean);
      if (cleaned.length > 0) (out as any)[r.configField] = cleaned;
    }
  }
  return out;
}
