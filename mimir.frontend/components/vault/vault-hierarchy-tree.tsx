"use client"

import type { ComponentType } from "react"
import { Building2, ChevronRight, UserCircle, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OrganizationLevelResponse, VaultTarget } from "@/lib/api/types"

type VaultHierarchyTreeProps = {
  orgs: OrganizationLevelResponse[]
  selected: VaultTarget | null
  onSelect: (target: VaultTarget) => void
}

export function VaultHierarchyTree({
  orgs,
  selected,
  onSelect,
}: VaultHierarchyTreeProps) {
  if (orgs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No organization levels loaded. Open{" "}
        <strong className="text-foreground">Set up organization</strong> above.
      </p>
    )
  }

  return (
    <ul className="space-y-1 text-sm">
      {orgs.map((org) => (
        <li key={org.id}>
          <TreeButton
            selected={
              selected?.id === org.id &&
              selected.type === "OrganizationLevel"
            }
            icon={Building2}
            label={org.name}
            onClick={() =>
              onSelect({
                type: "OrganizationLevel",
                id: org.id,
                name: org.name,
                path: org.name,
              })
            }
          />
          {(org.departments ?? []).map((dept) => (
            <ul key={dept.id} className="mt-0.5 ml-4 space-y-0.5 border-l border-border pl-2">
              <li>
                <TreeButton
                  selected={
                    selected?.id === dept.id && selected.type === "Department"
                  }
                  icon={Users}
                  label={dept.name}
                  onClick={() =>
                    onSelect({
                      type: "Department",
                      id: dept.id,
                      name: dept.name,
                      path: `${org.name} / ${dept.name}`,
                    })
                  }
                />
                {(dept.roles ?? []).map((role) => (
                  <ul
                    key={role.id}
                    className="mt-0.5 ml-4 space-y-0.5 border-l border-border pl-2"
                  >
                    <li>
                      <TreeButton
                        selected={
                          selected?.id === role.id && selected.type === "Role"
                        }
                        icon={UserCircle}
                        label={role.name}
                        suffix={role.status}
                        onClick={() =>
                          onSelect({
                            type: "Role",
                            id: role.id,
                            name: role.name,
                            path: `${org.name} / ${dept.name} / ${role.name}`,
                          })
                        }
                      />
                    </li>
                  </ul>
                ))}
              </li>
            </ul>
          ))}
        </li>
      ))}
    </ul>
  )
}

function TreeButton({
  selected,
  icon: Icon,
  label,
  suffix,
  onClick,
}: {
  selected: boolean
  icon: ComponentType<{ className?: string }>
  label: string
  suffix?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        selected
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <ChevronRight
        className={cn("size-3.5 shrink-0", selected && "text-primary")}
      />
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {suffix ? (
        <span className="text-muted-foreground shrink-0 text-xs">{suffix}</span>
      ) : null}
    </button>
  )
}
