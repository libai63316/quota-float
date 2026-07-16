import { ArrowClockwise, ClockCounterClockwise, CloudSlash, SignIn, WarningCircle } from "@phosphor-icons/react";
import { memo, type ReactNode, useState } from "react";
import { clampPercent, formatResetTime, quotaTier } from "../lib/format";
import { copy, normalizeLanguage } from "../lib/i18n";
import type { Language, ProviderSnapshot, WidgetPreferences } from "../types";

interface Props {
  snapshot: ProviderSnapshot;
  preferences: WidgetPreferences;
  onDrag: () => void;
  onHover: (hovered: boolean) => void;
  onRefresh?: () => void;
  isConsuming?: boolean;
  notice?: ReactNode;
}

type QuotaWindow = "short" | "weekly";

function StatusIcon({ status, expired = false }: { status: ProviderSnapshot["status"]; expired?: boolean }) {
  if (status === "signed_out") return <SignIn weight="duotone" />;
  if (status === "stale" || expired) return <ClockCounterClockwise weight="duotone" />;
  if (status === "unavailable") return <CloudSlash weight="duotone" />;
  return <WarningCircle weight="duotone" />;
}

function localizedBackendMessage(message: string | null, language: Language): string | null {
  if (!message || language === "en") return message;
  const normalized = message.toLowerCase();
  if (normalized.includes("sign in") || normalized.includes("login")) return "Codex 登录已失效，请重新登录。";
  if (normalized.includes("rate limited")) return "请求过于频繁，将稍后自动重试。";
  if (normalized.includes("network")) return "网络不可用，将自动重试。";
  if (normalized.includes("format")) return "额度响应格式已变化。";
  if (normalized.includes("missing the 5h")) return "额度响应缺少 5 小时窗口。";
  if (normalized.includes("refresh is already running")) return "额度正在刷新，请稍候。";
  return message;
}

export const QuotaCard = memo(function QuotaCard({
  snapshot,
  preferences,
  onDrag,
  onHover,
  onRefresh,
  isConsuming = false,
  notice = null,
}: Props) {
  const [selectedKind, setSelectedKind] = useState<QuotaWindow>(() => snapshot.shortWindow ? "short" : "weekly");
  const [hovered, setHovered] = useState(false);
  const language = normalizeLanguage(preferences.language);
  const t = copy[language];
  const selectedWindow = selectedKind === "short" ? snapshot.shortWindow : snapshot.weeklyWindow;
  const activeKind: QuotaWindow = selectedWindow ? selectedKind : snapshot.shortWindow ? "short" : "weekly";
  const displayWindow = activeKind === "short" ? snapshot.shortWindow : snapshot.weeklyWindow;
  const displayPercent = displayWindow ? clampPercent(displayWindow.remainingPercent) : null;
  const staleAge = Date.now() - new Date(snapshot.updatedAt).getTime();
  const staleExpired = snapshot.status === "stale" && staleAge > 30 * 60_000;
  const available = (snapshot.status === "ok" || (snapshot.status === "stale" && !staleExpired)) && displayPercent !== null;
  const tier = quotaTier(displayPercent);
  const quotaAriaLabel = activeKind === "weekly" ? t.weeklyAvailableLabel(displayPercent ?? 0) : t.availableLabel(displayPercent ?? 0);
  const expanded = preferences.stayExpanded || hovered;
  const indicatorState = isConsuming ? "active" : snapshot.status === "ok" ? "ok" : snapshot.status === "stale" ? "stale" : "error";
  const indicatorLabel = isConsuming
    ? t.active
    : snapshot.status === "ok"
      ? t.dataSynced
      : snapshot.status === "stale"
        ? t.dataStale
        : snapshot.status === "signed_out"
          ? t.notSignedIn
          : t.unavailableStatus;
  const message = localizedBackendMessage(snapshot.message, language);
  const resetLabel = formatResetTime(displayWindow?.resetsAt ?? null, new Date(), language);
  const canSwitchWindow = Boolean(snapshot.shortWindow && snapshot.weeklyWindow);

  const handleHover = (value: boolean) => {
    setHovered(value);
    onHover(value);
  };

  return (
    <main
      className={`quota-card quota-card--${snapshot.status} quota-card--${tier}${activeKind === "weekly" ? " quota-card--weekly" : ""}${expanded ? " quota-card--expanded" : ""}`}
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
      onMouseDown={(event) => {
        if (event.button === 0 && !(event.target as Element).closest("button")) void onDrag();
      }}
    >
      <div className="obsidian-shell">
        <span className="sr-only" aria-live="polite">{available ? quotaAriaLabel : message}</span>
        {notice ? <div className="operation-notice" role="status">{notice}</div> : null}

        {available ? (
          <section className="quota-content">
            <div className="quota-value" role="progressbar" aria-label={quotaAriaLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayPercent ?? undefined}>
              <span className="quota-value-ghost" aria-hidden="true">{displayPercent}</span>
              <strong>{displayPercent}</strong>
              <small>%</small>
              <i className="quota-value-slice quota-value-slice--mint" aria-hidden="true" />
              <i className="quota-value-slice quota-value-slice--violet" aria-hidden="true" />
            </div>

            <div className="quota-details" aria-hidden={!expanded}>
              <div className="quota-details-top">
                <span className="quota-plan">{snapshot.plan ?? t.accountFallback}</span>
                {canSwitchWindow ? (
                  <div className="quota-switch">
                    <button type="button" onClick={() => setSelectedKind("weekly")} aria-pressed={activeKind === "weekly"} aria-label={t.showWeeklyQuota}>
                      {t.weeklyControl}
                    </button>
                    <button type="button" onClick={() => setSelectedKind("short")} aria-pressed={activeKind === "short"} aria-label={t.showShortQuota}>
                      {t.shortControl}
                    </button>
                  </div>
                ) : <span className="quota-window-label">{activeKind === "weekly" ? t.weeklyControl : t.shortControl}</span>}
              </div>
              <p className="quota-reset">
                <span className={`usage-indicator usage-indicator--${indicatorState}`} aria-hidden="true"><i /></span>
                {resetLabel}
                <span className="sr-only"> · {indicatorLabel}</span>
              </p>
            </div>
          </section>
        ) : (
          <section className="quota-error" aria-live="polite">
            <div className="status-icon" aria-hidden="true"><StatusIcon status={snapshot.status} expired={staleExpired} /></div>
            <div className="quota-error-copy">
              <strong>{snapshot.status === "signed_out" ? t.signedInRequired : staleExpired ? t.staleExpired : t.temporarilyUnavailable}</strong>
              <p>{message ?? t.errorUnavailable}</p>
            </div>
            {snapshot.status === "stale" ? (
              <button type="button" className="error-refresh-button" onMouseDown={(event) => event.stopPropagation()} onClick={onRefresh} disabled={!onRefresh} aria-label={t.refreshQuota}>
                <ArrowClockwise />
              </button>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
});
