"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  generateRoleOutline,
  getRoleTrainingStatus,
  getRoleTrainingOutline,
  approveRoleOutline,
} from "@/lib/api/training"
import { queryKeys } from "@/lib/api/query-keys"

const TRAINING_POLL_INTERVAL_MS = 2000

export function useRoleTrainingStatus(roleId: string | null) {
  return useQuery({
    queryKey: queryKeys.training.status(roleId ?? ""),
    queryFn: ({ signal }) => getRoleTrainingStatus(roleId!, signal),
    enabled: Boolean(roleId),
    refetchInterval: (query) => {
      if (!query.state.data) return TRAINING_POLL_INTERVAL_MS
      if (query.state.data.status === "Generating") return TRAINING_POLL_INTERVAL_MS
      return false
    },
  })
}

export function useRoleTrainingOutline(
  roleId: string | null,
  isReady: boolean
) {
  return useQuery({
    queryKey: queryKeys.training.outline(roleId ?? ""),
    queryFn: ({ signal }) => getRoleTrainingOutline(roleId!, signal),
    enabled: Boolean(roleId) && isReady,
  })
}

export function useGenerateRoleOutlineMutation(roleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => generateRoleOutline(roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.training.status(roleId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.training.outline(roleId),
      })
    },
  })
}

export function useApproveRoleOutlineMutation(roleId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => approveRoleOutline(roleId),
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(queryKeys.training.outline(roleId), data)
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.training.status(roleId),
      })
    },
  })
}
