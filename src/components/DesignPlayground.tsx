import { useState } from "react";
import type { ProviderSnapshot, WidgetPreferences } from "../types";
import { QuotaCard } from "./QuotaCard";

const preview: ProviderSnapshot = {
  provider: "codex",
  displayName: "CODEX",
  plan: "PLUS",
  shortWindow: { remainingPercent: 74, resetsAt: new Date(Date.now() + 78 * 60_000).toISOString(), windowSeconds: 18_000 },
  weeklyWindow: { remainingPercent: 42, resetsAt: new Date(Date.now() + 3.2 * 86_400_000).toISOString(), windowSeconds: 604_800 },
  resetCredits: 1,
  resetCreditExpiresAt: [],
  updatedAt: new Date().toISOString(),
  status: "ok",
  message: null,
};

const preferences: WidgetPreferences = { locked: false, alwaysOnTop: true, stayExpanded: true, pinnedProvider: "codex", autoRotateSeconds: 12, language: "zh-CN" };
const noop = () => undefined;
type PreviewMode = 74 | 35 | 8 | "weekly" | "unavailable" | "stale" | "signed_out";

const modes: Array<{ value: PreviewMode; label: string }> = [
  { value: 74, label: "74%" },
  { value: 35, label: "35%" },
  { value: 8, label: "8%" },
  { value: "weekly", label: "仅周额度" },
  { value: "unavailable", label: "不可用" },
  { value: "stale", label: "已过期" },
  { value: "signed_out", label: "未登录" },
];

function makePreview(mode: PreviewMode): ProviderSnapshot {
  if (typeof mode === "number") return { ...preview, shortWindow: { ...preview.shortWindow!, remainingPercent: mode } };
  if (mode === "weekly") return { ...preview, shortWindow: null };
  if (mode === "stale") return { ...preview, status: "stale", updatedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), message: "Refresh failed. Please try again later." };
  return {
    ...preview,
    status: mode,
    shortWindow: null,
    weeklyWindow: null,
    message: mode === "signed_out" ? "Codex sign-in expired. Please sign in again." : "Quota is temporarily unavailable. It will retry automatically.",
  };
}

function Preview({ mode }: { mode: PreviewMode }) {
  return <div className="design-card-frame"><QuotaCard snapshot={makePreview(mode)} preferences={preferences} onDrag={noop} onHover={noop} isConsuming={mode === 35} /></div>;
}

export function DesignPlayground() {
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<PreviewMode>(() => {
    const value = params.get("mode");
    if (value === "caution") return 35;
    if (value === "critical") return 8;
    if (value === "weekly" || value === "unavailable" || value === "stale" || value === "signed_out") return value;
    return 74;
  });

  if (params.get("shot") === "states") {
    return <div className="screenshot-stage screenshot-stage--states">{[74, 35, 8].map((value) => <Preview key={value} mode={value as PreviewMode} />)}</div>;
  }

  return (
    <main className="design-workbench">
      <nav className="design-preview-switch" aria-label="额度状态预览">
        {modes.map((item) => <button key={item.value} className={mode === item.value ? "is-active" : ""} onClick={() => setMode(item.value)}>{item.label}</button>)}
      </nav>
      <Preview mode={mode} />
    </main>
  );
}
