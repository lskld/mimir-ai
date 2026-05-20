"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "error"

type Toast = {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

type ToastContextValue = {
  toast: (
    args: { title: string; description?: string; variant?: ToastVariant }
  ) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, variant = "default" }) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
      setToasts((prev) => [...prev, { id, title, description, variant }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-right-5",
              t.variant === "success" &&
                "border-success/40 bg-success/15 text-foreground",
              t.variant === "error" &&
                "border-destructive/40 bg-destructive/15 text-foreground",
              t.variant === "default" &&
                "border-border bg-popover text-popover-foreground"
            )}
          >
            <span className="mt-0.5">
              {t.variant === "success" ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : t.variant === "error" ? (
                <XCircle className="size-4 text-destructive" />
              ) : (
                <Info className="size-4 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>")
  }
  return ctx
}
