"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createDepartment,
  createOrganizationLevel,
  createRole,
  publishRole,
} from "@/lib/api/hierarchy"
import type {
  CreateDepartmentRequest,
  CreateOrganizationLevelRequest,
  CreateRoleRequest,
} from "@/lib/api/types"
import { queryKeys } from "@/lib/api/query-keys"

export function useCreateOrganizationLevelMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateOrganizationLevelRequest) =>
      createOrganizationLevel(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all })
    },
  })
}

export function useCreateDepartmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateDepartmentRequest) => createDepartment(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all })
    },
  })
}

export function useCreateRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRoleRequest) => createRole(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all })
    },
  })
}

export function usePublishRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => publishRole(roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hierarchy.all })
    },
  })
}
