"use client"

import { useQueries } from "@tanstack/react-query"
import { getFullProgramStatus } from "@/lib/api/full-program"
import { queryKeys } from "@/lib/api/query-keys"
import type { FullProgramStatusResponse } from "@/lib/api/types"

/**
 * Batch-fetch the full-program status for a set of roles. The status endpoint returns
 * 404 for roles that have never been generated, which surfaces here as an `isError`
 * query — treat those as "not started" rather than infrastructure failures.
 */
export function useFullProgramStatuses(roleIds: string[]) {
  const queries = useQueries({
    queries: roleIds.map((roleId) => ({
      queryKey: queryKeys.fullProgram.status(roleId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getFullProgramStatus(roleId, signal),
      enabled: Boolean(roleId),
      retry: false,
    })),
  })

  const byRole: Record<string, FullProgramStatusResponse | null> = {}
  let readyCount = 0
  let generatingCount = 0
  let failedCount = 0

  roleIds.forEach((roleId, i) => {
    const q = queries[i]
    const data = q?.data ?? null
    byRole[roleId] = data
    if (data?.status === "Ready") readyCount++
    if (data?.status === "Generating") generatingCount++
    if (data?.status === "Failed") failedCount++
  })

  const isPending = queries.some((q) => q.isPending)

  return { byRole, readyCount, generatingCount, failedCount, isPending }
}
