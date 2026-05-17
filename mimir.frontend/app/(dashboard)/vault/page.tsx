"use client"

import { FileText } from "lucide-react"

export default function VaultPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Upload regulatory documents and assign them to parts of your organization
        in the hierarchy. Use <strong className="text-foreground">New document</strong>{" "}
        above to add a file, then open it in Studio to run analysis.
      </p>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <FileText className="text-muted-foreground mb-3 size-10" />
        <p className="text-sm font-medium">No documents listed yet</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          The API does not expose a document list endpoint yet. After you upload,
          you will be taken to Studio for that document.
        </p>
      </div>
    </div>
  )
}
