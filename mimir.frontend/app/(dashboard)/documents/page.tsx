"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { DocumentCard } from "@/components/documents/document-card"
import { DocumentUploadZone } from "@/components/documents/document-upload-zone"
import { getErrorMessage } from "@/lib/api/error-message"
import { useDocumentsList } from "@/lib/api/hooks/use-documents"

export default function DocumentsPage() {
  const documentsQuery = useDocumentsList()
  const documents = documentsQuery.data ?? []

  // Newest first.
  const sorted = [...documents].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold">Documents</h1>
      </header>

      <section>
        <DocumentUploadZone />
      </section>

      <section className="space-y-3">
        {documentsQuery.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : documentsQuery.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {getErrorMessage(documentsQuery.error, "Failed to load documents.")}
          </p>
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sorted.map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12">
      <p className="text-sm text-muted-foreground">No documents yet</p>
    </div>
  )
}
