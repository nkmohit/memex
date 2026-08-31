import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPanel from "./SettingsPanel";
import { resetFlags, isEnabled } from "../lib/flags";

describe("SettingsPanel flags", () => {
  beforeEach(() => {
    resetFlags();
    try {
      localStorage.clear();
    } catch {}
  });

  it("renders all flag toggles", () => {
    render(
      <SettingsPanel
        theme="light"
        onSetTheme={vi.fn()}
        clearingData={false}
        importing={false}
        loading={false}
        onClearAllDataClick={vi.fn()}
        clearDataTriggerRef={{ current: null }}
      />
    );
    expect(screen.getByText("Feature flags")).toBeInTheDocument();
    expect(screen.getByLabelText("Semantic search (hybrid FTS + vector)")).toBeInTheDocument();
    expect(screen.getByLabelText("Vector embeddings")).toBeInTheDocument();
    expect(screen.getByLabelText("Offline summarize (Insights)")).toBeInTheDocument();
    expect(screen.getByLabelText("Topic timeline")).toBeInTheDocument();
  });

  it("toggles flag on click", () => {
    render(
      <SettingsPanel
        theme="light"
        onSetTheme={vi.fn()}
        clearingData={false}
        importing={false}
        loading={false}
        onClearAllDataClick={vi.fn()}
        clearDataTriggerRef={{ current: null }}
      />
    );
    const checkbox = screen.getByLabelText("Vector embeddings") as HTMLInputElement;
    const initial = isEnabled("vector");
    fireEvent.click(checkbox);
    expect(isEnabled("vector")).toBe(!initial);
    expect(checkbox.checked).toBe(!initial);
  });
});
