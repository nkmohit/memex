import { useCallback, useRef, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export function useToast() {
  const toastIdRef = useRef(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = (toastIdRef.current += 1);
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
