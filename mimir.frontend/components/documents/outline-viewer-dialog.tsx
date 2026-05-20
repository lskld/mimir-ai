"use client"

import { CheckCircle2, FileText, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/mimir/status-badge"
import { useDocumentOutline } from "@/lib/api/hooks/use-outline"
import { useApproveOutlineMutation } from "@/lib/api/hooks/use-analysis-mutations"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"
import type { TrainingOutlineResponse } from "@/lib/api/types"

type OutlineViewerDialogProps = {
  open: boolean
  documentId: string
  fileName: string
  onOpenChange: (open: boolean) => void
}

export function OutlineViewerDialog({
  open,
  documentId,
  fileName,
  onOpenChange,
}: OutlineViewerDialogProps) {
  const outlineQuery = useDocumentOutline(documentId)
  const approve = useApproveOutlineMutation(documentId)
  const { toast } = useToast()

  const outline = outlineQuery.data ?? null
  const isApproved = outline?.status === "Approved"

  const handleApprove = () => {
    approve.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Outline approved",
          description: `${fileName} is ready for role training.`,
          variant: "success",
        })
      },
      onError: (err) => {
        toast({
          title: "Approval failed",
          description: getErrorMessage(err, "Could not approve outline."),
          variant: "error",
        })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(960px,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-subtle/40 text-primary">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{fileName}</DialogTitle>
              <DialogDescription>
                AI-extracted training outline grounded in the source document
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          {outlineQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading outline…
            </div>
          ) : outlineQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {getErrorMessage(outlineQuery.error, "Failed to load outline.")}
            </p>
          ) : !outline ? (
            <p className="text-sm text-muted-foreground">
              No outline yet. Run analysis on this document first.
            </p>
          ) : (
            <OutlineBody outline={outline} />
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border bg-surface px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {outline ? (
              <>
                <StatusBadge status={isApproved ? "Approved" : "Draft"} />
                <span>·</span>
                <span>{outline.sections.length} sections</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {outline && !isApproved ? (
              <Button onClick={handleApprove} disabled={approve.isPending}>
                {approve.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Approving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Approve outline
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OutlineBody({ outline }: { outline: TrainingOutlineResponse }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Badge variant="primary">{outline.regulationType}</Badge>
        <Badge variant="secondary">{outline.sections.length} sections</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          Generated{" "}
          {new Date(outline.generatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </header>

      <ol className="space-y-4">
        {outline.sections.map((section, i) => (
          <li
            key={`${section.title}-${i}`}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Module {i + 1}
            </p>
            <h3 className="mt-0.5 font-heading text-base font-semibold">
              {section.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {section.description}
            </p>

            {section.regulatoryBasis ? (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline">
                  Article {section.regulatoryBasis.amlrArticle}
                </Badge>
                {section.regulatoryBasis.articleTitle ? (
                  <span className="text-xs text-muted-foreground">
                    {section.regulatoryBasis.articleTitle}
                  </span>
                ) : null}
              </div>
            ) : null}

            {section.learningObjectives.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Learning objectives
                </p>
                <ul className="space-y-1 text-sm">
                  {section.learningObjectives.map((obj) => (
                    <li key={obj} className="flex gap-2 leading-relaxed">
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {section.citations.length > 0 ? (
              <details className="group mt-4">
                <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  Sources ({section.citations.length})
                </summary>
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {section.citations.map((c, ci) => (
                    <li
                      key={`${c.chunkId}-${ci}`}
                      className="border-l-2 border-border pl-3 text-xs text-muted-foreground"
                    >
                      <p className="text-foreground/90">{c.text}</p>
                      <p className="mt-1">
                        {c.sourceDocument} · p.{c.pageNumber} · {c.section}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
