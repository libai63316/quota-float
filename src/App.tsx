import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuotaCard } from "./components/QuotaCard";
import { checkForAppUpdate } from "./lib/appUpdate";
import { fetchSnapshots, getPreferences, listenDesktopEvents, setWidgetExpanded, startDragging } from "./lib/bridge";
import { needsFastRefresh } from "./lib/format";
import { copy, normalizeLanguage } from "./lib/i18n";
import { mergeSnapshots } from "./lib/snapshots";
import type { ProviderSnapshot, WidgetPreferences } from "./types";

const DEFAULT_PREFS: WidgetPreferences = { locked: false, alwaysOnTop: true, stayExpanded: false, pinnedProvider: null, autoRotateSeconds: 12, language: "zh-CN" };

export default function App() {
  const [snapshots, setSnapshots] = useState<ProviderSnapshot[]>([]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFS);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [consumingProviders, setConsumingProviders] = useState<Set<string>>(() => new Set());
  const [operationError, setOperationError] = useState<string | null>(null);
  const failures = useRef(0);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const expansionTarget = useRef(false);
  const preferencesReady = useRef(false);
  const stayExpandedPreference = useRef(DEFAULT_PREFS.stayExpanded);
  const previousPrimary = useRef(new Map<string, number>());
  const consumptionTimers = useRef(new Map<string, number>());
  const noticeTimer = useRef<number | null>(null);
  const language = normalizeLanguage(preferences.language);
  const t = copy[language];

  const showNotice = useCallback((message: string | null) => {
    setOperationError(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = message === null ? null : window.setTimeout(() => {
      setOperationError(null);
      noticeTimer.current = null;
    }, 6_000);
  }, []);

  const refresh = useCallback((force = false): Promise<void> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const request = (async () => {
      try {
        const values = await fetchSnapshots(force);
        const hasFailure = values.some((item) => item.status !== "ok");
        if (hasFailure) failures.current += 1;
        else failures.current = 0;
        for (const item of values) {
          const nextPrimary = item.shortWindow?.remainingPercent;
          const previous = previousPrimary.current.get(item.provider);
          if (nextPrimary !== undefined && previous !== undefined && nextPrimary < previous) {
            setConsumingProviders((current) => new Set(current).add(item.provider));
            const oldTimer = consumptionTimers.current.get(item.provider);
            if (oldTimer !== undefined) window.clearTimeout(oldTimer);
            const timer = window.setTimeout(() => {
              setConsumingProviders((current) => { const next = new Set(current); next.delete(item.provider); return next; });
              consumptionTimers.current.delete(item.provider);
            }, 5 * 60_000);
            consumptionTimers.current.set(item.provider, timer);
          }
          if (nextPrimary !== undefined) previousPrimary.current.set(item.provider, nextPrimary);
        }
        setSnapshots((current) => mergeSnapshots(current, values));
      } catch {
        failures.current += 1;
        setSnapshots((current) => current.length > 0
          ? current.map((item) => ({ ...item, status: "stale", message: "Refresh failed. Please try again later." }))
          : [{ provider: "codex", displayName: "CODEX", plan: null, shortWindow: null, weeklyWindow: null, resetCredits: null, resetCreditExpiresAt: [], updatedAt: new Date().toISOString(), status: "unavailable", message: "Quota is temporarily unavailable. It will retry automatically." }]);
      }
    })();
    refreshInFlight.current = request;
    void request.finally(() => {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    });
    return request;
  }, []);

  const changeExpanded = useCallback(async (value: boolean, refreshOnOpen = true) => {
    if (expansionTarget.current === value) return;
    expansionTarget.current = value;
    try {
      if (value) {
        await setWidgetExpanded(true);
        if (!expansionTarget.current) return;
        setExpanded(true);
        if (refreshOnOpen) void refresh(true);
        return;
      }
      setExpanded(false);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      if (expansionTarget.current) return;
      await setWidgetExpanded(false);
    } catch {
      expansionTarget.current = !value;
      setExpanded(!value);
      showNotice("悬浮窗尺寸调整失败 / Widget resize failed.");
    }
  }, [refresh, showNotice]);

  const applyPreferences = useCallback((value: WidgetPreferences) => {
    const next = { ...DEFAULT_PREFS, ...value, language: normalizeLanguage(value.language) };
    const expansionPreferenceChanged = !preferencesReady.current || stayExpandedPreference.current !== next.stayExpanded;
    preferencesReady.current = true;
    stayExpandedPreference.current = next.stayExpanded;
    setPreferences(next);
    if (expansionPreferenceChanged) void changeExpanded(next.stayExpanded, false);
  }, [changeExpanded]);

  useEffect(() => {
    void refresh(true);
    void getPreferences().then(applyPreferences).catch(() => showNotice("无法读取设置，已使用默认值。"));
    return () => {
      for (const timer of consumptionTimers.current.values()) window.clearTimeout(timer);
      consumptionTimers.current.clear();
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, [applyPreferences, refresh, showNotice]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: () => void = () => {};
    const checkForUpdates = () => void checkForAppUpdate(language, {
      checking: t.updateChecking,
      current: t.updateCurrent,
      downloading: t.updateDownloading,
      installing: t.updateInstalling,
      availableWindows: t.updateAvailableWindows,
      availableMac: t.updateAvailableMac,
      failed: t.updateFailed,
    }, showNotice, true);
    const refreshFromMenu = () => {
      showNotice(t.resetUpdating);
      void refresh(true);
    };
    void listenDesktopEvents({ onPreferences: applyPreferences, onRefresh: refreshFromMenu, onUpdate: checkForUpdates }).then((value) => {
      if (cancelled) value(); else cleanup = value;
    }).catch(() => showNotice(language === "en" ? "Desktop controls failed to start." : "桌面控制监听启动失败。"));
    return () => { cancelled = true; cleanup(); };
  }, [applyPreferences, language, refresh, showNotice, t]);

  const refreshMs = useMemo(() => {
    const backoff = failures.current === 0 ? 5 * 60_000 : Math.min(30 * 60_000, 30_000 * 2 ** (failures.current - 1));
    if (failures.current === 0 && snapshots.some((item) => item.status === "ok" && needsFastRefresh(item))) return 60_000;
    return backoff;
  }, [snapshots]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), refreshMs);
    return () => window.clearInterval(id);
  }, [refresh, refreshMs]);

  useEffect(() => {
    const refreshWhenActive = () => { if (document.visibilityState === "visible") void refresh(true); };
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [refresh]);

  useEffect(() => {
    if (preferences.pinnedProvider || snapshots.length < 2) return;
    const id = window.setInterval(() => setActiveIndex((value) => (value + 1) % snapshots.length), preferences.autoRotateSeconds * 1000);
    return () => window.clearInterval(id);
  }, [preferences.autoRotateSeconds, preferences.pinnedProvider, snapshots.length]);

  const current = preferences.pinnedProvider
    ? snapshots.find((item) => item.provider === preferences.pinnedProvider) ?? snapshots[0]
    : snapshots[activeIndex % Math.max(1, snapshots.length)];

  const handleExpandedChange = useCallback((value: boolean) => {
    void changeExpanded(value);
  }, [changeExpanded]);

  if (!current) return <div className="loading-card" aria-label={t.loadingQuota}><span /><span /><span /></div>;

  return (
    <QuotaCard
      snapshot={current}
      preferences={preferences}
      expanded={expanded}
      onDrag={() => startDragging()}
      onExpandedChange={handleExpandedChange}
      onRefresh={() => refresh(true)}
      isConsuming={consumingProviders.has(current.provider)}
      notice={operationError}
    />
  );
}
