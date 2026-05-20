"use client"

import { useQuery } from "@tanstack/react-query"
import { getHierarchy } from "@/lib/api/hierarchy"
import { flattenHierarchyTargets } from "@/lib/api/vault-utils"
import { queryKeys } from "@/lib/api/query-keys"

export function useHierarchy() {
  return useQuery({
    queryKey: queryKeys.hierarchy.all,
    queryFn: ({ signal }) => getHierarchy(signal),
  })
}

export function useHierarchyTargets() {
  const query = useHierarchy()
  const targets = query.data ? flattenHierarchyTargets(query.data) : []
  return { ...query, targets }
}
