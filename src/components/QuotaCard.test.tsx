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

const preferences: WidgetPreferences = { locked: false, alwaysOnTop: true, stayExpanded: true, pinnedProvider: "codex", autoRotateSeconds: 12, language: "zh-CN" };
const noop = () => undefined;

afterEach(cleanup);

it("switches between the 5-hour and weekly quota", () => {
  render(<QuotaCard snapshot={snapshot} preferences={preferences} onDrag={noop} onHover={noop} />);

  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("74");
  const weekly = screen.getByRole("button", { name: "显示周额度" });
  expect(weekly.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(weekly);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
  expect(weekly.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "显示 5 小时额度" }).getAttribute("aria-pressed")).toBe("false");
});

it("keeps controls clickable while the rest of the shell remains draggable", () => {
  const onDrag = vi.fn();
  render(<QuotaCard snapshot={snapshot} preferences={preferences} onDrag={onDrag} onHover={noop} />);

  fireEvent.mouseDown(screen.getByRole("main"), { button: 0 });
  fireEvent.mouseDown(screen.getByRole("button", { name: "显示周额度" }), { button: 0 });

  expect(onDrag).toHaveBeenCalledTimes(1);
});

it("shows the only available window without a disabled switch", () => {
  render(<QuotaCard snapshot={{ ...snapshot, shortWindow: null, plan: "PLUS" }} preferences={preferences} onDrag={noop} onHover={noop} />);

  expect(screen.queryByRole("button", { name: "显示 5 小时额度" })).toBeNull();
  expect(screen.getByText("PLUS")).toBeTruthy();
  expect(screen.getByText("周额度")).toBeTruthy();
});
