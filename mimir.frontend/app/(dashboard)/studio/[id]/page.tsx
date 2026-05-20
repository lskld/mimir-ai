"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { DocumentOutlineView } from "@/components/document-outline-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/lib/api/error-message"
import {
  useApproveOutlineMutation,
  useStartAnalysisMutation,
} from "@/lib/api/hooks/use-analysis-mutations"
import { useDocument } from "@/lib/api/hooks/use-document"
import { useDocumentOutline } from "@/lib/api/hooks/use-outline"
import { parseDocumentId } from "@/lib/utils/document-id"

export default function StudioDocumentPage() {
  const params = useParams()
  const documentId = parseDocumentId(
    typeof params.id === "string" ? params.id : undefined
  )

  const [regulationType, setRegulationType] = useState("AMLR")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const documentQuery = useDocument(documentId)
  const outlineQuery = useDocumentOutline(documentId, {
    pollWhileAnalyzing: isAnalyzing,
  })

  const startAnalysis = useStartAnalysisMutation(documentId)
  const approveOutline = useApproveOutlineMutation(documentId)

  useEffect(() => {
    const rt = documentQuery.data?.regulationType
    if (rt) {
      setRegulationType(rt)
    }
  }, [documentQuery.data?.regulationType])

  useEffect(() => {
    if (isAnalyzing && outlineQuery.data) {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing, outlineQuery.data])

  useEffect(() => {
    if (isAnalyzing && outlineQuery.isError) {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing, outlineQuery.isError])

  function runAnalysis() {
    if (!documentId) return
    setIsAnalyzing(true)
    startAnalysis.mutate(
      { documentId, regulationType: regulationType.trim() || "AMLR" },
      {
        onError: () => {
          setIsAnalyzing(false)
        },
      }
    )
  }

  if (!documentId) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Invalid document id in the URL. Upload a document from Documents.
      </p>
    )
  }

  if (documentQuery.isError && !documentQuery.data) {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm" role="alert">
          {getErrorMessage(documentQuery.error, "Failed to load document.")}
        </p>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    )
  }

  const document = documentQuery.data
  const outline = outlineQuery.data ?? null
  const isOutlineApproved =
    outline?.status === "Approved" ||
    (approveOutline.isSuccess && !approveOutline.isError)

  const isAnalyzeBusy =
    isAnalyzing || startAnalysis.isPending || documentQuery.isPending

  const analyzeError = startAnalysis.isError
    ? getErrorMessage(startAnalysis.error, "Analysis failed.")
    : null

  const approveError = approveOutline.isError
    ? getErrorMessage(approveOutline.error, "Approve failed.")
    : null

  const outlineLoadError =
    outlineQuery.isError && !outline
      ? getErrorMessage(outlineQuery.error, "Failed to load outline.")
      : null

  const showAnalyzeHint =
    !outline &&
    document &&
    document.status !== "Failed" &&
    !isAnalyzing

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Document
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {document?.originalFileName ?? "…"}
          </h2>
          {document ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Status:{" "}
              <span className="text-foreground">{document.status}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/preview/${documentId}`}>Preview</Link>
          </Button>
        </div>
      </div>

      {document?.status === "Failed" ? (
        <p className="text-destructive text-sm" role="alert">
          This document failed processing. Upload again or check API logs.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid min-w-[200px] flex-1 gap-1.5">
          <span className="text-sm font-medium">
            Regulation type (analysis)
          </span>
          <Input
            value={regulationType}
            onChange={(ev) => setRegulationType(ev.target.value)}
            disabled={isAnalyzeBusy || approveOutline.isPending}
          />
        </label>
        <Button
          type="button"
          disabled={
            isAnalyzeBusy ||
            approveOutline.isPending ||
            document?.status === "Failed"
          }
          onClick={runAnalysis}
        >
          {isAnalyzing || startAnalysis.isPending
            ? "Analyzing…"
            : "Run analysis"}
        </Button>
        {outline && !isOutlineApproved ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isAnalyzeBusy || approveOutline.isPending}
            onClick={() => approveOutline.mutate()}
          >
            {approveOutline.isPending ? "Approving…" : "Approve outline"}
          </Button>
        ) : null}
        {isOutlineApproved ? (
          <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Outline approved
          </span>
        ) : null}
      </div>

      {analyzeError ? (
        <p className="text-destructive text-sm" role="alert">
          {analyzeError}
        </p>
      ) : null}

      {approveError ? (
        <p className="text-destructive text-sm" role="alert">
          {approveError}
        </p>
      ) : null}

      {outlineLoadError ? (
        <p className="text-destructive text-sm" role="alert">
          {outlineLoadError}
        </p>
      ) : null}

      {approveOutline.isSuccess && isOutlineApproved ? (
        <p className="text-muted-foreground text-sm" role="status">
          This outline is approved and ready for vault assignment and role
          training.
        </p>
      ) : null}

      {isAnalyzing ? (
        <p className="text-muted-foreground text-sm">
          Waiting for the training outline (polling every 2 seconds)…
        </p>
      ) : null}

      {outline ? (
        <DocumentOutlineView outline={outline} />
      ) : showAnalyzeHint ? (
        <p className="text-muted-foreground text-sm">
          No outline yet. Set the regulation type if needed, then run analysis.
        </p>
      ) : null}
    </div>
  )
}
