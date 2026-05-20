"use client"

import { useCallback, useRef, useState } from "react"
import { CloudUpload, FileText, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUploadDocumentMutation } from "@/lib/api/hooks/use-upload-document"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"
import { cn } from "@/lib/utils"

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"]
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_BYTES = 20 * 1024 * 1024

function isAcceptedFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  if (ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true
  return ACCEPTED_MIME.includes(file.type)
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUploadZone() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [regulationType, setRegulationType] = useState("AMLR")
  const [dragActive, setDragActive] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const upload = useUploadDocumentMutation()
  const { toast } = useToast()

  const handleFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null)
      setValidationError(null)
      return
    }
    if (!isAcceptedFile(next)) {
      setValidationError("Only PDF or DOCX files are supported.")
      setFile(null)
      return
    }
    if (next.size > MAX_BYTES) {
      setValidationError("File is larger than 20 MB.")
      setFile(null)
      return
    }
    setValidationError(null)
    setFile(next)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      const dropped = e.dataTransfer.files?.[0] ?? null
      handleFile(dropped)
    },
    [handleFile]
  )

  function submit() {
    if (!file) {
      setValidationError("Choose a PDF or DOCX file.")
      return
    }
    upload.mutate(
      { file, regulationType: regulationType.trim() || undefined },
      {
        onSuccess: (doc) => {
          toast({
            title: "Document uploaded",
            description: `${doc.originalFileName} is ready for analysis.`,
            variant: "success",
          })
          setFile(null)
          if (fileInput.current) fileInput.current.value = ""
        },
        onError: (err) => {
          toast({
            title: "Upload failed",
            description: getErrorMessage(err, "Could not upload the file."),
            variant: "error",
          })
        },
      }
    )
  }

  const isBusy = upload.isPending

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragActive(false)
        }}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInput.current?.click()
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card px-6 py-10 text-center transition-all",
          dragActive
            ? "border-primary bg-blue-subtle/20"
            : "border-border hover:border-primary/60 hover:bg-surface-elevated",
          isBusy && "pointer-events-none opacity-70"
        )}
      >
        <span
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
            dragActive
              ? "bg-primary text-primary-foreground"
              : "bg-blue-subtle/40 text-primary group-hover:bg-primary/20"
          )}
        >
          <CloudUpload className="size-6" />
        </span>
        <p className="font-heading text-base font-semibold">
          {file ? file.name : "Drop a policy document here"}
        </p>
        <p className="text-xs text-muted-foreground">
          {file
            ? formatSize(file.size)
            : "Click to browse — accepts PDF or DOCX up to 20 MB"}
        </p>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={isBusy}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {validationError ? (
        <p className="text-destructive text-sm" role="alert">
          {validationError}
        </p>
      ) : null}

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <FileText className="size-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="hidden text-xs text-muted-foreground sm:inline">
              Regulation
            </label>
            <input
              value={regulationType}
              onChange={(ev) => setRegulationType(ev.target.value)}
              disabled={isBusy}
              className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              placeholder="AMLR"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isBusy}
              onClick={(e) => {
                e.stopPropagation()
                handleFile(null)
                if (fileInput.current) fileInput.current.value = ""
              }}
              aria-label="Remove file"
            >
              <X className="size-3.5" />
            </Button>
            <Button type="button" size="sm" onClick={submit} disabled={isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
