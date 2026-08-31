import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppNavigation } from "./useAppNavigation";

vi.mock("../db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getMessages: vi.fn(async () => [{ id: "m1", sender: "human", content: "hi", created_at: 0 }]),
  };
});

function makeRefs() {
  return {
    messageRefs: { current: {} as Record<string, HTMLElement | null> },
    convItemRefs: { current: {} as Record<string, HTMLButtonElement | null> },
    viewerSearchInputRef: { current: null as HTMLInputElement | null },
    viewerMenuRef: { current: null as HTMLDivElement | null },
    skipSearchOnceRef: { current: false },
  };
}

describe("useAppNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!Element.prototype.scrollIntoView) {
      (Element.prototype as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
    }
  });

  it("computes selectedConversation for search view", () => {
    const refs = makeRefs();
    const { result } = renderHook(() =>
      useAppNavigation({
        activeView: "search",
        setActiveView: vi.fn(),
        selectedConvId: "c1",
        setSelectedConvId: vi.fn(),
        conversations: [
          {
            id: "c1",
            source: "claude",
            title: "t1",
            created_at: 0,
            last_message_at: 0,
            message_count: 1,
          },
          {
            id: "c2",
            source: "claude",
            title: "t2",
            created_at: 0,
            last_message_at: 0,
            message_count: 1,
          },
        ],
        searchSelectedConvId: "c2",
        searchSelectedConversation: null,
        setSearchSelectedConvId: vi.fn(),
        setSearchSelectedConversation: vi.fn(),
        setOpenedConversationFromSearch: vi.fn(),
        openedConversationFromSearch: false,
        setSearchRestoreConversationId: vi.fn(),
        skipSearchOnceRef: refs.skipSearchOnceRef,
        messages: [],
        setMessages: vi.fn(),
        setMessagesLoading: vi.fn(),
        setHighlightedMessageId: vi.fn(),
        messageRefs: refs.messageRefs,
        convItemRefs: refs.convItemRefs,
        prefersReducedMotion: false,
        viewerSearchInputRef: refs.viewerSearchInputRef,
        viewerSearchOpen: false,
        setViewerSearchOpen: vi.fn(),
        viewerMenuRef: refs.viewerMenuRef,
        setViewerMenuOpen: vi.fn(),
        searchPageQuery: "hello",
        setMessageSearchQuery: vi.fn(),
        setSearchFocusRequestId: vi.fn(),
      })
    );
    expect(result.current.selectedConversation?.id).toBe("c2");
  });

  it("handleConversationClick loads messages", async () => {
    const refs = makeRefs();
    const setMessages = vi.fn();
    const setMessagesLoading = vi.fn();
    const { result } = renderHook(() =>
      useAppNavigation({
        activeView: "conversations",
        setActiveView: vi.fn(),
        selectedConvId: null,
        setSelectedConvId: vi.fn(),
        conversations: [],
        searchSelectedConvId: null,
        searchSelectedConversation: null,
        setSearchSelectedConvId: vi.fn(),
        setSearchSelectedConversation: vi.fn(),
        setOpenedConversationFromSearch: vi.fn(),
        openedConversationFromSearch: false,
        setSearchRestoreConversationId: vi.fn(),
        skipSearchOnceRef: refs.skipSearchOnceRef,
        messages: [],
        setMessages,
        setMessagesLoading,
        setHighlightedMessageId: vi.fn(),
        messageRefs: refs.messageRefs,
        convItemRefs: refs.convItemRefs,
        prefersReducedMotion: true,
        viewerSearchInputRef: refs.viewerSearchInputRef,
        viewerSearchOpen: false,
        setViewerSearchOpen: vi.fn(),
        viewerMenuRef: refs.viewerMenuRef,
        setViewerMenuOpen: vi.fn(),
        searchPageQuery: "",
        setMessageSearchQuery: vi.fn(),
        setSearchFocusRequestId: vi.fn(),
      })
    );
    await act(async () => {
      await result.current.handleConversationClick("c1");
    });
    expect(setMessages).toHaveBeenCalled();
    expect(setMessagesLoading).toHaveBeenCalledWith(false);
  });

  it("goBackToSearch sets restore and switches view", () => {
    const refs = makeRefs();
    const setActiveView = vi.fn();
    const setSearchRestore = vi.fn();
    const { result } = renderHook(() =>
      useAppNavigation({
        activeView: "conversations",
        setActiveView,
        selectedConvId: "c1",
        setSelectedConvId: vi.fn(),
        conversations: [],
        searchSelectedConvId: null,
        searchSelectedConversation: null,
        setSearchSelectedConvId: vi.fn(),
        setSearchSelectedConversation: vi.fn(),
        setOpenedConversationFromSearch: vi.fn(),
        openedConversationFromSearch: true,
        setSearchRestoreConversationId: setSearchRestore,
        skipSearchOnceRef: refs.skipSearchOnceRef,
        messages: [],
        setMessages: vi.fn(),
        setMessagesLoading: vi.fn(),
        setHighlightedMessageId: vi.fn(),
        messageRefs: refs.messageRefs,
        convItemRefs: refs.convItemRefs,
        prefersReducedMotion: false,
        viewerSearchInputRef: refs.viewerSearchInputRef,
        viewerSearchOpen: false,
        setViewerSearchOpen: vi.fn(),
        viewerMenuRef: refs.viewerMenuRef,
        setViewerMenuOpen: vi.fn(),
        searchPageQuery: "",
        setMessageSearchQuery: vi.fn(),
        setSearchFocusRequestId: vi.fn(),
      })
    );
    act(() => {
      result.current.goBackToSearch();
    });
    expect(setSearchRestore).toHaveBeenCalledWith("c1");
    expect(setActiveView).toHaveBeenCalledWith("search");
  });
});
