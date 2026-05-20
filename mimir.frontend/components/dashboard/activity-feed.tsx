"use client"

import { FileText, Sparkles, Workflow } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/mimir/status-badge"
import { cn } from "@/lib/utils"

export type ActivityItem = {
  id: string
  /** Icon family that conveys what kind of action this is. */
  kind: "document" | "outline" | "program"
  title: string
  meta?: string
  status?: string
  timestamp?: string
}

type ActivityFeedProps = {
  items: ActivityItem[]
  isLoading?: boolean
  emptyMessage?: string
}

const ICONS = {
  document: FileText,
  outline: Sparkles,
  program: Workflow,
} as const

export function ActivityFeed({
  items,
  isLoading,
  emptyMessage = "Nothing here yet. Upload a document to get started.",
}: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {items.map((item) => {
        const Icon = ICONS[item.kind]
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-elevated"
            )}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-subtle/40 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              {item.meta ? (
                <p className="text-xs text-muted-foreground">{item.meta}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.status ? <StatusBadge status={item.status} /> : null}
              {item.timestamp ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {item.timestamp}
                </span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
