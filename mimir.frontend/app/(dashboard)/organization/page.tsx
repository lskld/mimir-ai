"use client"

import { useMemo, useState } from "react"
import { Building2, ChevronRight, RefreshCcw, UserCircle, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RiskBadge } from "@/components/mimir/risk-badge"
import { NodeDetailPanel } from "@/components/organization/node-detail-panel"
import { HierarchyEmptySetup } from "@/components/hierarchy/hierarchy-empty-setup"
import { useHierarchy } from "@/lib/api/hooks/use-hierarchy"
import { getErrorMessage } from "@/lib/api/error-message"
import { cn } from "@/lib/utils"
import type {
  DepartmentResponse,
  OrganizationLevelResponse,
  RoleResponse,
  VaultTarget,
} from "@/lib/api/types"

type Selection = {
  orgId: string | null
  deptId: string | null
  roleId: string | null
}

export default function OrganizationPage() {
  const hierarchyQuery = useHierarchy()
  const orgs = useMemo(
    () => hierarchyQuery.data ?? [],
    [hierarchyQuery.data]
  )

  // The user's explicit choice (nulls when nothing has been clicked yet).
  // The actual visible selection is derived below, falling back to sensible
  // defaults whenever the user hasn't selected anything or their selection has
  // become stale.
  const [userSelection, setUserSelection] = useState<Selection>({
    orgId: null,
    deptId: null,
    roleId: null,
  })

  const { selection, selectedOrg, selectedDept, selectedRole } = useMemo(
    () => resolveSelection(orgs, userSelection),
    [orgs, userSelection]
  )
  const departments = selectedOrg?.departments ?? []
  const roles = selectedDept?.roles ?? []

  const detailTarget = buildDetailTarget(selectedOrg, selectedDept, selectedRole)

  const hasAny = orgs.length > 0

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl font-semibold">Organization</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Map your compliance hierarchy. Org levels feed departments; departments
            feed roles. Documents assigned higher up are inherited down — assignments
            at a lower level always win.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={hierarchyQuery.isFetching}
          onClick={() => void hierarchyQuery.refetch()}
        >
          <RefreshCcw
            className={cn("size-3.5", hierarchyQuery.isFetching && "animate-spin")}
          />
          {hierarchyQuery.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      {hierarchyQuery.isPending ? (
        <ColumnsSkeleton />
      ) : hierarchyQuery.isError && !hasAny ? (
        <p className="text-destructive text-sm" role="alert">
          {getErrorMessage(hierarchyQuery.error, "Failed to load hierarchy.")}
        </p>
      ) : !hasAny ? (
        <HierarchyEmptySetup
          onHierarchyCreated={() => void hierarchyQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            {/* Org levels column */}
            <ColumnCard
              title="Org levels"
              icon={Building2}
              empty="No org levels yet."
              items={orgs.map((o) => ({
                id: o.id,
                primary: o.name,
                secondary: o.geography ?? o.description ?? "—",
              }))}
              selectedId={selection.orgId}
              onSelect={(id) =>
                setUserSelection({ orgId: id, deptId: null, roleId: null })
              }
            />

            {/* Departments column */}
            <ColumnCard
              title="Departments"
              icon={Users}
              empty={
                selectedOrg
                  ? "No departments in this org yet."
                  : "Pick an org level on the left."
              }
              items={departments.map((d) => ({
                id: d.id,
                primary: d.name,
                secondary: `${d.roles?.length ?? 0} roles`,
              }))}
              selectedId={selection.deptId}
              onSelect={(id) =>
                setUserSelection((prev) => ({
                  ...prev,
                  orgId: selection.orgId,
                  deptId: id,
                  roleId: null,
                }))
              }
            />

            {/* Roles column */}
            <RoleColumn
              roles={roles}
              selectedId={selection.roleId}
              onSelect={(id) =>
                setUserSelection((prev) => ({
                  ...prev,
                  orgId: selection.orgId,
                  deptId: selection.deptId,
                  roleId: id,
                }))
              }
              empty={
                selectedDept
                  ? "No roles in this department yet."
                  : "Pick a department in the middle."
              }
            />
          </div>

          {detailTarget ? (
            <NodeDetailPanel target={detailTarget} role={selectedRole} />
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * Picks the visible selection by combining the user's most recent choice with the
 * live hierarchy data. Falls back to the first available item at each level when
 * the user hasn't chosen yet or their choice is no longer valid.
 */
function resolveSelection(
  orgs: OrganizationLevelResponse[],
  user: Selection
): {
  selection: Selection
  selectedOrg: OrganizationLevelResponse | null
  selectedDept: DepartmentResponse | null
  selectedRole: RoleResponse | null
} {
  if (orgs.length === 0) {
    return {
      selection: { orgId: null, deptId: null, roleId: null },
      selectedOrg: null,
      selectedDept: null,
      selectedRole: null,
    }
  }
  const orgFromUser =
    user.orgId && orgs.find((o) => o.id === user.orgId)
      ? orgs.find((o) => o.id === user.orgId)!
      : orgs[0]
  const departments = orgFromUser.departments ?? []
  const deptFromUser =
    user.deptId && departments.find((d) => d.id === user.deptId)
      ? departments.find((d) => d.id === user.deptId)!
      : departments[0] ?? null
  const roles = deptFromUser?.roles ?? []
  const roleFromUser =
    user.roleId && roles.find((r) => r.id === user.roleId)
      ? roles.find((r) => r.id === user.roleId)!
      : roles[0] ?? null

  return {
    selection: {
      orgId: orgFromUser.id,
      deptId: deptFromUser?.id ?? null,
      roleId: roleFromUser?.id ?? null,
    },
    selectedOrg: orgFromUser,
    selectedDept: deptFromUser,
    selectedRole: roleFromUser,
  }
}

function buildDetailTarget(
  org: OrganizationLevelResponse | null,
  dept: DepartmentResponse | null,
  role: RoleResponse | null
): VaultTarget | null {
  if (role && org && dept) {
    return {
      type: "Role",
      id: role.id,
      name: role.name,
      path: `${org.name} / ${dept.name} / ${role.name}`,
    }
  }
  if (dept && org) {
    return {
      type: "Department",
      id: dept.id,
      name: dept.name,
      path: `${org.name} / ${dept.name}`,
    }
  }
  if (org) {
    return {
      type: "OrganizationLevel",
      id: org.id,
      name: org.name,
      path: org.name,
    }
  }
  return null
}

function ColumnCard({
  title,
  icon: Icon,
  items,
  selectedId,
  onSelect,
  empty,
}: {
  title: string
  icon: typeof Building2
  items: { id: string; primary: string; secondary?: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
  empty: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-[280px] overflow-y-auto p-1.5">
          {items.map((item) => {
            const active = item.id === selectedId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "group/item flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                    active
                      ? "bg-blue-subtle/40 text-foreground"
                      : "hover:bg-surface-elevated"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        active ? "font-semibold" : "font-medium"
                      )}
                    >
                      {item.primary}
                    </p>
                    {item.secondary ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.secondary}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function RoleColumn({
  roles,
  selectedId,
  onSelect,
  empty,
}: {
  roles: RoleResponse[]
  selectedId: string | null
  onSelect: (id: string) => void
  empty: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <UserCircle className="size-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Roles
        </p>
      </div>
      {roles.length === 0 ? (
        <p className="px-4 py-6 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-[280px] overflow-y-auto p-1.5">
          {roles.map((role) => {
            const active = role.id === selectedId
            return (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => onSelect(role.id)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-md px-2.5 py-2 text-left transition-colors",
                    active
                      ? "bg-blue-subtle/40"
                      : "hover:bg-surface-elevated"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        active ? "font-semibold" : "font-medium"
                      )}
                    >
                      {role.name}
                    </p>
                    {role.status === "Published" ? (
                      <Badge variant="success" size="sm">
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        Draft
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <RiskBadge type="AML" risk={role.amlRisk} />
                    <RiskBadge type="Sanctions" risk={role.sanctionsRisk} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ColumnsSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[280px] w-full" />
      ))}
    </div>
  )
}
