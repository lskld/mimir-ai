"use client"

import { useQuery } from "@tanstack/react-query"
import { getDocument } from "@/lib/api/documents"
import { queryKeys } from "@/lib/api/query-keys"

export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.detail(documentId ?? ""),
    queryFn: ({ signal }) => getDocument(documentId!, signal),
    enabled: Boolean(documentId),
  })
}
