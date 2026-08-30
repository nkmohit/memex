import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClearDataConfirmDialog from "./ClearDataConfirmDialog";

describe("ClearDataConfirmDialog", () => {
  it("renders when open and handles cancel/confirm (happy path)", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ClearDataConfirmDialog
        open={true}
        clearingData={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        cancelBtnRef={{ current: null }}
        dialogRef={{ current: null }}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Clear imported data?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Clear Data"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("shows Clearing... when clearingData", () => {
    render(
      <ClearDataConfirmDialog
        open={true}
        clearingData={true}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        cancelBtnRef={{ current: null }}
        dialogRef={{ current: null }}
      />
    );
    expect(screen.getByText("Clearing...")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("returns null when not open (empty path)", () => {
    const { container } = render(
      <ClearDataConfirmDialog
        open={false}
        clearingData={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        cancelBtnRef={{ current: null }}
        dialogRef={{ current: null }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onCancel when overlay clicked", () => {
    const onCancel = vi.fn();
    render(
      <ClearDataConfirmDialog
        open={true}
        clearingData={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
        cancelBtnRef={{ current: null }}
        dialogRef={{ current: null }}
      />
    );
    const overlay = document.querySelector(".confirm-overlay") as HTMLElement;
    fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalled();
  });
});
