"use client"

import { ArrowUpRight, BookOpen, Building2, FileText, Sparkles, Workflow } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/activity-feed"
import { StatTile } from "@/components/dashboard/stat-tile"
import { useDocumentsList } from "@/lib/api/hooks/use-documents"
import { useHierarchy } from "@/lib/api/hooks/use-hierarchy"
import { useFullProgramStatuses } from "@/lib/api/hooks/use-program-statuses"
import { flattenHierarchyTargets } from "@/lib/api/vault-utils"

export default function DashboardPage() {
  const documentsQuery = useDocumentsList()
  const hierarchyQuery = useHierarchy()

  const documents = documentsQuery.data ?? []
  const orgs = hierarchyQuery.data ?? []
  const roleTargets = flattenHierarchyTargets(orgs).filter(
    (t) => t.type === "Role"
  )
  const roleIds = roleTargets.map((t) => t.id)
  const programStatuses = useFullProgramStatuses(roleIds)

  const hasNothing =
    !documentsQuery.isPending &&
    !hierarchyQuery.isPending &&
    documents.length === 0

  const activity = buildActivity(documents, roleTargets, programStatuses.byRole)

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Hero */}
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-blue-subtle/30 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3" />
          Powered by your regulatory documents
        </div>
        <h1 className="font-heading text-4xl font-semibold tracking-tight">
          Welcome to Mimir AI.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          Compliance training, grounded in your policies. Upload regulations,
          map them to roles, and ship LMS-ready courses in minutes.
        </p>
      </header>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Documents"
          icon={FileText}
          isLoading={documentsQuery.isPending}
          value={documents.length}
          hint={documents.length === 1 ? "1 policy ingested" : `${documents.length} policies ingested`}
        />
        <StatTile
          label="Roles configured"
          icon={Building2}
          isLoading={hierarchyQuery.isPending}
          value={roleTargets.length}
          hint={roleTargets.length === 0 ? "Set up your org structure" : "Across your departments"}
        />
        <StatTile
          label="Programs ready"
          icon={Workflow}
          isLoading={programStatuses.isPending && roleIds.length > 0}
          value={programStatuses.readyCount}
          hint={
            programStatuses.generatingCount > 0
              ? `${programStatuses.generatingCount} generating…`
              : programStatuses.readyCount === 0
                ? "Generate from the Training page"
                : "Exportable as SCORM"
          }
        />
      </section>

      {/* Get started CTA if empty */}
      {hasNothing ? (
        <section className="rounded-xl border border-dashed border-border-accent bg-card p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-semibold">
                Start by uploading a policy document.
              </h2>
              <p className="text-sm text-muted-foreground">
                Mimir will parse it, extract requirements, and prepare
                role-specific training outlines you can review and ship.
              </p>
            </div>
            <Button asChild>
              <Link href="/documents">
                Go to Documents
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Recent activity */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Recent activity
            </h2>
            <p className="text-xs text-muted-foreground">
              Last 5 things Mimir worked on.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/documents">
              View all
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        <ActivityFeed
          items={activity}
          isLoading={documentsQuery.isPending || hierarchyQuery.isPending}
          emptyMessage="No activity yet. Upload your first document to see it appear here."
        />
      </section>

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          icon={FileText}
          label="Documents"
          description="Upload PDFs and DOCX, run analysis."
          href="/documents"
        />
        <QuickLink
          icon={Building2}
          label="Organization"
          description="Roles, departments, risk profiles."
          href="/organization"
        />
        <QuickLink
          icon={BookOpen}
          label="Programs"
          description="Generated training, SCORM exports."
          href="/programs"
        />
      </section>
    </div>
  )
}

function QuickLink({
  icon: Icon,
  label,
  description,
  href,
}: {
  icon: typeof FileText
  label: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group/quick relative rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-surface-elevated"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-subtle/40 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover/quick:translate-x-0.5 group-hover/quick:-translate-y-0.5 group-hover/quick:text-primary" />
      </div>
    </Link>
  )
}

function buildActivity(
  documents: { id: string; originalFileName: string; status: string; uploadedAt: string; regulationType: string | null }[],
  roleTargets: { id: string; name: string; path: string }[],
  programByRole: Record<string, { status: string } | null>
): ActivityItem[] {
  const items: ActivityItem[] = []

  // Last 5 uploaded documents
  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5)

  for (const doc of recentDocs) {
    items.push({
      id: `doc-${doc.id}`,
      kind: "document",
      title: doc.originalFileName,
      meta: doc.regulationType ?? "Uploaded",
      status: doc.status,
      timestamp: formatRelative(doc.uploadedAt),
    })
  }

  // Add any program-status updates
  for (const role of roleTargets) {
    const program = programByRole[role.id]
    if (!program) continue
    items.push({
      id: `program-${role.id}`,
      kind: "program",
      title: `${role.name} program`,
      meta: role.path,
      status: program.status,
    })
  }

  return items.slice(0, 5)
}

function formatRelative(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return "just now"
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return date.toLocaleDateString()
}
