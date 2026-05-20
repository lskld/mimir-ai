"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatTargetType } from "@/lib/api/vault-utils"
import type { VaultCatalogDocument } from "@/lib/api/types"

type VaultCatalogTableProps = {
  documents: VaultCatalogDocument[]
  emptyMessage: string
}

export function VaultCatalogTable({
  documents,
  emptyMessage,
}: VaultCatalogTableProps) {
  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed border-border px-4 py-8 text-center text-sm">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="px-3 py-2 font-medium">Document</th>
            <th className="px-3 py-2 font-medium">Assigned to</th>
            <th className="px-3 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.documentId} className="border-b border-border last:border-0">
              <td className="px-3 py-2">
                <span className="font-medium">{doc.fileName}</span>
                <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                  {doc.documentId}
                </p>
              </td>
              <td className="px-3 py-2">
                <ul className="space-y-1">
                  {doc.assignments.map((a) => (
                    <li
                      key={`${a.targetType}-${a.targetId}`}
                      className="text-muted-foreground text-xs"
                    >
                      <span className="text-foreground">
                        {formatTargetType(a.targetType)}
                      </span>
                      {" · "}
                      {a.targetPath}
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-3 py-2 text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/studio/${doc.documentId}`}>
                    Studio
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
