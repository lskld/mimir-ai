"use client"

import { useState } from "react"
import { CheckCircle2, FileText, Loader2, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/mimir/status-badge"
import { OutlineViewerDialog } from "./outline-viewer-dialog"
import { useStartAnalysisMutation } from "@/lib/api/hooks/use-analysis-mutations"
import { useDocument } from "@/lib/api/hooks/use-document"
import { useDocumentOutline } from "@/lib/api/hooks/use-outline"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"
import { cn } from "@/lib/utils"
import type { DocumentResponse } from "@/lib/api/types"

type DocumentCardProps = {
  document: DocumentResponse
}

export function DocumentCard({ document }: DocumentCardProps) {
  // `triggered` flips true the moment the user clicks Analyze and stays true as long
  // as the request is still in flight or pending a response from the server. We
  // never reset it manually — once the outline arrives or the doc fails, the
  // derived `isAnalyzing` flag below evaluates to false anyway.
  const [triggered, setTriggered] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const { toast } = useToast()

  const startAnalysis = useStartAnalysisMutation(document.id)
  const outlineQuery = useDocumentOutline(document.id, {
    pollWhileAnalyzing: triggered,
  })
  const docDetail = useDocument(triggered ? document.id : undefined)

  const liveStatus = docDetail.data?.status ?? document.status
  const outline = outlineQuery.data ?? null
  const isApproved = outline?.status === "Approved"

  // "Analyzing" = user triggered AND we don't yet have an outline AND the doc
  // hasn't failed. Derived, not stored — no effect needed.
  const isAnalyzing =
    triggered && !outline && liveStatus !== "Failed" &&
    (startAnalysis.isPending || liveStatus === "Pending" || liveStatus === "Parsed")

  const status = (() => {
    if (liveStatus === "Failed") return "Failed"
    if (isApproved) return "Approved"
    if (outline) return "Analyzed"
    if (isAnalyzing || liveStatus === "Pending" || liveStatus === "Parsed") {
      return "Generating"
    }
    return "Pending"
  })()

  const handleAnalyze = () => {
    setTriggered(true)
    startAnalysis.mutate(
      {
        documentId: document.id,
        regulationType: document.regulationType?.trim() || "AMLR",
      },
      {
        onSuccess: () => {
          toast({
            title: "Analysis started",
            description: `Mimir is processing ${document.originalFileName}.`,
          })
        },
        onError: (err) => {
          setTriggered(false)
          toast({
            title: "Analysis failed",
            description: getErrorMessage(err, "Could not start analysis."),
            variant: "error",
          })
        },
      }
    )
  }

  const fileExt = document.originalFileName.split(".").pop()?.toUpperCase() ?? ""

  return (
    <>
      <div
        className={cn(
          "group/card flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all",
          "hover:border-border-accent hover:bg-card",
          isApproved && "border-success/30"
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              isApproved
                ? "bg-success/15 text-success"
                : "bg-blue-subtle/40 text-primary"
            )}
          >
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight" title={document.originalFileName}>
              {document.originalFileName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {fileExt ? <Badge variant="outline" size="sm">{fileExt}</Badge> : null}
              {document.regulationType ? (
                <Badge variant="primary" size="sm">{document.regulationType}</Badge>
              ) : null}
              <span className="text-[11px] text-muted-foreground">
                {formatDate(document.uploadedAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <StatusBadge
            status={status}
            label={
              status === "Approved"
                ? "Outline approved"
                : status === "Analyzed"
                  ? "Analyzed"
                  : status === "Generating"
                    ? isAnalyzing
                      ? "Analyzing…"
                      : "Processing…"
                    : status === "Failed"
                      ? "Failed"
                      : "Not analyzed"
            }
          />
          <div className="flex items-center gap-1.5">
            {status === "Pending" || status === "Failed" ? (
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={startAnalysis.isPending || isAnalyzing}
              >
                {startAnalysis.isPending || isAnalyzing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Analyze
                  </>
                )}
              </Button>
            ) : null}
            {status === "Generating" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Working on it…
              </span>
            ) : null}
            {outline ? (
              <Button size="sm" variant="outline" onClick={() => setViewerOpen(true)}>
                View outline
              </Button>
            ) : null}
            {outline && !isApproved ? (
              <Button size="sm" onClick={() => setViewerOpen(true)}>
                <CheckCircle2 className="size-3.5" />
                Approve
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {viewerOpen ? (
        <OutlineViewerDialog
          open={viewerOpen}
          documentId={document.id}
          fileName={document.originalFileName}
          onOpenChange={setViewerOpen}
        />
      ) : null}
    </>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
