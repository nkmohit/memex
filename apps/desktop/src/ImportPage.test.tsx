import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ImportPage from "./ImportPage";

const mockGetStats = vi.fn();
const mockGetSourceStats = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getStats: (...args: unknown[]) => mockGetStats(...args),
    getSourceStats: (...args: unknown[]) => mockGetSourceStats(...args),
  };
});

describe("ImportPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders loading then data (happy path)", async () => {
    mockGetStats.mockResolvedValue({ conversationCount: 5, messageCount: 50, latestMessageTimestamp: Date.now() });
    mockGetSourceStats.mockResolvedValue([
      { source: "claude", conversationCount: 3, messageCount: 30, lastActivityTimestamp: Date.now() },
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
});
