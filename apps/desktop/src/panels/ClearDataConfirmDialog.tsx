import type React from "react";

type ClearDataConfirmDialogProps = {
  open: boolean;
  clearingData: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  cancelBtnRef: React.RefObject<HTMLButtonElement | null>;
  dialogRef: React.RefObject<HTMLDivElement | null>;
};

export default function ClearDataConfirmDialog({
  open,
  clearingData,
  onCancel,
  onConfirm,
  cancelBtnRef,
  dialogRef,
}: ClearDataConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-data-title"
      >
        <h3 id="clear-data-title">Clear imported data?</h3>
        <p>This will permanently remove all imported conversations and messages from this app.</p>
        <div className="confirm-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="confirm-cancel-btn"
            onClick={onCancel}
            disabled={clearingData}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-danger-btn"
            onClick={onConfirm}
            disabled={clearingData}
          >
            {clearingData ? "Clearing..." : "Clear Data"}
          </button>
        </div>
      </div>
    </div>
  );
}

