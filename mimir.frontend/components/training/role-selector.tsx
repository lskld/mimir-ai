"use client"

import { Building2, UserCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { RiskBadge } from "@/components/mimir/risk-badge"
import { cn } from "@/lib/utils"
import type {
  OrganizationLevelResponse,
  RoleResponse,
} from "@/lib/api/types"

export type RoleOption = {
  id: string
  name: string
  status: string
  amlRisk: string
  sanctionsRisk: string
  fraudRisk: string
  documentationRisk: string
  operationalRisk: string
  departmentName: string
  orgName: string
  path: string
}

type RoleSelectorProps = {
  roles: RoleOption[]
  selectedId: string | null
  onSelect: (role: RoleOption) => void
  isLoading?: boolean
  emptyMessage?: string
}

export function RoleSelector({
  roles,
  selectedId,
  onSelect,
  isLoading,
  emptyMessage,
}: RoleSelectorProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
    )
  }

  if (roles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage ??
          "No roles available yet. Configure your organization first."}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => {
        const active = role.id === selectedId
        return (
          <button
            type="button"
            key={role.id}
            onClick={() => onSelect(role)}
            className={cn(
              "group/role flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-all",
              active
                ? "border-primary shadow-[0_0_0_3px_var(--blue-glow)]"
                : "border-border hover:border-border-accent hover:bg-surface-elevated"
            )}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-blue-subtle/40 text-primary"
                  )}
                >
                  <UserCircle className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{role.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Building2 className="size-3" />
                    <span className="truncate">{role.departmentName}</span>
                  </p>
                </div>
              </div>
              {role.status === "Published" ? (
                <Badge variant="success" size="sm">Published</Badge>
              ) : (
                <Badge variant="warning" size="sm">Draft</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <RiskBadge type="AML" risk={role.amlRisk} />
              <RiskBadge type="Sanctions" risk={role.sanctionsRisk} />
              <RiskBadge type="Fraud" risk={role.fraudRisk} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Flattens the org-level hierarchy into a list of unique roles enriched with
 * department + org context. Dedupes by role id since a role can be linked to
 * multiple departments and would otherwise appear twice.
 */
export function buildRoleOptions(
  orgs: OrganizationLevelResponse[]
): RoleOption[] {
  const out: RoleOption[] = []
  const seen = new Set<string>()
  for (const org of orgs) {
    for (const dept of org.departments ?? []) {
      for (const role of (dept.roles ?? []) as RoleResponse[]) {
        if (seen.has(role.id)) continue
        seen.add(role.id)
        out.push({
          id: role.id,
          name: role.name,
          status: role.status,
          amlRisk: role.amlRisk,
          sanctionsRisk: role.sanctionsRisk,
          fraudRisk: role.fraudRisk,
          documentationRisk: role.documentationRisk,
          operationalRisk: role.operationalRisk,
          departmentName: dept.name,
          orgName: org.name,
          path: `${org.name} / ${dept.name} / ${role.name}`,
        })
      }
    }
  }
  return out
}
