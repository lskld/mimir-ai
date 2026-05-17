"use client"

import { useMutation } from "@tanstack/react-query"
import { uploadDocument } from "@/lib/api/documents"

export function useUploadDocumentMutation() {
  return useMutation({
    mutationFn: ({
      file,
      regulationType,
    }: {
      file: File
      regulationType?: string
    }) => uploadDocument(file, regulationType),
  })
}
