"use client"

import { FileText } from "lucide-react"
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
        <p className="max-w-2xl text-sm text-muted-foreground">
          Upload your compliance policies. Mimir parses each file, extracts
          regulatory requirements, and proposes a training outline you can
          review and approve.
        </p>
      </header>

      <section>
        <DocumentUploadZone />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Your documents
          </h2>
          {sorted.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {sorted.length}{" "}
              {sorted.length === 1 ? "document" : "documents"}
            </span>
          ) : null}
        </div>

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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-subtle/40 text-primary">
        <FileText className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-heading font-semibold">No documents uploaded yet.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload your first policy document above. PDFs and DOCX files are
          supported. Mimir will analyze it and propose a training outline.
        </p>
      </div>
    </div>
  )
}
