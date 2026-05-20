"use client"

import { FileText, Inbox } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/mimir/status-badge"
import { RiskBadge } from "@/components/mimir/risk-badge"
import { AssignmentForm } from "./assignment-form"
import {
  useRoleResolvedDocuments,
  useTargetDocuments,
} from "@/lib/api/hooks/use-vault"
import { formatTargetType, formatInheritedFrom } from "@/lib/api/vault-utils"
import { getErrorMessage } from "@/lib/api/error-message"
import type { RoleResponse, VaultTarget } from "@/lib/api/types"

type NodeDetailPanelProps = {
  target: VaultTarget
  /** Hydrated role (with risk + status) when target.type === "Role". */
  role?: RoleResponse | null
}

export function NodeDetailPanel({ target, role }: NodeDetailPanelProps) {
  const directQuery = useTargetDocuments(target)
  const resolvedQuery = useRoleResolvedDocuments(
    target.type === "Role" ? target.id : null
  )
  const direct = directQuery.data ?? []
  const resolved = resolvedQuery.data?.documents ?? []

  // For deduping the assign dropdown — direct assignments only.
  const assignedDocumentIds = new Set(direct.map((d) => d.documentId))

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatTargetType(target.type)}</Badge>
          {role ? (
            <StatusBadge
              status={role.status === "Published" ? "Ready" : "Draft"}
              label={role.status}
            />
          ) : null}
        </div>
        <h2 className="font-heading text-lg font-semibold leading-tight">
          {target.name}
        </h2>
        <p className="text-xs text-muted-foreground">{target.path}</p>
        {role ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <RiskBadge type="AML" risk={role.amlRisk} />
            <RiskBadge type="Sanctions" risk={role.sanctionsRisk} />
            <RiskBadge type="Fraud" risk={role.fraudRisk} />
            <RiskBadge type="Docs" risk={role.documentationRisk} />
            <RiskBadge type="Ops" risk={role.operationalRisk} />
          </div>
        ) : null}
      </header>

      <AssignmentForm
        // Reset internal form state whenever the selected node changes.
        key={`${target.type}-${target.id}`}
        target={target}
        excludeDocumentIds={assignedDocumentIds}
      />

      {/* Directly assigned */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Directly assigned</h3>
          <span className="text-xs text-muted-foreground">
            Documents pinned to this node only
          </span>
        </div>
        {directQuery.isPending ? (
          <ListSkeleton />
        ) : directQuery.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {getErrorMessage(directQuery.error, "Failed to load assignments.")}
          </p>
        ) : direct.length === 0 ? (
          <EmptyDocs message="No documents pinned here yet. Use the picker above to assign one." />
        ) : (
          <ul className="space-y-1.5">
            {direct.map((doc) => (
              <li
                key={`${doc.documentId}-${doc.inheritedFrom}`}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-subtle/40 text-primary">
                  <FileText className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Pinned to {formatTargetType(doc.targetType)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Resolved set, only for roles */}
      {target.type === "Role" ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Resolved for training</h3>
            <span className="text-xs text-muted-foreground">
              Includes inheritance from department and org
            </span>
          </div>
          {resolvedQuery.isPending ? (
            <ListSkeleton />
          ) : resolvedQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {getErrorMessage(
                resolvedQuery.error,
                "Failed to load resolved documents."
              )}
            </p>
          ) : resolved.length === 0 ? (
            <EmptyDocs message="No documents reach this role yet. Assign at the role, department, or org level." />
          ) : (
            <ul className="space-y-1.5">
              {resolved.map((doc) => (
                <li
                  key={`${doc.documentId}-${doc.inheritedFrom}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-subtle/40 text-primary">
                    <FileText className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.fileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Inherited from {formatInheritedFrom(doc.inheritedFrom)}{" "}
                      {doc.inheritedFromName ? `· ${doc.inheritedFromName}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" size="sm">
                    {formatInheritedFrom(doc.inheritedFrom)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-1.5">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

function EmptyDocs({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-3">
      <Inbox className="size-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
