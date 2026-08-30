import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConversationDetailPanel from "./ConversationDetailPanel";

describe("ConversationDetailPanel", () => {
  it("renders title and messages (happy path)", () => {
    render(
      <ConversationDetailPanel
        title="My Chat"
        source="claude"
        messages={[
          { id: "m1", sender: "human", content: "hello", created_at: Date.now() },
          { id: "m2", sender: "assistant", content: "world", created_at: Date.now() },
        ]}
        loading={false}
        onCopyThread={vi.fn()}
      />
    );
    expect(screen.getByText("My Chat")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getAllByText("Claude").length).toBeGreaterThan(0);
  });

  it("shows loading state", () => {
    render(
      <ConversationDetailPanel title="T" source="chatgpt" messages={[]} loading={true} onCopyThread={vi.fn()} />
    );
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("calls onCopyThread from menu", () => {
    const onCopy = vi.fn();
    render(<ConversationDetailPanel title="T" source="claude" messages={[]} loading={false} onCopyThread={onCopy} />);
    fireEvent.click(screen.getByLabelText("Options"));
    fireEvent.click(screen.getByText("Copy Thread"));
    expect(onCopy).toHaveBeenCalled();
  });

  it("shows Untitled fallback", () => {
    render(<ConversationDetailPanel title="" source="unknown" messages={[]} loading={false} onCopyThread={vi.fn()} />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });
});
