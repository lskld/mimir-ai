"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { getErrorMessage } from "@/lib/api/error-message"
import { useUploadDocumentMutation } from "@/lib/api/hooks/use-upload-document"

type NewDocumentSheetProps = {
  trigger?: React.ReactNode
}

export function NewDocumentSheet({ trigger }: NewDocumentSheetProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [regulationType, setRegulationType] = useState("AMLR")
  const [validationError, setValidationError] = useState<string | null>(null)

  const upload = useUploadDocumentMutation()

  function resetForm() {
    setFile(null)
    setRegulationType("AMLR")
    setValidationError(null)
    upload.reset()
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      resetForm()
    }
  }

  function onSubmit() {
    if (!file) {
      setValidationError("Choose a PDF or DOCX file (max 20 MB).")
      return
    }
    setValidationError(null)
    upload.mutate(
      { file, regulationType: regulationType.trim() || undefined },
      {
        onSuccess: (doc) => {
          setOpen(false)
          resetForm()
          router.push(`/studio/${doc.id}`)
        },
      }
    )
  }

  const errorMessage =
    validationError ??
    (upload.isError ? getErrorMessage(upload.error, "Upload failed.") : null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus />
            New document
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New document</SheetTitle>
          <SheetDescription>
            Upload a compliance PDF or DOCX. You can run analysis in Studio
            after upload.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
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

          {errorMessage ? (
            <p className="text-destructive text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <SheetFooter>
          <Button
            type="button"
            className="w-full"
            disabled={upload.isPending}
            onClick={onSubmit}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
