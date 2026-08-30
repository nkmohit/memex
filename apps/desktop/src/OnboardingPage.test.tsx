import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingPage from "./OnboardingPage";

describe("OnboardingPage", () => {
  it("renders source cards and calls onImport (happy path)", () => {
    const onImport = vi.fn();
    render(
      <OnboardingPage
        onImport={onImport}
        importing={false}
        importingSource={null}
        onCancelImport={vi.fn()}
        importProgress={null}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText("Initialize Your Local Memory")).toBeInTheDocument();
    const importButtons = screen.getAllByText("Import");
    expect(importButtons.length).toBeGreaterThan(0);
    fireEvent.click(importButtons[0]!);
    expect(onImport).toHaveBeenCalled();
  });

  it("shows importing state with cancel", () => {
    const onCancel = vi.fn();
    render(
      <OnboardingPage
        onImport={vi.fn()}
        importing={true}
        importingSource="claude"
        onCancelImport={onCancel}
        importProgress={{ conversationsDone: 1, conversationsTotal: 2, messagesDone: 10, messagesTotal: 20 }}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText("Cancel import")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel import"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows no Coming soon when all sources are available (4/4)", () => {
    render(
      <OnboardingPage onImport={vi.fn()} importing={false} importingSource={null} onCancelImport={vi.fn()} importProgress={null} onSkip={vi.fn()} />
    );
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(screen.getAllByText("Import").length).toBe(4);
  });

  it("calls onSkip", () => {
    const onSkip = vi.fn();
    render(<OnboardingPage onImport={vi.fn()} importing={false} importingSource={null} onCancelImport={vi.fn()} importProgress={null} onSkip={onSkip} />);
    fireEvent.click(screen.getByText("Skip setup"));
    expect(onSkip).toHaveBeenCalled();
  });
});
