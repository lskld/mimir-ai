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
  /** Draft until approved via POST /api/analysis/{id}/approve */
  status?: "Draft" | "Approved" | string
}

export interface RoleTrainingStatusResponse {
  roleId: string
  status: "Pending" | "Generating" | "Ready" | "Failed" | string
  lastUpdated: string | null
  errorMessage?: string | null
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

export type VaultTargetType = "OrganizationLevel" | "Department" | "Role"

export interface RoleResponse {
  id: string
  name: string
  description: string | null
  status: string
  amlRisk: string
  sanctionsRisk: string
  fraudRisk: string
  documentationRisk: string
  operationalRisk: string
  departments: DepartmentResponse[]
}

export interface DepartmentResponse {
  id: string
  name: string
  description: string | null
  organizationLevels: OrganizationLevelResponse[]
  roles: RoleResponse[]
}

export interface OrganizationLevelResponse {
  id: string
  name: string
  description: string | null
  geography: string | null
  createdAt: string
  departments: DepartmentResponse[]
}

export interface CreateOrganizationLevelRequest {
  name: string
  description?: string
  geography?: string
}

export interface CreateDepartmentRequest {
  name: string
  description?: string
  organizationLevelIds: string[]
}

export interface CreateRoleRequest {
  name: string
  description?: string
  departmentIds: string[]
  amlRisk?: string
  sanctionsRisk?: string
  fraudRisk?: string
  documentationRisk?: string
  operationalRisk?: string
}

export interface ResolvedDocumentResponse {
  documentId: string
  fileName: string
  inheritedFrom: string
  inheritedFromName: string
  targetType: string
}

export interface ResolvedDocumentSetResponse {
  roleId: string
  roleName: string
  documents: ResolvedDocumentResponse[]
}

export interface AssignDocumentRequest {
  documentId: string
  targetType: VaultTargetType
  targetId: string
}

export interface VaultTarget {
  type: VaultTargetType
  id: string
  name: string
  path: string
}

export interface VaultCatalogAssignment {
  targetType: VaultTargetType
  targetId: string
  targetPath: string
}

export interface VaultCatalogDocument {
  documentId: string
  fileName: string
  assignments: VaultCatalogAssignment[]
}

export interface FullProgramStatusResponse {
  status: "Generating" | "Ready" | "Failed" | string
  roleId: string
  errorMessage: string | null
}

export interface QuizQuestionResponse {
  text: string
  options: Record<"A" | "B" | "C" | "D", string>
  correctAnswer: string
  explanation: string
}

export interface LessonObjectiveResponse {
  objective: string
  lessonContent: string
  quizQuestions: QuizQuestionResponse[]
}

export interface ScenarioResponse {
  title: string
  description: string
  complication: string
  discussionQuestions: string[]
}

export interface FullTrainingModuleResponse {
  moduleTitle: string
  amlrArticle: string | null
  description: string | null
  objectives: LessonObjectiveResponse[]
  scenarios: ScenarioResponse[]
}

export interface FullTrainingProgramResponse {
  roleId: string
  roleName: string
  regulationType: string
  riskProfile: Record<string, string> | null
  generatedAt: string
  modules: FullTrainingModuleResponse[]
}
