import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  it("renders all navigation items and calls onSelectView (happy path)", () => {
    const onSelect = vi.fn();
    const onImport = vi.fn();
    render(<Sidebar activeView="overview" onSelectView={onSelect} onOpenImport={onImport} />);
    expect(screen.getByLabelText("Overview")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Conversations")).toBeInTheDocument();
    expect(screen.getByLabelText("Import")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Search"));
    expect(onSelect).toHaveBeenCalledWith("search");
    fireEvent.click(screen.getByLabelText("Conversations"));
    expect(onSelect).toHaveBeenCalledWith("conversations");
    fireEvent.click(screen.getByLabelText("Import"));
    expect(onImport).toHaveBeenCalled();
  });

  it("highlights active view", () => {
    const { rerender } = render(
      <Sidebar activeView="search" onSelectView={vi.fn()} onOpenImport={vi.fn()} />
    );
    expect(screen.getByLabelText("Search").className).toContain("active");
    rerender(<Sidebar activeView="settings" onSelectView={vi.fn()} onOpenImport={vi.fn()} />);
    expect(screen.getByLabelText("Settings").className).toContain("active");
  });
});
