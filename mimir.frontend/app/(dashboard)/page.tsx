"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/lib/api/error-message"
import { useUploadDocumentMutation } from "@/lib/api/hooks/use-upload-document"

export default function HomePage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [regulationType, setRegulationType] = useState("AMLR")
  const [validationError, setValidationError] = useState<string | null>(null)

  const upload = useUploadDocumentMutation()

  function onUpload() {
    if (!file) {
      setValidationError("Choose a PDF or DOCX file (max 20 MB).")
      return
    }
    setValidationError(null)
    upload.mutate(
      { file, regulationType: regulationType.trim() || undefined },
      {
        onSuccess: (doc) => {
          router.push(`/studio/${doc.id}`)
        },
      }
    )
  }

  const errorMessage =
    validationError ??
    (upload.isError ? getErrorMessage(upload.error, "Upload failed.") : null)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold">Upload a document</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload a compliance PDF or DOCX, then open it in Studio to run AI
          analysis and view the training outline.
        </p>
      </div>

      <div className="space-y-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Regulation label</span>
          <Input
            value={regulationType}
            onChange={(ev) => setRegulationType(ev.target.value)}
            placeholder="e.g. AMLR, GDPR"
            disabled={upload.isPending}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">File</span>
          <Input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={upload.isPending}
            className="cursor-pointer"
            onChange={(ev) => {
              setFile(ev.target.files?.[0] ?? null)
              setValidationError(null)
              upload.reset()
            }}
          />
        </label>
      </div>

      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={upload.isPending} onClick={onUpload}>
          {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/studio">Studio</Link>
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        API:{" "}
        <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
          {process.env.NEXT_PUBLIC_MIMIR_API_BASE_URL ?? "http://localhost:5003"}
        </code>
      </p>
    </div>
  )
}