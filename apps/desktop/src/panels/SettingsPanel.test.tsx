import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPanel from "./SettingsPanel";

describe("SettingsPanel", () => {
  it("renders theme options and calls onSetTheme (happy path)", () => {
    const onSetTheme = vi.fn();
    render(
      <SettingsPanel
        theme="light"
        onSetTheme={onSetTheme}
        clearingData={false}
        importing={false}
        loading={false}
        onClearAllDataClick={vi.fn()}
        clearDataTriggerRef={{ current: null }}
      />
    );
    expect(screen.getByText("Settings")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dark"));
    expect(onSetTheme).toHaveBeenCalledWith("dark");
    fireEvent.click(screen.getByText("System"));
    expect(onSetTheme).toHaveBeenCalledWith("system");
  });

  it("disables clear button when importing", () => {
    render(
      <SettingsPanel
        theme="system"
        onSetTheme={vi.fn()}
        clearingData={false}
        importing={true}
        loading={false}
        onClearAllDataClick={vi.fn()}
        clearDataTriggerRef={{ current: null }}
      />
    );
    expect(screen.getByText("Clear all data")).toBeDisabled();
  });

  it("shows Clearing... when clearingData", () => {
    render(
      <SettingsPanel
        theme="dark"
        onSetTheme={vi.fn()}
        clearingData={true}
        importing={false}
        loading={false}
        onClearAllDataClick={vi.fn()}
        clearDataTriggerRef={{ current: null }}
      />
    );
    expect(screen.getByText("Clearing...")).toBeInTheDocument();
  });

  it("calls onClearAllDataClick", () => {
    const onClear = vi.fn();
    render(
      <SettingsPanel
        theme="light"
        onSetTheme={vi.fn()}
        clearingData={false}
        importing={false}
        loading={false}
        onClearAllDataClick={onClear}
        clearDataTriggerRef={{ current: null }}
      />
    );
    fireEvent.click(screen.getByText("Clear all data"));
    expect(onClear).toHaveBeenCalled();
  });
});
