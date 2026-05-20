"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  generateFullProgram,
  getFullProgramStatus,
  getFullProgram,
  downloadScorm,
} from "@/lib/api/full-program"
import { queryKeys } from "@/lib/api/query-keys"

const FULL_PROGRAM_POLL_INTERVAL_MS = 4000

export function useFullProgramStatus(roleId: string | null) {
  return useQuery({
    queryKey: queryKeys.fullProgram.status(roleId ?? ""),
    queryFn: ({ signal }) => getFullProgramStatus(roleId!, signal),
    enabled: Boolean(roleId),
    refetchInterval: (query) => {
      if (query.state.data?.status === "Generating") return FULL_PROGRAM_POLL_INTERVAL_MS
      return false
    },
  })
}

export function useFullProgram(roleId: string | null, isReady: boolean) {
  return useQuery({
    queryKey: queryKeys.fullProgram.detail(roleId ?? ""),
    queryFn: ({ signal }) => getFullProgram(roleId!, signal),
    enabled: Boolean(roleId) && isReady,
  })
}

export function useGenerateFullProgramMutation(roleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => generateFullProgram(roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fullProgram.status(roleId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fullProgram.detail(roleId),
      })
    },
  })
}

export function useDownloadScormMutation(roleId: string, roleName: string) {
  return useMutation({
    mutationFn: () => downloadScorm(roleId, roleName),
  })
}
