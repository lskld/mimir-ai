/** Mirrors Mimir.API.Models.Responses — JSON uses camelCase from ASP.NET Core. */

export interface DocumentResponse {
  id: string
  originalFileName: string
  status: "Pending" | "Parsed" | "Analyzed" | "Failed" | string
  regulationType: string | null
  uploadedAt: string
}

export interface RegulatoryBasisResponse {
  amlrArticle: string
  articleTitle: string
}

export interface CitationResponse {
  text: string
  sourceDocument: string
  pageNumber: number
  section: string
  chunkId: string
}

export interface OutlineSectionResponse {
  title: string
  description: string
  learningObjectives: string[]
  regulatoryBasis: RegulatoryBasisResponse | null
  citations: CitationResponse[]
}

export interface TrainingOutlineResponse {
  documentId: string
  regulationType: string
  roleName?: string | null
  riskProfile?: Record<string, string> | null
  sections: OutlineSectionResponse[]
  generatedAt: string
}

export interface AnalyzeDocumentRequest {
  documentId: string
  regulationType: string
}

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  traceId?: string
}
