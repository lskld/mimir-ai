"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { approveOutline, startAnalysis } from "@/lib/api/analysis"
import type { AnalyzeDocumentRequest } from "@/lib/api/types"
import { queryKeys } from "@/lib/api/query-keys"

export function useStartAnalysisMutation(documentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AnalyzeDocumentRequest) => startAnalysis(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documents.detail(documentId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.outlines.detail(documentId),
      })
    },
  })
}

export function useApproveOutlineMutation(documentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => approveOutline(documentId),
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(queryKeys.outlines.detail(documentId), data)
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.outlines.detail(documentId),
      })
    },
  })
}
