import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Mimir's canonical status pill. Always renders the same visual treatment for the
 * same logical state, regardless of which backend resource originally produced it.
 */
export type MimirStatus =
  | "Ready"
  | "Approved"
  | "Draft"
  | "Generating"
  | "Pending"
  | "Failed"
  | "NotStarted"
  | "Analyzed"
  | "Parsed"

type StatusBadgeProps = {
  status: MimirStatus | string
  label?: string
  className?: string
}

const ICON_SIZE = "size-3"

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const text = label ?? humanize(status)

  if (status === "Ready" || status === "Approved" || status === "Analyzed") {
    return (
      <Badge variant="success" className={cn(className)}>
        <CheckCircle2 className={ICON_SIZE} />
        {text}
      </Badge>
    )
  }

  if (status === "Generating") {
    return (
      <Badge variant="warning" className={cn("relative", className)}>
        <Loader2 className={cn(ICON_SIZE, "animate-spin")} />
        {text}
      </Badge>
    )
  }

  if (status === "Pending" || status === "Draft" || status === "Parsed") {
    return (
      <Badge variant="warning" className={cn(className)}>
        <CircleDashed className={ICON_SIZE} />
        {text}
      </Badge>
    )
  }

  if (status === "Failed") {
    return (
      <Badge variant="destructive" className={cn(className)}>
        <XCircle className={ICON_SIZE} />
        {text}
      </Badge>
    )
  }

  return (
    <Badge variant="muted" className={cn(className)}>
      <CircleDashed className={ICON_SIZE} />
      {text}
    </Badge>
  )
}

function humanize(status: string) {
  switch (status) {
    case "NotStarted":
      return "Not started"
    default:
      return status
  }
}
