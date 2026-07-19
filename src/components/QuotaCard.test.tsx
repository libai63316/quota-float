// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ProviderSnapshot, WidgetPreferences } from "../types";
import { QuotaCard } from "./QuotaCard";

const snapshot: ProviderSnapshot = {
  provider: "codex",
  displayName: "CODEX",
  plan: "PRO",
  shortWindow: { remainingPercent: 74, resetsAt: "2026-07-16T12:00:00Z", windowSeconds: 18_000 },
  weeklyWindow: { remainingPercent: 42, resetsAt: "2026-07-20T12:00:00Z", windowSeconds: 604_800 },
  resetCredits: 0,
  updatedAt: "2026-07-16T08:00:00Z",
  status: "ok",
  message: null,
};

const preferences: WidgetPreferences = { locked: false, alwaysOnTop: true, stayExpanded: false, pinnedProvider: "codex", autoRotateSeconds: 12, language: "zh-CN" };
const noop = () => undefined;

Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent });

afterEach(cleanup);

it("switches between the 5-hour and weekly quota", () => {
  render(<QuotaCard snapshot={snapshot} preferences={preferences} expanded onDrag={noop} onExpandedChange={noop} />);

  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("74");
  const weekly = screen.getByRole("button", { name: "显示周额度" });
  expect(weekly.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(weekly);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
  expect(weekly.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "显示 5 小时额度" }).getAttribute("aria-pressed")).toBe("false");
});

it("toggles details on click without reacting to hover", () => {
  const onExpandedChange = vi.fn();
  render(<QuotaCard snapshot={snapshot} preferences={preferences} expanded={false} onDrag={noop} onExpandedChange={onExpandedChange} />);

  fireEvent.mouseEnter(screen.getByRole("main"));
  expect(onExpandedChange).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "展开额度详情" }));
  expect(onExpandedChange).toHaveBeenCalledWith(true);
});

it("separates a click from a drag with a movement threshold", () => {
  const onDrag = vi.fn();
  const onExpandedChange = vi.fn();
  render(<QuotaCard snapshot={snapshot} preferences={preferences} expanded={false} onDrag={onDrag} onExpandedChange={onExpandedChange} />);
  const card = screen.getByRole("main");

  fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerUp(card, { pointerId: 1, clientX: 12, clientY: 12 });
  expect(onExpandedChange).toHaveBeenCalledWith(true);
  expect(onDrag).not.toHaveBeenCalled();

  fireEvent.pointerDown(card, { button: 0, pointerId: 2, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(card, { pointerId: 2, clientX: 20, clientY: 10 });
  expect(onDrag).toHaveBeenCalledTimes(1);
});

it("shows the only available window without a disabled switch", () => {
  render(<QuotaCard snapshot={{ ...snapshot, shortWindow: null, plan: "PLUS" }} preferences={preferences} expanded onDrag={noop} onExpandedChange={noop} />);

  expect(screen.queryByRole("button", { name: "显示 5 小时额度" })).toBeNull();
  expect(screen.getByText(/CODEX · PLUS/)).toBeTruthy();
  expect(screen.getByText("周额度")).toBeTruthy();
});

it("keeps the same focused toggle when details mount", () => {
  const { rerender } = render(<QuotaCard snapshot={snapshot} preferences={preferences} expanded={false} onDrag={noop} onExpandedChange={noop} />);
  const toggle = screen.getByRole("button", { name: "展开额度详情" });
  toggle.focus();

  rerender(<QuotaCard snapshot={snapshot} preferences={preferences} expanded onDrag={noop} onExpandedChange={noop} />);

  expect(screen.getByRole("button", { name: "收起额度详情" })).toBe(toggle);
  expect(document.activeElement).toBe(toggle);
});

it("keeps refresh out of the compact stale state", () => {
  const stale = { ...snapshot, status: "stale" as const, updatedAt: "2026-07-15T00:00:00Z", message: "Refresh failed." };
  render(<QuotaCard snapshot={stale} preferences={preferences} expanded={false} onDrag={noop} onExpandedChange={noop} onRefresh={noop} />);

  expect(screen.getByText("已过期")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "刷新额度数据" })).toBeNull();
});
