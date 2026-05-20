"use client"

import { useMemo, useState } from "react"
import { Workflow } from "lucide-react"
import {
  buildRoleOptions,
  RoleSelector,
  type RoleOption,
} from "@/components/training/role-selector"
import { TrainingPipeline } from "@/components/training/training-pipeline"
import { useHierarchy } from "@/lib/api/hooks/use-hierarchy"
import { getErrorMessage } from "@/lib/api/error-message"

export default function TrainingPage() {
  const hierarchyQuery = useHierarchy()
  const roles = useMemo(
    () => buildRoleOptions(hierarchyQuery.data ?? []),
    [hierarchyQuery.data]
  )

  // The user's explicit choice; if null we fall back to a sensible default.
  const [userRoleId, setUserRoleId] = useState<string | null>(null)

  const selectedRole = useMemo<RoleOption | null>(() => {
    if (roles.length === 0) return null
    const fromUser = userRoleId
      ? roles.find((r) => r.id === userRoleId)
      : undefined
    if (fromUser) return fromUser
    return roles.find((r) => r.status === "Published") ?? roles[0]
  }, [roles, userRoleId])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-blue-subtle/30 px-3 py-1 text-xs font-medium text-primary">
          <Workflow className="size-3" />
          Training pipeline
        </div>
        <h1 className="font-heading text-2xl font-semibold">
          {selectedRole
            ? `Train ${selectedRole.name}`
            : "Pick a role to train"}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Walk every role through Mimir&apos;s six-stage pipeline. Each step is
          grounded in the regulations assigned to that role on the Organization
          page.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Step 1 — Select role
          </h2>
          {selectedRole ? (
            <span className="text-xs text-muted-foreground">
              {selectedRole.path}
            </span>
          ) : null}
        </div>
        {hierarchyQuery.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {getErrorMessage(hierarchyQuery.error, "Failed to load roles.")}
          </p>
        ) : (
          <RoleSelector
            roles={roles}
            selectedId={selectedRole?.id ?? null}
            onSelect={(role) => setUserRoleId(role.id)}
            isLoading={hierarchyQuery.isPending}
            emptyMessage="No roles configured yet. Set up your organization first."
          />
        )}
      </section>

      {selectedRole ? (
        <TrainingPipeline role={selectedRole} key={selectedRole.id} />
      ) : null}
    </div>
  )
}
