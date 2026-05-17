"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { DocumentOutlineView } from "@/components/document-outline-view"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/api/error-message"
import { useDocumentOutline } from "@/lib/api/hooks/use-outline"
import { parseDocumentId } from "@/lib/utils/document-id"

export default function PreviewDocumentPage() {
  const params = useParams()
  const documentId = parseDocumentId(
    typeof params.id === "string" ? params.id : undefined
  )

  const outlineQuery = useDocumentOutline(documentId)

  if (!documentId) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Invalid document id. Use a valid UUID from Studio.
      </p>
    )
  }

  const outline = outlineQuery.data
  const noOutline =
    !outlineQuery.isPending &&
    !outlineQuery.isError &&
    outline === null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h2 className="text-lg font-semibold">Outline preview</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/studio/${documentId}`}>Studio</Link>
          </Button>
        </div>
      </div>

      {outlineQuery.isPending ? (
        <p className="text-muted-foreground text-sm">Loading outline…</p>
      ) : outlineQuery.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {getErrorMessage(outlineQuery.error, "Failed to load outline.")}
        </p>
      ) : noOutline ? (
        <p className="text-destructive text-sm" role="alert">
          No outline for this document yet. Run analysis in Studio first.
        </p>
      ) : outline ? (
        <DocumentOutlineView outline={outline} />
      ) : null}
    </div>
  )
}
