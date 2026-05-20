import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type StatTileProps = {
  label: string
  value: number | string | null
  hint?: string
  icon: LucideIcon
  isLoading?: boolean
  className?: string
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  isLoading,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-accent",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="font-heading text-3xl font-semibold tabular-nums leading-none">
              {value ?? "—"}
            </p>
          )}
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-subtle/40 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  )
}
