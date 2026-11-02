import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPanel from "./SettingsPanel";
import { resetFlags, isEnabled } from "../lib/flags";

describe("SettingsPanel flags", () => {
  beforeEach(() => {
    resetFlags();
    try {
      localStorage.clear();
    } catch (_e) {
      void _e;
    }
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
    expect(screen.getByLabelText("Extractive summary (Insights)")).toBeInTheDocument();
    expect(screen.getByLabelText("Topic timeline")).toBeInTheDocument();
    expect(screen.queryByLabelText("Semantic search (hybrid FTS + vector)")).toBeNull();
    expect(screen.queryByLabelText("Vector embeddings")).toBeNull();
    expect(screen.queryByLabelText("Plugins")).toBeNull();
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
    const checkbox = screen.getByLabelText("Extractive summary (Insights)") as HTMLInputElement;
    const initial = isEnabled("summarize");
    fireEvent.click(checkbox);
    expect(isEnabled("summarize")).toBe(!initial);
    expect(checkbox.checked).toBe(!initial);
  });
});
