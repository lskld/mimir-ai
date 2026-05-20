"use client"

import { useMemo, useState } from "react"
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
        <h1 className="font-heading text-2xl font-semibold">Training</h1>
      </header>

      <section className="space-y-3">
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
