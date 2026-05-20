"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDocumentsList } from "@/lib/api/hooks/use-documents"
import { useAssignDocumentMutation } from "@/lib/api/hooks/use-vault"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"
import { cn } from "@/lib/utils"
import type { VaultTarget } from "@/lib/api/types"

type AssignmentFormProps = {
  target: VaultTarget
  /** Document IDs already assigned to this node — excluded from the dropdown. */
  excludeDocumentIds: Set<string>
}

export function AssignmentForm({ target, excludeDocumentIds }: AssignmentFormProps) {
  const [documentId, setDocumentId] = useState("")
  const documentsQuery = useDocumentsList()
  const assign = useAssignDocumentMutation()
  const { toast } = useToast()

  const available = (documentsQuery.data ?? []).filter(
    (d) => !excludeDocumentIds.has(d.id)
  )

  function submit() {
    if (!documentId) return
    assign.mutate(
      {
        documentId,
        targetType: target.type,
        targetId: target.id,
      },
      {
        onSuccess: () => {
          toast({
            title: "Document assigned",
            description: `Linked to ${target.path}.`,
            variant: "success",
          })
          setDocumentId("")
        },
        onError: (err) => {
          toast({
            title: "Assignment failed",
            description: getErrorMessage(err, "Could not assign document."),
            variant: "error",
          })
        },
      }
    )
  }

  const isEmpty = !documentsQuery.isPending && (documentsQuery.data ?? []).length === 0
  const noneRemaining = !documentsQuery.isPending && available.length === 0

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface px-4 py-3">
      <p className="font-medium text-sm">Assign document</p>
      <p className="text-xs text-muted-foreground">
        Pick one of your uploaded documents to assign to{" "}
        <span className="text-foreground/90">{target.path}</span>.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          disabled={isEmpty || noneRemaining || assign.isPending}
          className={cn(
            "h-9 flex-1 min-w-[200px] cursor-pointer rounded-md border border-input bg-card px-3 text-sm shadow-xs",
            "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <option value="">
            {isEmpty
              ? "Upload documents on the Documents page first…"
              : noneRemaining
                ? "All documents already assigned"
                : "Select a document…"}
          </option>
          {available.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.originalFileName}
              {doc.regulationType ? ` (${doc.regulationType})` : ""} — {doc.status}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={!documentId || assign.isPending}
        >
          {assign.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Assigning…
            </>
          ) : (
            <>
              <Plus className="size-3.5" />
              Assign
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
