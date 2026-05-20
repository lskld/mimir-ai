"use client"

import { useEffect, useState } from "react"
import { HierarchyAssignPanel } from "@/components/hierarchy/hierarchy-assign-panel"
import { HierarchyEmptySetup } from "@/components/hierarchy/hierarchy-empty-setup"
import { VaultHierarchyTree } from "@/components/vault/vault-hierarchy-tree"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api/base"
import { getErrorMessage } from "@/lib/api/error-message"
import { useHierarchy } from "@/lib/api/hooks/use-hierarchy"
import { flattenHierarchyTargets } from "@/lib/api/vault-utils"
import type { VaultTarget } from "@/lib/api/types"

function firstTarget(
  orgs: NonNullable<ReturnType<typeof useHierarchy>["data"]>
): VaultTarget | null {
  const targets = flattenHierarchyTargets(orgs)
  return targets[0] ?? null
}

export default function HierarchyPage() {
  const hierarchyQuery = useHierarchy()
  const orgs = hierarchyQuery.data ?? []
  const [selected, setSelected] = useState<VaultTarget | null>(null)
  const hasHierarchy = orgs.length > 0
  const setupOpen = !hasHierarchy

  useEffect(() => {
    if (orgs.length > 0) {
      setSelected((current) => {
        const targets = flattenHierarchyTargets(orgs)
        if (current && targets.some((t) => t.id === current.id && t.type === current.type)) {
          return current
        }
        return firstTarget(orgs)
      })
    } else {
      setSelected(null)
    }
  }, [orgs])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Select an organization level, department, or role to assign compliance
          documents. Child nodes inherit documents from parents unless a more
          specific assignment exists at a lower level.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={hierarchyQuery.isFetching}
          onClick={() => void hierarchyQuery.refetch()}
        >
          {hierarchyQuery.isFetching ? "Refreshing…" : "Refresh tree"}
        </Button>
      </div>

      {hierarchyQuery.isPending ? (
        <p className="text-muted-foreground text-sm">Loading hierarchy…</p>
      ) : (
        <>
          {hierarchyQuery.isError ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-destructive text-sm" role="alert">
                {getErrorMessage(
                  hierarchyQuery.error,
                  "Failed to load hierarchy."
                )}
              </p>
              <p className="text-muted-foreground text-sm">
                Check that the API is running at{" "}
                <code className="bg-muted rounded px-1 py-0.5 text-xs">
                  {getApiBaseUrl()}
                </code>
                . You can still try creating an organization below if POST
                requests reach the API.
              </p>
            </div>
          ) : null}

          <details
            open={setupOpen}
            className="rounded-md border border-border bg-card"
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold select-none">
              Set up organization
              {!hasHierarchy ? (
                <span className="text-muted-foreground ml-2 font-normal">
                  (required — no hierarchy loaded)
                </span>
              ) : (
                <span className="text-muted-foreground ml-2 font-normal">
                  (optional)
                </span>
              )}
            </summary>
            <div className="border-t border-border px-4 pb-4">
              <HierarchyEmptySetup
                onHierarchyCreated={() => void hierarchyQuery.refetch()}
              />
            </div>
          </details>

          {hasHierarchy ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(220px,280px)_1fr]">
              <aside className="rounded-md border border-border bg-card p-3">
                <h2 className="mb-3 text-sm font-semibold">Organization tree</h2>
                <VaultHierarchyTree
                  orgs={orgs}
                  selected={selected}
                  onSelect={setSelected}
                />
              </aside>

              <section className="min-w-0 rounded-md border border-border bg-card p-4">
                {selected ? (
                  <HierarchyAssignPanel key={selected.id} target={selected} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Select a node in the tree to view and assign documents.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              After you create an organization, department, and role above, click{" "}
              <strong className="text-foreground">Refresh tree</strong> to load
              the assign view.
            </p>
          )}
        </>
      )}
    </div>
  )
}
