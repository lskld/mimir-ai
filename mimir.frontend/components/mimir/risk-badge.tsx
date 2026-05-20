import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type RiskLevel = "High" | "Medium" | "Low" | string

type RiskBadgeProps = {
  /** Risk dimension shown as the label prefix, e.g. "AML". */
  type: string
  /** Risk level — drives color. */
  risk: RiskLevel
  className?: string
}

export function RiskBadge({ type, risk, className }: RiskBadgeProps) {
  const variant: "destructive" | "warning" | "success" | "muted" =
    risk === "High"
      ? "destructive"
      : risk === "Medium"
        ? "warning"
        : risk === "Low"
          ? "success"
          : "muted"

  return (
    <Badge variant={variant} className={cn("font-medium", className)}>
      <span className="opacity-70">{type}</span>
      <span>·</span>
      <span>{risk}</span>
    </Badge>
  )
}
