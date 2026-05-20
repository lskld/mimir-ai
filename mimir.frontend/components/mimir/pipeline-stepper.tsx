"use client"

import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type PipelineStage = {
  id: string
  label: string
  description?: string
}

export type StageState = "completed" | "active" | "locked" | "loading"

type PipelineStepperProps = {
  stages: PipelineStage[]
  /** Index of the currently active stage. Stages before are completed; after are locked. */
  currentStage: number
  /** Optional override — set a stage to "loading" while async work is in flight. */
  stateOverride?: Partial<Record<number, StageState>>
  onStageClick?: (index: number) => void
  className?: string
}

export function PipelineStepper({
  stages,
  currentStage,
  stateOverride,
  onStageClick,
  className,
}: PipelineStepperProps) {
  return (
    <ol
      className={cn(
        "relative grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
        className
      )}
    >
      {stages.map((stage, index) => {
        const state: StageState =
          stateOverride?.[index] ??
          (index < currentStage
            ? "completed"
            : index === currentStage
              ? "active"
              : "locked")

        const clickable = state !== "locked" && Boolean(onStageClick)

        return (
          <li key={stage.id} className="relative min-w-0">
            <button
              type="button"
              onClick={() => clickable && onStageClick?.(index)}
              disabled={!clickable}
              className={cn(
                "group/step relative flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all",
                state === "active" &&
                  "border-primary bg-blue-subtle/40 shadow-[0_0_0_3px_var(--blue-glow)]",
                state === "completed" &&
                  "border-border bg-surface hover:border-border-accent",
                state === "loading" &&
                  "border-warning/40 bg-warning/5",
                state === "locked" &&
                  "border-border bg-surface opacity-50",
                clickable && "cursor-pointer",
                !clickable && "cursor-not-allowed"
              )}
            >
              <StageMarker index={index} state={state} />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                  Step {index + 1}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-sm font-semibold",
                    state === "active" ? "text-foreground" : "text-foreground/90"
                  )}
                >
                  {stage.label}
                </p>
                {stage.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {stage.description}
                  </p>
                ) : null}
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function StageMarker({ index, state }: { index: number; state: StageState }) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
        state === "active" && "border-primary bg-primary text-primary-foreground",
        state === "completed" &&
          "border-success bg-success/15 text-success",
        state === "loading" && "border-warning bg-warning/15 text-warning",
        state === "locked" && "border-border bg-surface text-muted-foreground"
      )}
    >
      {state === "completed" ? (
        <Check className="size-4" />
      ) : state === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        index + 1
      )}
    </span>
  )
}
