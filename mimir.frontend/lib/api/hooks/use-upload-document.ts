"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { uploadDocument } from "@/lib/api/documents"
import { queryKeys } from "@/lib/api/query-keys"

export function useUploadDocumentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      file,
      regulationType,
    }: {
      file: File
      regulationType?: string
    }) => uploadDocument(file, regulationType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.list() })
    },
  })
}
