"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold">Welcome to Mimir</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Manage compliance documents, build your organization hierarchy, and
          generate role-based training outlines grounded in regulatory sources.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/vault">Documents</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/hierarchy">Hierarchy</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/studio">Studio</Link>
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        API:{" "}
        <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
          {process.env.NEXT_PUBLIC_MIMIR_API_BASE_URL ?? "http://localhost:5003"}
        </code>
      </p>
    </div>
  )
}
