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

const preferences: WidgetPreferences = { locked: false, alwaysOnTop: true, stayExpanded: false, pinnedProvider: "codex", autoRotateSeconds: 12, language: "zh-CN" };
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

function Preview({ mode, defaultExpanded = false }: { mode: PreviewMode; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className={`design-card-frame${expanded ? " is-expanded" : ""}`}>
      <QuotaCard
        snapshot={makePreview(mode)}
        preferences={preferences}
        expanded={expanded}
        draggable={false}
        onDrag={noop}
        onExpandedChange={setExpanded}
        onRefresh={noop}
        isConsuming={mode === 35}
      />
    </div>
  );
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
    return (
      <div className="screenshot-stage screenshot-stage--states">
        <div className="screenshot-heading"><span>QUOTA FLOAT</span><strong>每一格余量，都算数。</strong></div>
        <div className="screenshot-cards">{[74, 35, 8].map((value) => <Preview key={value} mode={value as PreviewMode} defaultExpanded />)}</div>
      </div>
    );
  }

  return (
    <main className="design-workbench">
      <header className="preview-header">
        <div>
          <span className="preview-kicker">QUOTA FLOAT · BROWSER PREVIEW</span>
          <h1>额度，一眼就够。</h1>
          <p>点击卡片展开详情，再点一次收起。这里使用模拟数据，不读取你的账户。</p>
        </div>
        <span className="preview-ready"><i /> 可交互预览</span>
      </header>
      <section className="preview-stage" aria-label="Quota Float 交互预览">
        <nav className="design-preview-switch" aria-label="额度状态预览">
          {modes.map((item) => <button type="button" key={item.value} className={mode === item.value ? "is-active" : ""} onClick={() => setMode(item.value)}>{item.label}</button>)}
        </nav>
        <Preview key={String(mode)} mode={mode} />
        <p className="preview-hint">点击切换详情 · 拖动仅在桌面应用中生效</p>
      </section>
    </main>
  );
}
