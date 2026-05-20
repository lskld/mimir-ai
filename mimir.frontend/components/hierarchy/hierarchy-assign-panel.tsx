"use client"

import Link from "next/link"
import { AssignDocumentForm } from "@/components/vault/assign-document-form"
import { VaultDocumentsTable } from "@/components/vault/vault-documents-table"
import { getErrorMessage } from "@/lib/api/error-message"
import {
  useRoleResolvedDocuments,
  useTargetDocuments,
} from "@/lib/api/hooks/use-vault"
import { formatTargetType } from "@/lib/api/vault-utils"
import type { VaultTarget } from "@/lib/api/types"

type HierarchyAssignPanelProps = {
  target: VaultTarget
}

export function HierarchyAssignPanel({ target }: HierarchyAssignPanelProps) {
  const directQuery = useTargetDocuments(target)
  const resolvedQuery = useRoleResolvedDocuments(
    target.type === "Role" ? target.id : null
  )

  const directDocs = directQuery.data ?? []
  const resolvedDocs =
    target.type === "Role" ? (resolvedQuery.data?.documents ?? []) : []

  return (
    <div className="space-y-8">
      <header className="space-y-1 border-b border-border pb-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {formatTargetType(target.type)}
        </p>
        <h2 className="text-lg font-semibold">{target.name}</h2>
        <p className="text-muted-foreground text-sm">{target.path}</p>
        {target.type === "OrganizationLevel" ? (
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Documents assigned here are inherited by all departments and roles
            under this organization level.
          </p>
        ) : null}
        {target.type === "Department" ? (
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Documents assigned here are inherited by every role in this
            department.
          </p>
        ) : null}
        {target.type === "Role" ? (
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Direct assignments apply only to this role. The resolved set below
            includes documents inherited from parent departments and organization
            levels (used for role training).
          </p>
        ) : null}
      </header>

      <AssignDocumentForm target={target} />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Directly assigned</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Documents explicitly assigned to this node only.
        </p>
        {directQuery.isPending ? (
          <p className="text-muted-foreground text-sm">Loading assignments…</p>
        ) : directQuery.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {getErrorMessage(directQuery.error, "Failed to load assignments.")}
          </p>
        ) : (
          <VaultDocumentsTable
            documents={directDocs}
            emptyMessage="No documents assigned to this node yet. Choose a document above."
          />
        )}
      </section>

      {target.type === "Role" ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Resolved for training</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Full document set this role uses when generating training.
          </p>
          {resolvedQuery.isPending ? (
            <p className="text-muted-foreground text-sm">
              Loading resolved documents…
            </p>
          ) : resolvedQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {getErrorMessage(
                resolvedQuery.error,
                "Failed to load resolved documents."
              )}
            </p>
          ) : (
            <VaultDocumentsTable
              documents={resolvedDocs}
              showInheritance
              emptyMessage="This role has no documents yet. Assign regulations at the role, department, or organization level."
            />
          )}
        </section>
      ) : null}

      <p className="text-muted-foreground text-xs">
        Upload or analyze documents in{" "}
        <Link href="/vault" className="text-primary font-medium hover:underline">
          Documents
        </Link>{" "}
        and{" "}
        <Link href="/studio" className="text-primary font-medium hover:underline">
          Studio
        </Link>
        .
      </p>
    </div>
  )
}
