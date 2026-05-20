"use client"

import { useQuery } from "@tanstack/react-query"
import { listDocuments } from "@/lib/api/documents"
import { queryKeys } from "@/lib/api/query-keys"

export function useDocumentsList() {
  return useQuery({
    queryKey: queryKeys.documents.list(),
    queryFn: ({ signal }) => listDocuments(signal),
  })
}
