"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  formatInheritedFrom,
  formatTargetType,
} from "@/lib/api/vault-utils"
import type { ResolvedDocumentResponse } from "@/lib/api/types"

type VaultDocumentsTableProps = {
  documents: ResolvedDocumentResponse[]
  emptyMessage: string
  showInheritance?: boolean
}

export function VaultDocumentsTable({
  documents,
  emptyMessage,
  showInheritance = false,
}: VaultDocumentsTableProps) {
  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed border-border px-4 py-8 text-center text-sm">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="px-3 py-2 font-medium">Document</th>
            {showInheritance ? (
              <>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Assigned at</th>
              </>
            ) : (
              <th className="px-3 py-2 font-medium">Assigned here</th>
            )}
            <th className="px-3 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr
              key={`${doc.documentId}-${doc.inheritedFrom}-${doc.inheritedFromName}`}
              className="border-b border-border last:border-0"
            >
              <td className="px-3 py-2">
                <span className="font-medium">{doc.fileName}</span>
                <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                  {doc.documentId}
                </p>
              </td>
              {showInheritance ? (
                <>
                  <td className="text-muted-foreground px-3 py-2">
                    {formatInheritedFrom(doc.inheritedFrom)}
                  </td>
                  <td className="px-3 py-2">{doc.inheritedFromName}</td>
                </>
              ) : (
                <td className="text-muted-foreground px-3 py-2">
                  {formatTargetType(doc.targetType)}
                </td>
              )}
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
