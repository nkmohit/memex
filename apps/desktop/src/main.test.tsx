import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("main", () => {
  let origGetElementById: typeof document.getElementById;

  beforeEach(() => {
    vi.resetModules();
    origGetElementById = document.getElementById.bind(document);
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    document.getElementById = origGetElementById;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("initializes DB and renders App (happy path)", async () => {
    const renderMock = vi.fn();
    const createRootMock = vi.fn(() => ({ render: renderMock }));
    vi.doMock("react-dom/client", () => ({
      default: { createRoot: createRootMock },
    }));
    const initMock = vi.fn(async () => {});
    vi.doMock("./db", () => ({ initDatabase: initMock }));
    vi.doMock("./App", () => ({ default: () => null as unknown as React.ReactElement }));

    await import("./main");

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it("logs error when DB init fails (error path)", async () => {
    const renderMock = vi.fn();
    const createRootMock = vi.fn(() => ({ render: renderMock }));
    vi.doMock("react-dom/client", () => ({
      default: { createRoot: createRootMock },
    }));
    const err = new Error("init fail");
    const initMock = vi.fn(async () => {
      throw err;
    });
    vi.doMock("./db", () => ({ initDatabase: initMock }));
    vi.doMock("./App", () => ({ default: () => null as unknown as React.ReactElement }));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("./main");

    // wait for catch handler
    await new Promise((r) => setTimeout(r, 0));

    expect(initMock).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith("DB init failed:", err);
    expect(createRootMock).toHaveBeenCalled();
  });
});
