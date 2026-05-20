"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/lib/api/error-message"
import { useDocumentsList } from "@/lib/api/hooks/use-documents"
import { useAssignDocumentMutation } from "@/lib/api/hooks/use-vault"
import type { VaultTarget } from "@/lib/api/types"
import { cn } from "@/lib/utils"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AssignDocumentFormProps = {
  target: VaultTarget
}

export function AssignDocumentForm({ target }: AssignDocumentFormProps) {
  const [documentId, setDocumentId] = useState("")
  const [useManualId, setUseManualId] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const documentsQuery = useDocumentsList()
  const assign = useAssignDocumentMutation()
  const documents = documentsQuery.data ?? []

  useEffect(() => {
    assign.reset()
    setValidationError(null)
    setDocumentId("")
    setUseManualId(false)
  }, [target.id, target.type]) // eslint-disable-line react-hooks/exhaustive-deps -- reset assign state when target changes

  function onSubmit() {
    const id = documentId.trim()
    if (!UUID_RE.test(id)) {
      setValidationError("Select a document or enter a valid UUID.")
      return
    }
    setValidationError(null)
    assign.mutate(
      {
        documentId: id,
        targetType: target.type,
        targetId: target.id,
      },
      {
        onSuccess: () => {
          setDocumentId("")
        },
      }
    )
  }

  const errorMessage =
    validationError ??
    (assign.isError ? getErrorMessage(assign.error, "Assignment failed.") : null)

  const listUnavailable =
    documentsQuery.isError &&
    !documentsQuery.isPending &&
    documents.length === 0

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Assign document</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Assign to <span className="text-foreground">{target.path}</span>
        </p>
      </div>

      {documentsQuery.isPending ? (
        <p className="text-muted-foreground text-xs">Loading documents…</p>
      ) : null}

      {!useManualId && !listUnavailable ? (
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Document</span>
          <select
            value={documentId}
            onChange={(ev) => {
              setDocumentId(ev.target.value)
              setValidationError(null)
              assign.reset()
            }}
            disabled={assign.isPending || documents.length === 0}
            className={cn(
              "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <option value="">
              {documents.length === 0
                ? "No uploaded documents — upload from Documents first"
                : "Select a document…"}
            </option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.originalFileName}
                {doc.regulationType ? ` (${doc.regulationType})` : ""} —{" "}
                {doc.status}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Document ID</span>
          <Input
            value={documentId}
            onChange={(ev) => {
              setDocumentId(ev.target.value)
              setValidationError(null)
              assign.reset()
            }}
            placeholder="Paste UUID from Studio"
            disabled={assign.isPending}
            className="font-mono text-xs"
          />
        </label>
      )}

      {listUnavailable ? (
        <p className="text-muted-foreground text-xs">
          Could not load the document list. Enter a document UUID manually.
        </p>
      ) : null}

      <button
        type="button"
        className="text-primary text-xs font-medium hover:underline"
        onClick={() => {
          setUseManualId((v) => !v)
          setDocumentId("")
          setValidationError(null)
          assign.reset()
        }}
      >
        {useManualId ? "Choose from uploaded documents" : "Enter document UUID instead"}
      </button>

      {errorMessage ? (
        <p className="text-destructive text-xs" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {assign.isSuccess ? (
        <p className="text-emerald-700 text-xs dark:text-emerald-400" role="status">
          Document assigned. It appears in the tables below.
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={assign.isPending || !documentId.trim()}
        onClick={onSubmit}
      >
        {assign.isPending ? "Assigning…" : "Assign to this node"}
      </Button>
    </div>
  )
}
