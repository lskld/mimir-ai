"use client"

import { useEffect, useState } from "react"
import { FullProgramPanel } from "@/components/programs/full-program-panel"
import { getErrorMessage } from "@/lib/api/error-message"
import { useHierarchyTargets } from "@/lib/api/hooks/use-hierarchy"
import type { VaultTarget } from "@/lib/api/types"

export default function ProgramsPage() {
  const { targets, isPending, isError, error } = useHierarchyTargets()

  const roleTargets = targets.filter((t) => t.type === "Role")

  const [selected, setSelected] = useState<VaultTarget | null>(null)

  useEffect(() => {
    if (selected && !roleTargets.some((t) => t.id === selected.id)) {
      setSelected(null)
    }
    if (!selected && roleTargets.length > 0) {
      setSelected(roleTargets[0])
    }
  }, [roleTargets, selected])

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left column — role list */}
      <aside className="w-72 flex-shrink-0 border-r border-border overflow-y-auto">
        <div className="sticky top-0 bg-background/95 border-b border-border px-4 py-3 z-10">
          <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            Roles
          </p>
        </div>

        {isPending ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">
            Loading roles…
          </p>
        ) : isError ? (
          <p className="text-destructive px-4 py-3 text-sm" role="alert">
            {getErrorMessage(error, "Failed to load roles.")}
          </p>
        ) : roleTargets.length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-sm">
            No roles found. Create an organization, department, and role first.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {roleTargets.map((target) => (
              <li
                key={target.id}
                className={`cursor-pointer px-4 py-3 transition-colors ${
                  selected?.id === target.id
                    ? "bg-primary/10 border-l-2 border-primary"
                    : "hover:bg-muted/50 border-l-2 border-transparent"
                }`}
                onClick={() => setSelected(target)}
              >
                <div className="font-medium text-sm">{target.name}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {target.path}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Right column — detail panel */}
      <main className="flex-1 overflow-y-auto">
        {selected ? (
          <FullProgramPanel roleId={selected.id} key={selected.id} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-3 p-8">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Select a role from the list to view its training outline and full
              program status, or to generate and download a SCORM course.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
