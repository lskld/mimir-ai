"use client"

import { useMemo } from "react"
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Sparkles,
  Workflow,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PipelineStepper, type PipelineStage } from "@/components/mimir/pipeline-stepper"
import { StatusBadge } from "@/components/mimir/status-badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useRoleResolvedDocuments } from "@/lib/api/hooks/use-vault"
import {
  useApproveRoleOutlineMutation,
  useGenerateRoleOutlineMutation,
  useRoleTrainingOutline,
  useRoleTrainingStatus,
} from "@/lib/api/hooks/use-training"
import {
  useDownloadScormMutation,
  useFullProgram,
  useFullProgramStatus,
  useGenerateFullProgramMutation,
} from "@/lib/api/hooks/use-full-program"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"
import { formatInheritedFrom } from "@/lib/api/vault-utils"
import { cn } from "@/lib/utils"
import type { RoleOption } from "./role-selector"

const STAGES: PipelineStage[] = [
  { id: "select", label: "Select role", description: "Pick the role to train" },
  { id: "documents", label: "Review documents", description: "Inherited from vault" },
  { id: "outline", label: "Generate outline", description: "AI-drafts modules" },
  { id: "approve", label: "Review & approve", description: "Human-in-the-loop" },
  { id: "program", label: "Generate program", description: "Lessons + quizzes" },
  { id: "export", label: "Export SCORM", description: "LMS-ready ZIP" },
]

type TrainingPipelineProps = {
  role: RoleOption
}

export function TrainingPipeline({ role }: TrainingPipelineProps) {
  const { toast } = useToast()

  const resolvedQuery = useRoleResolvedDocuments(role.id)
  const resolvedDocs = resolvedQuery.data?.documents ?? []

  const outlineStatusQuery = useRoleTrainingStatus(role.id)
  const outlineStatus = outlineStatusQuery.data?.status ?? "Pending"
  const isOutlineReady = outlineStatus === "Ready"

  const outlineQuery = useRoleTrainingOutline(role.id, isOutlineReady)
  const outline = outlineQuery.data ?? null
  const isOutlineApproved = outline?.status === "Approved"

  const programStatusQuery = useFullProgramStatus(role.id)
  const programStatus = programStatusQuery.data?.status ?? "NotStarted"
  const isProgramReady = programStatus === "Ready"

  const programQuery = useFullProgram(role.id, isProgramReady)
  const program = programQuery.data ?? null

  const generateOutline = useGenerateRoleOutlineMutation(role.id)
  const approveOutline = useApproveRoleOutlineMutation(role.id)
  const generateProgram = useGenerateFullProgramMutation(role.id)
  const downloadScorm = useDownloadScormMutation(role.id, role.name)

  // Compute current stage from the live API state.
  const currentStage = useMemo(() => {
    if (programStatus === "Ready") return 5
    if (programStatus === "Generating") return 4
    if (isOutlineApproved) return 4
    if (isOutlineReady) return 3
    if (outlineStatus === "Generating") return 2
    if (resolvedDocs.length > 0 || !resolvedQuery.isPending) return 2
    return 1
  }, [
    isOutlineApproved,
    isOutlineReady,
    outlineStatus,
    programStatus,
    resolvedDocs.length,
    resolvedQuery.isPending,
  ])

  const stateOverride: Record<number, "loading" | "completed" | "active" | "locked"> = {}
  if (outlineStatus === "Generating") stateOverride[2] = "loading"
  if (programStatus === "Generating") stateOverride[4] = "loading"

  return (
    <div className="space-y-6">
      <PipelineStepper
        stages={STAGES}
        currentStage={currentStage}
        stateOverride={stateOverride}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Stage 2 — documents */}
          <StagePanel
            stageIndex={1}
            currentStage={currentStage}
            title="Documents this role inherits"
            description="Mimir uses these regulations to ground every module. Manage the vault on the Organization page."
            icon={FileText}
          >
            {resolvedQuery.isPending ? (
              <ListSkeleton />
            ) : resolvedDocs.length === 0 ? (
              <EmptyInline message="No documents reach this role yet. Open Organization and assign at least one regulation." />
            ) : (
              <ul className="space-y-1.5">
                {resolvedDocs.map((doc) => (
                  <li
                    key={`${doc.documentId}-${doc.inheritedFrom}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <FileText className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.fileName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Inherited from {formatInheritedFrom(doc.inheritedFrom)}
                        {doc.inheritedFromName ? ` · ${doc.inheritedFromName}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" size="sm">
                      {formatInheritedFrom(doc.inheritedFrom)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </StagePanel>

          {/* Stage 3 — generate outline */}
          <StagePanel
            stageIndex={2}
            currentStage={currentStage}
            title="Generate role outline"
            description="Mimir merges every inherited document and customizes a curriculum to this role's risk profile."
            icon={Sparkles}
            badge={
              <StatusBadge
                status={outlineStatus}
                label={outlineStatus === "Pending" ? "Not started" : undefined}
              />
            }
          >
            {outlineStatus === "Failed" && outlineStatusQuery.data?.errorMessage ? (
              <p className="text-destructive text-sm" role="alert">
                {outlineStatusQuery.data.errorMessage}
              </p>
            ) : null}
            {outlineStatus === "Generating" ? (
              <GeneratingHint
                title="Generating outline"
                detail="Polling every 2 seconds. Usually 30–60 seconds for a single regulation."
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() =>
                  generateOutline.mutate(undefined, {
                    onError: (err) =>
                      toast({
                        title: "Could not start outline",
                        description: getErrorMessage(err, "Outline generation failed."),
                        variant: "error",
                      }),
                  })
                }
                disabled={
                  generateOutline.isPending ||
                  outlineStatus === "Generating" ||
                  resolvedDocs.length === 0
                }
              >
                {generateOutline.isPending || outlineStatus === "Generating" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating…
                  </>
                ) : isOutlineReady ? (
                  <>
                    <Sparkles className="size-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate outline
                  </>
                )}
              </Button>
              {resolvedDocs.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Assign at least one document first.
                </span>
              ) : null}
            </div>
          </StagePanel>

          {/* Stage 4 — review & approve */}
          <StagePanel
            stageIndex={3}
            currentStage={currentStage}
            title="Review & approve outline"
            description="Inspect the modules Mimir drafted. Approve to unlock the full program."
            icon={CheckCircle2}
            badge={
              outline ? (
                <StatusBadge status={isOutlineApproved ? "Approved" : "Draft"} />
              ) : undefined
            }
          >
            {outline ? (
              <>
                <RoleOutlinePreview
                  sections={outline.sections}
                  regulationType={outline.regulationType}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {!isOutlineApproved ? (
                    <ConfirmDialog
                      trigger={
                        <Button disabled={approveOutline.isPending}>
                          {approveOutline.isPending ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Approving…
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="size-4" />
                              Approve outline
                            </>
                          )}
                        </Button>
                      }
                      title="Approve outline for this role?"
                      description="Once approved, you can generate the full training program. You can regenerate the outline later if needed."
                      confirmLabel="Approve"
                      onConfirm={() =>
                        approveOutline.mutate(undefined, {
                          onSuccess: () =>
                            toast({
                              title: "Outline approved",
                              description: "Ready to generate the full program.",
                              variant: "success",
                            }),
                          onError: (err) =>
                            toast({
                              title: "Approval failed",
                              description: getErrorMessage(err, "Could not approve outline."),
                              variant: "error",
                            }),
                        })
                      }
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-success">
                      <CheckCircle2 className="size-4" />
                      Outline approved
                    </span>
                  )}
                </div>
              </>
            ) : (
              <EmptyInline message="Run outline generation above first." />
            )}
          </StagePanel>

          {/* Stage 5 — generate program */}
          <StagePanel
            stageIndex={4}
            currentStage={currentStage}
            title="Generate full program"
            description="Mimir writes lessons, quizzes, and case studies for every objective. This is the big one — 2–5 minutes."
            icon={Workflow}
            badge={
              <StatusBadge
                status={programStatus}
                label={programStatus === "NotStarted" ? "Not started" : undefined}
              />
            }
          >
            {programStatus === "Generating" ? (
              <GeneratingHint
                title="Generating full program"
                detail="Polling every 4 seconds. Roughly 50 LLM calls. Sit tight."
              />
            ) : null}
            {programStatus === "Failed" && programStatusQuery.data?.errorMessage ? (
              <p className="text-destructive text-sm" role="alert">
                {programStatusQuery.data.errorMessage}
              </p>
            ) : null}
            <Button
              onClick={() =>
                generateProgram.mutate(undefined, {
                  onError: (err) =>
                    toast({
                      title: "Could not start program",
                      description: getErrorMessage(err, "Program generation failed."),
                      variant: "error",
                    }),
                })
              }
              disabled={
                generateProgram.isPending ||
                programStatus === "Generating" ||
                !isOutlineApproved
              }
            >
              {generateProgram.isPending || programStatus === "Generating" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : isProgramReady ? (
                <>
                  <Workflow className="size-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Workflow className="size-4" />
                  Generate full program
                </>
              )}
            </Button>
            {!isOutlineApproved ? (
              <p className="text-xs text-muted-foreground">
                Approve the outline above first.
              </p>
            ) : null}
          </StagePanel>

          {/* Stage 6 — export */}
          <StagePanel
            stageIndex={5}
            currentStage={currentStage}
            title="Export SCORM"
            description="Download a SCORM 1.2 ZIP. Drop it into any LMS that speaks SCORM."
            icon={Download}
          >
            {isProgramReady ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" />
                    <p className="text-sm font-medium">Program is ready.</p>
                  </div>
                  {program ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {program.modules.length} modules · generated{" "}
                      {new Date(program.generatedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  ) : null}
                </div>
                <ConfirmDialog
                  trigger={
                    <Button disabled={downloadScorm.isPending}>
                      {downloadScorm.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Preparing…
                        </>
                      ) : (
                        <>
                          <Download className="size-4" />
                          Export SCORM
                        </>
                      )}
                    </Button>
                  }
                  title="Export SCORM package?"
                  description={`Mimir will build a SCORM 1.2 ZIP for ${role.name} and start a browser download.`}
                  confirmLabel="Export"
                  onConfirm={() =>
                    downloadScorm.mutate(undefined, {
                      onSuccess: () =>
                        toast({
                          title: "SCORM exported",
                          description: "Your download has started.",
                          variant: "success",
                        }),
                      onError: (err) =>
                        toast({
                          title: "Export failed",
                          description: getErrorMessage(err, "SCORM export failed."),
                          variant: "error",
                        }),
                    })
                  }
                />
              </div>
            ) : (
              <EmptyInline message="Generate the full program first." />
            )}
          </StagePanel>
        </div>

        {/* Sidebar summary */}
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Selected role
            </p>
            <p className="mt-0.5 font-heading text-lg font-semibold">
              {role.name}
            </p>
            <p className="text-xs text-muted-foreground">{role.path}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <SummaryStat label="AML" value={role.amlRisk} />
              <SummaryStat label="Sanctions" value={role.sanctionsRisk} />
              <SummaryStat label="Fraud" value={role.fraudRisk} />
              <SummaryStat label="Docs" value={role.documentationRisk} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">How this works</p>
            <p>
              Mimir reads every regulation assigned to this role, drafts a
              role-tuned outline, and turns each objective into a lesson +
              quiz + scenario. The whole pipeline is grounded in your source
              documents.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StagePanel({
  stageIndex,
  currentStage,
  title,
  description,
  icon: Icon,
  badge,
  children,
}: {
  stageIndex: number
  currentStage: number
  title: string
  description?: string
  icon: typeof FileText
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const state =
    stageIndex < currentStage
      ? "completed"
      : stageIndex === currentStage
        ? "active"
        : "locked"

  return (
    <section
      className={cn(
        "rounded-xl border bg-card transition-all",
        state === "active" && "border-primary/40 shadow-[0_0_0_3px_var(--blue-glow)]",
        state === "completed" && "border-border",
        state === "locked" && "border-border opacity-70"
      )}
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md",
            state === "completed"
              ? "bg-success/15 text-success"
              : state === "active"
                ? "bg-primary text-primary-foreground"
                : "bg-surface-elevated text-muted-foreground"
          )}
        >
          {state === "completed" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Icon className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Step {stageIndex + 1}
          </p>
          <h3 className="font-heading text-base font-semibold leading-tight">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="space-y-3 px-5 py-4">
        {description ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
        {children}
      </div>
    </section>
  )
}

function GeneratingHint({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
      <Loader2 className="size-4 animate-spin text-warning" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}

function EmptyInline({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      {message}
    </p>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-1.5">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  const tone =
    value === "High"
      ? "text-destructive"
      : value === "Medium"
        ? "text-warning"
        : value === "Low"
          ? "text-success"
          : "text-muted-foreground"
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-sm font-medium", tone)}>{value}</p>
    </div>
  )
}

function RoleOutlinePreview({
  sections,
  regulationType,
}: {
  sections: { title: string; description: string; learningObjectives: string[] }[]
  regulationType: string
}) {
  if (sections.length === 0) {
    return (
      <EmptyInline message="Outline is empty — the source documents may be too sparse. Add more regulations to the vault." />
    )
  }
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Badge variant="primary" size="sm">{regulationType}</Badge>
        <span className="text-xs text-muted-foreground">{sections.length} modules</span>
      </div>
      <ol className="max-h-[260px] divide-y divide-border overflow-y-auto">
        {sections.slice(0, 12).map((s, i) => (
          <li key={`${s.title}-${i}`} className="px-4 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Module {i + 1}
            </p>
            <p className="mt-0.5 text-sm font-medium">{s.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {s.description}
            </p>
          </li>
        ))}
        {sections.length > 12 ? (
          <li className="px-4 py-2 text-center text-[11px] text-muted-foreground">
            + {sections.length - 12} more
          </li>
        ) : null}
      </ol>
    </div>
  )
}
