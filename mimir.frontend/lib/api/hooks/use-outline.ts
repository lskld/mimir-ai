"use client"

import { useQuery } from "@tanstack/react-query"
import { tryGetOutline } from "@/lib/api/analysis"
import { OUTLINE_POLL_INTERVAL_MS } from "@/lib/api/constants"
import { getDocument } from "@/lib/api/documents"
import { queryKeys } from "@/lib/api/query-keys"

export function useDocumentOutline(
  documentId: string | undefined,
  options?: { pollWhileAnalyzing?: boolean }
) {
  const pollWhileAnalyzing = options?.pollWhileAnalyzing ?? false

  return useQuery({
    queryKey: queryKeys.outlines.detail(documentId ?? ""),
    queryFn: async ({ signal }) => {
      const outline = await tryGetOutline(documentId!, signal)
      if (outline) {
        return outline
      }

      if (pollWhileAnalyzing) {
        const doc = await getDocument(documentId!, signal)
        if (doc.status === "Failed") {
          throw new Error(
            "Document analysis failed. Check the API logs for details."
          )
        }
      }

      return null
    },
    enabled: Boolean(documentId),
    staleTime: pollWhileAnalyzing ? 0 : 30_000,
    refetchInterval: (query) => {
      if (!pollWhileAnalyzing) return false
      if (query.state.data) return false
      if (query.state.error) return false
      return OUTLINE_POLL_INTERVAL_MS
    },
  })
}
