"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/lib/api/error-message"
import { getApiBaseUrl } from "@/lib/api/base"
import {
  useCreateDepartmentMutation,
  useCreateOrganizationLevelMutation,
  useCreateRoleMutation,
  usePublishRoleMutation,
} from "@/lib/api/hooks/use-hierarchy-mutations"

type HierarchyEmptySetupProps = {
  onHierarchyCreated?: () => void
}

export function HierarchyEmptySetup({
  onHierarchyCreated,
}: HierarchyEmptySetupProps) {
  const [orgName, setOrgName] = useState("Global Compliance")
  const [orgGeography, setOrgGeography] = useState("EU")
  const [deptName, setDeptName] = useState("Financial Crime & AML")
  const [roleName, setRoleName] = useState("KYC Analyst")
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null)
  const [createdDeptId, setCreatedDeptId] = useState<string | null>(null)
  const [createdRoleId, setCreatedRoleId] = useState<string | null>(null)

  const createOrg = useCreateOrganizationLevelMutation()
  const createDept = useCreateDepartmentMutation()
  const createRole = useCreateRoleMutation()
  const publish = usePublishRoleMutation()

  const error =
    (createOrg.isError
      ? getErrorMessage(createOrg.error, "Failed to create organization.")
      : null) ??
    (createDept.isError
      ? getErrorMessage(createDept.error, "Failed to create department.")
      : null) ??
    (createRole.isError
      ? getErrorMessage(createRole.error, "Failed to create role.")
      : null) ??
    (publish.isError
      ? getErrorMessage(publish.error, "Failed to publish role.")
      : null)

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-md border border-dashed border-border bg-muted/20 p-6">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Set up your organization</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The hierarchy API returned no organization levels. That usually means
          the database was never seeded. Create a minimal structure below, or
          restart the API after deleting{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            Mimir.API/mimir.db
          </code>{" "}
          so startup seed data runs.
        </p>
        <p className="text-muted-foreground text-xs">
          API:{" "}
          <code className="bg-muted rounded px-1 py-0.5">{getApiBaseUrl()}</code>
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">1. Organization level</h3>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Name</span>
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={Boolean(createdOrgId) || createOrg.isPending}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Geography</span>
          <Input
            value={orgGeography}
            onChange={(e) => setOrgGeography(e.target.value)}
            disabled={Boolean(createdOrgId) || createOrg.isPending}
          />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={Boolean(createdOrgId) || createOrg.isPending || !orgName.trim()}
          onClick={() =>
            createOrg.mutate(
              {
                name: orgName.trim(),
                geography: orgGeography.trim() || undefined,
                description: "Organization level",
              },
              {
                onSuccess: (res) => {
                  setCreatedOrgId(res.id ?? (res as { Id?: string }).Id ?? "")
                },
              }
            )
          }
        >
          {createdOrgId ? "Organization created" : "Create organization"}
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">2. Department</h3>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Name</span>
          <Input
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            disabled={
              !createdOrgId || Boolean(createdDeptId) || createDept.isPending
            }
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={
            !createdOrgId ||
            Boolean(createdDeptId) ||
            createDept.isPending ||
            !deptName.trim()
          }
          onClick={() =>
            createDept.mutate(
              {
                name: deptName.trim(),
                description: "Department",
                organizationLevelIds: [createdOrgId!],
              },
              {
                onSuccess: (res) => {
                  setCreatedDeptId(res.id ?? (res as { Id?: string }).Id ?? "")
                },
              }
            )
          }
        >
          {createdDeptId ? "Department created" : "Create department"}
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">3. Role (for assignments)</h3>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium">Name</span>
          <Input
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            disabled={
              !createdDeptId || Boolean(createdRoleId) || createRole.isPending
            }
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={
            !createdDeptId ||
            Boolean(createdRoleId) ||
            createRole.isPending ||
            !roleName.trim()
          }
          onClick={() =>
            createRole.mutate(
              {
                name: roleName.trim(),
                description: "Role",
                departmentIds: [createdDeptId!],
                amlRisk: "High",
                sanctionsRisk: "High",
                fraudRisk: "Medium",
                documentationRisk: "High",
                operationalRisk: "Medium",
              },
              {
                onSuccess: (res) => {
                  const roleId = res.id ?? (res as { Id?: string }).Id ?? ""
                  setCreatedRoleId(roleId)
                  publish.mutate(roleId, {
                    onSuccess: () => onHierarchyCreated?.(),
                  })
                },
              }
            )
          }
        >
          {createdRoleId ? "Role created" : "Create & publish role"}
        </Button>
        <p className="text-muted-foreground text-xs">
          Roles are published automatically so they can receive document
          assignments.
        </p>
      </section>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {createdRoleId ? (
        <p className="text-emerald-700 text-sm dark:text-emerald-400" role="status">
          Hierarchy ready. Click <strong>Refresh tree</strong> above if the
          assign view does not appear.
        </p>
      ) : null}
    </div>
  )
}
