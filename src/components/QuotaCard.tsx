import { memo, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useId, useRef, useState } from "react";
import { clampPercent, formatResetTime, quotaTier } from "../lib/format";
import { copy, normalizeLanguage } from "../lib/i18n";
import type { Language, ProviderSnapshot, WidgetPreferences } from "../types";

interface Props {
  snapshot: ProviderSnapshot;
  preferences: WidgetPreferences;
  expanded: boolean;
  draggable?: boolean;
  onDrag: () => void;
  onExpandedChange: (expanded: boolean) => void;
  onRefresh?: () => void;
  isConsuming?: boolean;
  notice?: ReactNode;
}

type QuotaWindow = "short" | "weekly";
type PointerGesture = { id: number; x: number; y: number };

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d={expanded ? "m11 10-3-3-3 3" : "m5 6 3 3 3-3"} />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M16.2 8A6.4 6.4 0 1 0 16 12.7" />
      <path d="M16.2 3.8V8H12" />
    </svg>
  );
}

function StatusIcon({ status, expired = false }: { status: ProviderSnapshot["status"]; expired?: boolean }) {
  if (status === "signed_out") {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v12h4M12 6l4 4-4 4M16 10H7" /></svg>;
  }
  if (status === "stale" || expired) {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.5 1.5" /></svg>;
  }
  if (status === "unavailable") {
    return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 14.5h9a3 3 0 0 0 .7-5.9A5.5 5.5 0 0 0 5 7.5a3.6 3.6 0 0 0 .5 7Z" /><path d="m5 5 10 10" /></svg>;
  }
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5 17 16H3L10 3.5Z" /><path d="M10 8v3.5M10 14h.01" /></svg>;
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
  expanded,
  draggable = true,
  onDrag,
  onExpandedChange,
  onRefresh,
  isConsuming = false,
  notice = null,
}: Props) {
  const [selectedKind, setSelectedKind] = useState<QuotaWindow>(() => snapshot.shortWindow ? "short" : "weekly");
  const detailsId = useId();
  const pointerGesture = useRef<PointerGesture | null>(null);
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
  const cardStyle = { "--meter-fill": `${displayPercent ?? 0}%` } as CSSProperties;
  const errorTitle = snapshot.status === "signed_out"
    ? (expanded ? t.signedInRequired : t.signedOutShort)
    : staleExpired
      ? (expanded ? t.staleExpired : t.expiredShort)
      : (expanded ? t.temporarilyUnavailable : t.unavailableShort);

  const toggleExpanded = () => onExpandedChange(!expanded);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
    pointerGesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = pointerGesture.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6) return;
    pointerGesture.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!draggable) return;
    onDrag();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = pointerGesture.current;
    pointerGesture.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!gesture || gesture.id !== event.pointerId || (event.target as Element).closest("button")) return;
    toggleExpanded();
  };

  const detailsButton = (
    <button
      type="button"
      className="details-toggle"
      onClick={toggleExpanded}
      aria-expanded={expanded}
      aria-controls={expanded ? detailsId : undefined}
      aria-label={expanded ? t.collapseDetails : t.expandDetails}
    >
      <ChevronIcon expanded={expanded} />
    </button>
  );

  return (
    <main
      className={`quota-card quota-card--${snapshot.status} quota-card--${tier}${activeKind === "weekly" ? " quota-card--weekly" : ""}${expanded ? " quota-card--expanded" : ""}${draggable ? "" : " quota-card--static"}`}
      style={cardStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerGesture.current = null; }}
    >
      <div className="gauge-shell">
        <span className="sr-only" aria-live="polite">{available ? quotaAriaLabel : message}</span>
        {notice ? <div className="operation-notice" role="status">{notice}</div> : null}
        {detailsButton}

        {available ? (
          <section className="quota-content">
            <div className="quota-reading">
              <span className="quota-meter" aria-hidden="true"><i /></span>
              <div className="quota-value" role="progressbar" aria-label={quotaAriaLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayPercent ?? undefined}>
                <strong>{displayPercent}</strong>
                <small>%</small>
                <span className="quota-window-chip">{activeKind === "weekly" ? t.weeklyAbbrev : t.shortAbbrev}</span>
              </div>
            </div>

            {expanded ? (
              <>
                <span className="quota-divider" aria-hidden="true" />
                <div className="quota-details" id={detailsId}>
                  <div className="quota-details-top">
                    <span className="quota-plan">{snapshot.displayName} · {snapshot.plan ?? t.accountFallback}</span>
                    <span className={`usage-indicator usage-indicator--${indicatorState}`} role="img" title={indicatorLabel} aria-label={indicatorLabel}><i /></span>
                  </div>
                  {canSwitchWindow ? (
                    <div className="quota-switch" aria-label={t.quotaWindowControl}>
                      <button type="button" onClick={() => setSelectedKind("short")} aria-pressed={activeKind === "short"} aria-label={t.showShortQuota}>
                        <span>{t.shortControl}</span><strong>{clampPercent(snapshot.shortWindow!.remainingPercent)}%</strong>
                      </button>
                      <button type="button" onClick={() => setSelectedKind("weekly")} aria-pressed={activeKind === "weekly"} aria-label={t.showWeeklyQuota}>
                        <span>{t.weeklyControl}</span><strong>{clampPercent(snapshot.weeklyWindow!.remainingPercent)}%</strong>
                      </button>
                    </div>
                  ) : <span className="quota-window-label">{activeKind === "weekly" ? t.weeklyControl : t.shortControl}</span>}
                  <p className="quota-reset">{resetLabel}</p>
                </div>
              </>
            ) : null}
          </section>
        ) : (
          <section className="quota-error" aria-live="polite">
            <div className="status-icon" aria-hidden="true"><StatusIcon status={snapshot.status} expired={staleExpired} /></div>
            <div className="quota-error-copy">
              <strong>{errorTitle}</strong>
              {expanded ? <p id={detailsId}>{message ?? t.errorUnavailable}</p> : null}
            </div>
            <div className="quota-error-actions">
              {snapshot.status === "stale" && expanded ? (
                <button type="button" className="error-refresh-button" onClick={onRefresh} disabled={!onRefresh} aria-label={t.refreshQuota}>
                  <RefreshIcon />
                </button>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </main>
  );
});
