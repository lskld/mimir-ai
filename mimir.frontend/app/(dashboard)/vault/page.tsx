"use client"

import { VaultCatalogTable } from "@/components/vault/vault-catalog-table"
import { getErrorMessage } from "@/lib/api/error-message"
import { useVaultCatalog } from "@/lib/api/hooks/use-vault"

export default function VaultPage() {
  const catalogQuery = useVaultCatalog()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Documents assigned in the vault. Use{" "}
        <strong className="text-foreground">New document</strong> to upload a file
        (you will open it in Studio). Only documents assigned to the organization
        hierarchy. Assign documents on the Hierarchy page.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Assigned documents</h2>
        {catalogQuery.isPending ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : catalogQuery.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {getErrorMessage(catalogQuery.error, "Failed to load documents.")}
          </p>
        ) : (
          <VaultCatalogTable
            documents={catalogQuery.data ?? []}
            emptyMessage="No assigned documents yet. Upload with New document, then assign on Hierarchy."
          />
        )}
      </section>
    </div>
  )
}
