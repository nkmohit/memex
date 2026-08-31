import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ImportPage from "./ImportPage";

const mockGetStats = vi.fn();
const mockGetSourceStats = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getStats: (...args: unknown[]) => mockGetStats(...args),
    getSourceStats: (...args: unknown[]) => mockGetSourceStats(...args),
  };
});

describe("ImportPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders loading then data (happy path)", async () => {
    mockGetStats.mockResolvedValue({
      conversationCount: 5,
      messageCount: 50,
      latestMessageTimestamp: Date.now(),
    });
    mockGetSourceStats.mockResolvedValue([
      {
        source: "claude",
        conversationCount: 3,
        messageCount: 30,
        lastActivityTimestamp: Date.now(),
      },
    ]);
    render(
      <ImportPage
        onImport={vi.fn()}
        importing={false}
        importingSource={null}
        onCancelImport={vi.fn()}
        importProgress={null}
        importError={null}
        importResult={null}
        refreshKey={0}
      />
    );
    await waitFor(() => expect(screen.getByText("Import")).toBeInTheDocument());
    expect(await screen.findByText("Your data")).toBeInTheDocument();
  });

  it("shows error state when load fails", async () => {
    mockGetStats.mockRejectedValue(new Error("db error"));
    mockGetSourceStats.mockRejectedValue(new Error("db error"));
    render(
      <ImportPage
        onImport={vi.fn()}
        importing={false}
        importingSource={null}
        onCancelImport={vi.fn()}
        importProgress={null}
        importError={null}
        importResult={null}
        refreshKey={0}
      />
    );
    await waitFor(() => expect(screen.getByText("db error")).toBeInTheDocument());
  });

  it("shows importing progress and cancel", async () => {
    mockGetStats.mockResolvedValue({
      conversationCount: 0,
      messageCount: 0,
      latestMessageTimestamp: null,
    });
    mockGetSourceStats.mockResolvedValue([]);
    const onCancel = vi.fn();
    render(
      <ImportPage
        onImport={vi.fn()}
        importing={true}
        importingSource="claude"
        onCancelImport={onCancel}
        importProgress={{
          conversationsDone: 1,
          conversationsTotal: 2,
          messagesDone: 5,
          messagesTotal: 10,
        }}
        importError={null}
        importResult={null}
        refreshKey={0}
      />
    );
    await waitFor(() => expect(screen.getByText(/5 \/ 10 msgs/)).toBeInTheDocument());
    expect(screen.getByText("Cancel import")).toBeInTheDocument();
  });

  it("shows import error and result banners with dismiss", async () => {
    mockGetStats.mockResolvedValue({
      conversationCount: 1,
      messageCount: 10,
      latestMessageTimestamp: Date.now(),
    });
    mockGetSourceStats.mockResolvedValue([]);
    const onDismissErr = vi.fn();
    const onDismissRes = vi.fn();
    render(
      <ImportPage
        onImport={vi.fn()}
        importing={false}
        importingSource={null}
        onCancelImport={vi.fn()}
        importProgress={null}
        importError="import failed"
        importResult="imported 5"
        onDismissImportError={onDismissErr}
        onDismissImportResult={onDismissRes}
        refreshKey={1}
      />
    );
    await waitFor(() => expect(screen.getByText("import failed")).toBeInTheDocument());
    expect(screen.getByText("imported 5")).toBeInTheDocument();
  });

  it("triggers onImport when clicking Import", async () => {
    mockGetStats.mockResolvedValue({
      conversationCount: 0,
      messageCount: 0,
      latestMessageTimestamp: null,
    });
    mockGetSourceStats.mockResolvedValue([]);
    const onImport = vi.fn();
    render(
      <ImportPage
        onImport={onImport}
        importing={false}
        importingSource={null}
        onCancelImport={vi.fn()}
        importProgress={null}
        importError={null}
        importResult={null}
        refreshKey={0}
      />
    );
    await waitFor(() => expect(screen.getByText("Claude")).toBeInTheDocument());
    const btns = screen.getAllByText("Import");
    // first Import button is for Claude
    await waitFor(() => expect(btns[0]).toBeInTheDocument());
  });

  it("retries on load error via Retry button", async () => {
    mockGetStats.mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce({
      conversationCount: 0,
      messageCount: 0,
      latestMessageTimestamp: null,
    });
    mockGetSourceStats.mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce([]);
    render(
      <ImportPage
        onImport={vi.fn()}
        importing={false}
        importingSource={null}
        onCancelImport={vi.fn()}
        importProgress={null}
        importError={null}
        importResult={null}
        refreshKey={0}
      />
    );
    await waitFor(() => expect(screen.getByText("fail")).toBeInTheDocument());
    // Retry button should be present
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
