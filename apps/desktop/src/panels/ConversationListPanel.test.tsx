import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConversationListPanel from "./ConversationListPanel";

function makeConv(overrides = {}) {
  return {
    id: "c1",
    source: "claude",
    title: "Hello World",
    created_at: Date.now(),
    last_message_at: Date.now(),
    message_count: 5,
    ...overrides,
  };
}

describe("ConversationListPanel", () => {
  it("renders list and handles select (happy path)", () => {
    const onSelect = vi.fn();
    const onSelectSource = vi.fn();
    render(
      <ConversationListPanel
        conversations={[makeConv({ id: "c1" }), makeConv({ id: "c2", title: "Second" })]}
        loading={false}
        selectedConvId="c1"
        activeSource={null}
        availableSources={["claude", "chatgpt"]}
        sourceStats={[
          {
            source: "claude",
            conversationCount: 2,
            messageCount: 10,
            lastActivityTimestamp: Date.now(),
          },
        ]}
        convItemRefs={{ current: {} }}
        onSelectSource={onSelectSource}
        onSelectConversation={onSelect}
        sourceLabel={(s) => s.toUpperCase()}
      />
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getAllByText("CLAUDE").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Second"));
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("shows skeleton when loading", () => {
    render(
      <ConversationListPanel
        conversations={[]}
        loading={true}
        selectedConvId={null}
        activeSource={null}
        availableSources={[]}
        sourceStats={[]}
        convItemRefs={{ current: {} }}
        onSelectSource={vi.fn()}
        onSelectConversation={vi.fn()}
        sourceLabel={(s) => s}
      />
    );
    expect(document.querySelector(".conv-list-skeleton")).toBeInTheDocument();
  });

  it("shows empty state when no conversations (empty path)", () => {
    render(
      <ConversationListPanel
        conversations={[]}
        loading={false}
        selectedConvId={null}
        activeSource="claude"
        availableSources={[]}
        sourceStats={[]}
        convItemRefs={{ current: {} }}
        onSelectSource={vi.fn()}
        onSelectConversation={vi.fn()}
        sourceLabel={(s) => s}
      />
    );
    expect(screen.getByText(/No conversations in claude/)).toBeInTheDocument();
  });

  it("shows generic empty when no source filter", () => {
    render(
      <ConversationListPanel
        conversations={[]}
        loading={false}
        selectedConvId={null}
        activeSource={null}
        availableSources={[]}
        sourceStats={[]}
        convItemRefs={{ current: {} }}
        onSelectSource={vi.fn()}
        onSelectConversation={vi.fn()}
        sourceLabel={(s) => s}
      />
    );
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();
  });
});
