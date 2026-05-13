# Mimir.API — Revised Implementation Plan v2

Updated to align with Vidda Solutions hackathon evaluation criteria.
AMLR 2024/1624 compliance, risk-based role profiling, and demo-ready seed data added.

---

## What's Changed from v1

Phase 1, 2, and 3 are complete and unchanged.
Phase 3.5 is new — AMLR alignment before endpoints are wired.
Phase 4 is updated with two new endpoints (RiskProfile, RoleTraining).
Phase 5 is updated with demo preparation as a dedicated step.

---

## Evaluation Criteria Mapping

| Criterion | Weight | How Mimir Addresses It |
|---|---|---|
| Risk-Role-Competency Link & Explainability | 25% | RiskProfile per role + citation system showing WHY each module was included |
| Regulatory Relevance | 20% | AMLR document uploaded and grounded — every training claim cites a specific article |
| Automation Degree | 15% | Full pipeline: upload → parse → analyze → outline with zero manual steps |
| Proprietary / Unique Elements | 15% | Document vault with three-level inheritance resolution — no other team will have this |
| Ease of Use | 10% | Frontend handles full flow; Swagger available for backend demo |
| LMS Functionality | 10% | Role-based training assignment, outline approval, SCORM export |
| Business Relevance | 5% | Document-grounded generation directly solves the "generic training" problem |

---

## Phase 1 — Data Foundation ✅ COMPLETE

1. AppDbContext + EF Core migrations
2. DocumentRepository
3. OutlineRepository
4. HierarchyRepository
5. DocumentVaultRepository

---

## Phase 2 — Document Pipeline ✅ COMPLETE

6. DocumentService — file upload, validation, storage
7. ParsingService (PDF) — PdfPig integration
8. ParsingService (DOCX) — OpenXml integration
9. CitationService — keyword matching, BuildCitation, MatchClaimToChunk
10. AnalysisService — Gemini integration, prompt injection, JSON parsing, citation mapping
11. DocumentPipeline — orchestrates 7→10 in sequence, error handling

---

## Phase 3 — Hierarchy & Vault ✅ COMPLETE 

12. HierarchyService — CreateOrganizationLevel, CreateDepartment, CreateRole, PublishRole, GetFullHierarchy
13. DocumentVaultService — AssignDocumentToLevel, GetDocumentsForTarget
14. DocumentVaultService.GetResolvedDocumentSetAsync — inheritance resolution

---

## Phase 3.5 — AMLR Alignment ✅ COMPLETE 

This phase adapts the existing architecture to meet the specific Vidda Solutions
evaluation scenario before endpoints are wired.

### 15. Add RiskProfile to Role model 
Add risk exposure fields directly to the Role entity:

```
AmlRisk: string (High, Medium, Low)
SanctionsRisk: string (High, Medium, Low)
FraudRisk: string (High, Medium, Low)
DocumentationRisk: string (High, Medium, Low)
OperationalRisk: string (High, Medium, Low)
```

- Update CreateRoleRequest to accept these fields (all optional, default to "Medium")
- Update RoleResponse to include all risk fields
- Generate and apply a new EF Core migration
- Update HierarchyService.CreateRoleAsync() to persist risk fields
- Update GetFullHierarchyAsync() to include risk fields in the response

**Why this matters:** Risk-Role-Competency Link is 25% of the evaluation score.
Judges need to see that risk exposure drives training depth — not just role name.

### 16. Rewrite Analysis Prompts for AMLR

Rewrite both prompt files to be AMLR-specific:

**Prompts/ExtractRequirements.txt**
- Reference AMLR 2024/1624 as the governing regulation
- Instruct the model to identify which specific AMLR article each requirement comes from
  (Article 9 — internal policies, Article 10 — risk assessment,
  Article 11 — compliance functions, Article 12 — employee awareness/training,
  Article 13 — employee integrity)
- Output must include: requirement text, AMLR article reference, priority
- Priority must reflect the risk level of the role being trained
  (inject role risk profile into the prompt context)

**Prompts/GenerateOutline.txt**
- Generate training modules that explicitly reference AMLR obligations
- Each module must include a "regulatoryBasis" field citing the AMLR article
- Training depth should scale with risk level:
  High risk roles → more modules, deeper content, more quiz questions
  Low risk roles → foundation modules only
- Structure output to follow a progressive learning path:
  Foundation → Application → Deepening → Embedding
  (matching the quarterly wheel structure in the hackathon materials)

**Update AnalysisService:**
- Inject the role's RiskProfile into the prompt context when analyzing
- The prompt must know: role name, risk levels, regulation type
- This allows the AI to calibrate training depth to actual risk exposure

### 17. Add RoleTrainingService (new service)

This service orchestrates generating a training program for a specific role
using the vault's resolved document set.

Interface: IRoleTrainingService
Implementation: RoleTrainingService

Methods:
- GenerateTrainingForRoleAsync(Guid roleId) → TrainingOutlineResponse
  // Load the role with its RiskProfile
  // Call DocumentVaultService.GetResolvedDocumentSetAsync() to get all inherited documents
  // For each document in the resolved set that hasn't been analyzed yet,
  //   trigger DocumentPipeline.RunAsync()
  // Merge all outlines from all resolved documents into one combined outline
  // Pass role context (name, risk profile, regulation type) to AnalysisService
  // Return the combined TrainingOutlineResponse

- GetTrainingStatusAsync(Guid roleId) → string (Pending, Generating, Ready, Failed)
  // Check if a training outline exists and is approved for this role

**Why this matters:** The demo scenario requires auto-generating a training path
per role based on their resolved document set. This service is the bridge between
the vault and the analysis pipeline.

### 18. Seed Data Script

Create a standalone seed data class: Data/SeedData.cs

Pre-load all demo data so the system is presentation-ready on day one.

**Roles to seed (from hackathon role descriptions PDF):**

KYC Analyst
- AmlRisk: High
- SanctionsRisk: High
- FraudRisk: Medium
- DocumentationRisk: High
- OperationalRisk: Medium

AML Investigator / Transaction Monitoring Analyst
- AmlRisk: High
- SanctionsRisk: Medium
- FraudRisk: High
- DocumentationRisk: High
- OperationalRisk: Medium

Compliance Officer / MLRO
- AmlRisk: High
- SanctionsRisk: High
- FraudRisk: High
- DocumentationRisk: High
- OperationalRisk: High

Customer Advisor / Front Office Advisor
- AmlRisk: Medium
- SanctionsRisk: Low
- FraudRisk: Medium
- DocumentationRisk: Medium
- OperationalRisk: Low

**Hierarchy to seed:**
- OrganizationLevel: "Global Compliance" (Geography: "EU")
- Department: "Financial Crime & AML" → linked to Global Compliance
- Department: "Customer Operations" → linked to Global Compliance
- All AML roles → linked to Financial Crime & AML
- Customer Advisor → linked to Customer Operations

**Documents to pre-assign:**
- AMLR_1624.pdf → assign to OrganizationLevel "Global Compliance"
  (all roles inherit it automatically via vault resolution)
- Role description PDFs → assign to specific roles

Call SeedData.InitializeAsync() in Program.cs on startup
(only seeds if database is empty — idempotent)

---

## Phase 4 — Endpoints

Wire real services into endpoints one file at a time.

### 19. DocumentEndpoints ← was step 15

POST /api/documents/upload
GET  /api/documents/{documentId}

### 20. AnalysisEndpoints ← was step 16

POST /api/analysis
GET  /api/analysis/{documentId}/outline
POST /api/analysis/{documentId}/approve

### 21. HierarchyEndpoints ← was step 17

GET  /api/hierarchy
POST /api/hierarchy/organization-levels
POST /api/hierarchy/departments
POST /api/hierarchy/roles
POST /api/hierarchy/roles/{roleId}/publish

**New endpoint added:**
GET  /api/hierarchy/roles/{roleId}/risk-profile
- Return the risk profile for a specific role
- Used by the frontend to display risk scores before generating training

### 22. VaultEndpoints ← was step 18

POST /api/vault/assign
GET  /api/vault/roles/{roleId}/documents
GET  /api/vault/{targetType}/{targetId}/documents

### 23. RoleTrainingEndpoints 🆕 NEW

POST /api/training/roles/{roleId}/generate
- Trigger RoleTrainingService.GenerateTrainingForRoleAsync() as background Task
- Return { roleId, status: "Generating" } with 202 immediately

GET  /api/training/roles/{roleId}/status
- Return current generation status (Pending, Generating, Ready, Failed)
- Frontend polls this after triggering generation

GET  /api/training/roles/{roleId}/outline
- Return the generated TrainingOutlineResponse for this role
- Return 404 if not generated yet
- Return 409 if still generating

POST /api/training/roles/{roleId}/approve
- Mark training as approved for this role
- Return approved outline

GET  /api/training/roles/{roleId}/export/scorm
- Trigger SCORM export for this role's approved training
- Return ZIP file download

---

## Phase 5 — Integration, Hardening & Demo Prep

### 24. End-to-end test ← was step 19

Full pipeline test:
- Upload AMLR_1624.pdf via Swagger
- Upload KYC Analyst role description PDF
- Assign both to KYC Analyst role via vault
- Trigger POST /api/training/roles/{kycAnalystId}/generate
- Poll status until Ready
- GET /api/training/roles/{kycAnalystId}/outline
- Verify: sections present, AMLR article citations visible, risk calibration visible
- Approve and export SCORM

### 25. Error handling pass ← was step 20

Go through every service and verify:
- No raw exception messages returned to the client
- All 404s, 409s, 400s are clean ProblemDetails responses
- Background task failures update document/role status to Failed
- Gemini API failures degrade gracefully with a useful error message

### 26. Prompt refinement ← was step 21

Iterate on ExtractRequirements.txt and GenerateOutline.txt:
- Test with AMLR_1624.pdf and KYC Analyst risk profile
- Verify AMLR article references appear in citations
- Verify training depth scales with High vs Low risk roles
- Compare KYC Analyst output vs Customer Advisor output —
  they should look noticeably different in depth and module count

### 27. Demo preparation 🆕 NEW

This step exists to make sure demo day goes smoothly.

- Verify seed data loads correctly on a clean database
- Run the full demo scenario end-to-end at least twice:
  1. KYC Analyst — High risk, full deep training path
  2. Customer Advisor — Lower risk, foundation-level training
  3. Compliance Officer — Highest risk, broadest coverage
- Prepare a reset script that clears generated outlines but keeps
  seed roles and documents (so you can re-demo without re-seeding)
- Remove all temporary test endpoints (the parse debug endpoint from Step 7)
- Remove all debug-level log statements that expose internal data
- Verify SCORM export opens correctly in a browser as standalone HTML
- Document the 6-step demo flow matching the hackathon evaluation scenario:
  1. Show hierarchy with seeded roles and risk profiles
  2. Show document vault with AMLR assigned at org level
  3. Trigger training generation for KYC Analyst
  4. Show outline with AMLR article citations
  5. Point out how risk profile drove training depth
  6. Export SCORM and open it

---

## Summary of New Items Added

| Item | Why Added |
|---|---|
| RiskProfile on Role | Directly addresses the 25% Risk-Role-Competency criterion |
| AMLR-specific prompts | Directly addresses the 20% Regulatory Relevance criterion |
| RoleTrainingService | Bridges vault resolution with training generation per role |
| Seed data script | Ensures demo starts with real AMLR data — not a blank system |
| RoleTrainingEndpoints | Frontend entry points for the role-based generation flow |
| Demo preparation step | Eliminates last-minute surprises on presentation day |

---

## What We Are NOT Building

Explicitly out of scope to keep the hackathon demo focused:

- Employee accounts or individual learning progress tracking
- Authentication / user login
- Automated regulation change detection
- Multi-language training generation (can be mentioned as roadmap)
- Real LMS integration beyond SCORM export
- Vector similarity search (keyword matching is sufficient for demo)
