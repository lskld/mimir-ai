# Mimir AI

A compliance training platform that ingests regulatory documents (PDF/DOCX), extracts requirements using an LLM, and generates role-tailored training programs exportable as SCORM 1.2 packages for any standards-compliant LMS.

## Overview

Mimir AI automates the full lifecycle from raw regulation to deployable e-learning:

1. **Document ingestion** — upload PDF or DOCX regulatory documents; the pipeline parses them into chunks and runs LLM analysis to produce a generic training outline.
2. **Role outline** — the generic outline is customized to a specific role's risk profile and merged across all documents the role inherits via the organizational vault hierarchy.
3. **Full training program** — each learning objective becomes a lesson, a multiple-choice quiz, and role-specific scenario content. The complete program exports as a self-contained SCORM 1.2 ZIP.

## Stack

| Layer | Technology |
|---|---|
| Backend API | .NET 10 Minimal API, SQLite (EF Core) |
| LLM | OpenRouter → `google/gemini-2.5-flash-lite` |
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| SCORM export | In-memory ZIP via `System.IO.Compression` (no external library) |

## Prerequisites

- .NET 10 SDK
- Node.js 20+
- An [OpenRouter](https://openrouter.ai) API key

## Getting Started

### Backend

```bash
# From repo root
dotnet build

# Set your OpenRouter API key (stored in user secrets, never committed)
dotnet user-secrets set "OpenRouter:ApiKey" "<your-key>" --project Mimir.API

# Start the API (listens on http://localhost:5003)
dotnet run --project Mimir.API
```

The SQLite database (`Mimir.API/mimir.db`) is created automatically on first run. To reset the database, delete `mimir.db` and restart.

On every startup, seed data is applied idempotently: one org level, two departments, four roles with risk profiles. If a seed document exists at `Uploads/seed-documents/AMLR_1624.pdf` (relative to the binary output directory), it is also seeded with a fixed ID.

### Frontend

```bash
cd mimir.frontend
npm install
npm run dev   # http://localhost:3000
```

## Configuration

`Mimir.API/appsettings.json` controls the LLM target:

```json
"OpenRouter": {
  "ApiKey": "",
  "Model": "google/gemini-2.5-flash-lite",
  "BaseUrl": "https://openrouter.ai/api/v1"
}
```

Leave `ApiKey` empty in the file and set it via user secrets or the environment variable `OpenRouter__ApiKey`. The API validates the key at startup and throws if it is missing.

## API Reference

All endpoints are under `http://localhost:5003/api`.

### Documents

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/documents` | Upload a PDF or DOCX document |
| `GET` | `/api/documents` | List all documents |
| `GET` | `/api/documents/{id}` | Get a document by ID |
| `DELETE` | `/api/documents/{id}` | Delete a document |

### Analysis (Step 1)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/analysis` | Trigger document parsing + outline extraction (async, returns 202) |
| `GET` | `/api/analysis/{documentId}/status` | Poll analysis status (`Pending / Parsed / Analyzed / Failed`) |

### Org Hierarchy

| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/organization-levels` | List or create org levels |
| `GET/PUT/DELETE` | `/api/organization-levels/{id}` | Manage a specific org level |
| `GET/POST` | `/api/departments` | List or create departments |
| `GET/PUT/DELETE` | `/api/departments/{id}` | Manage a specific department |
| `GET/POST` | `/api/roles` | List or create roles |
| `GET/PUT/DELETE` | `/api/roles/{id}` | Manage a specific role |
| `POST` | `/api/roles/{id}/publish` | Publish a draft role |

### Document Vault

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/vault/assignments` | Assign a document to an org level, department, or role |
| `GET` | `/api/vault/assignments` | List assignments (filterable by target) |
| `DELETE` | `/api/vault/assignments/{id}` | Remove an assignment |
| `GET` | `/api/vault/roles/{roleId}/resolved` | View the full resolved document set for a role |

### Training — Role Outline (Step 2)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/training/roles/{roleId}/generate` | Generate a role outline (async, returns 202) |
| `GET` | `/api/training/roles/{roleId}/outline/status` | Poll generation status |
| `GET` | `/api/training/roles/{roleId}/outline` | Fetch the generated outline |
| `POST` | `/api/training/roles/{roleId}/approve` | Approve the outline (required before Step 3) |

### Training — Full Program (Step 3)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/training/roles/{roleId}/full-program/generate` | Generate the full program (async, returns 202) |
| `GET` | `/api/training/roles/{roleId}/full-program/status` | Poll generation status |
| `GET` | `/api/training/roles/{roleId}/full-program` | Fetch the completed program |
| `GET` | `/api/training/roles/{roleId}/full-program/export/scorm` | Download as SCORM 1.2 ZIP |

## Training Pipeline Detail

### Step 1 — Document Analysis

`POST /api/analysis` triggers a background task: the document is parsed into chunks, requirements are extracted via LLM, and a `TrainingOutline` is stored as JSON. The pipeline uses a static lock to prevent duplicate concurrent runs per document.

### Step 2 — Role Outline Generation

`POST /api/training/roles/{roleId}/generate` runs in the background and:
1. Resolves the role's document set from the vault (role > department > org level precedence)
2. For each document, ensures a generic outline exists (runs Step 1 if needed)
3. Calls the LLM once per document to customize the outline to the role's risk profile
4. Merges and deduplicates all customized outlines into a single `RoleTrainingOutline`

An empty vault completes successfully with an empty sections array.

### Step 3 — Full Program Generation

Requires an **Approved** role outline. `POST /api/training/roles/{roleId}/full-program/generate` generates, per learning objective:
- A 2–3 paragraph lesson (plain text)
- 3–5 multiple-choice quiz questions (JSON)
- Role-specific case study scenarios (JSON, once per section)

A typical AMLR-scale program triggers ~50 LLM calls and takes 2–5 minutes.

### SCORM Export

`GET /api/training/roles/{roleId}/full-program/export/scorm` returns a ZIP built entirely in memory:

```
training-course-{role}.zip
├── imsmanifest.xml          SCORM 1.2 manifest
├── content/module_N.html    Self-contained HTML modules (inline CSS + quiz JS)
└── data/quiz_data.json      Flat question list for LMS integration
```

Each HTML module is self-contained — no `fetch()` calls — so the export works both inside an LMS and opened directly from the filesystem.

## Project Structure

```
mimir-ai/
├── Mimir.API/                      .NET 10 backend
│   ├── Program.cs                  DI, middleware, endpoint mapping, startup validation
│   ├── Data/
│   │   ├── AppDbContext.cs         EF Core context
│   │   ├── SeedData.cs             Idempotent seed data
│   │   └── Repositories/           One repository per aggregate
│   ├── Endpoints/                  One static class per resource group
│   ├── Services/                   Business logic (LLM, parsing, vault, training)
│   ├── Pipeline/DocumentPipeline.cs  Step 1 orchestrator
│   ├── Middleware/                 Exception → HTTP status mapping
│   ├── Models/                     Domain entities, request/response DTOs
│   └── Prompts/                    Five .txt prompt files (copy-to-output)
└── mimir.frontend/                 Next.js 16 frontend
    ├── app/                        App router pages
    └── components/                 Shared UI components (shadcn/ui)
```

## Error Handling

All unhandled exceptions are mapped to HTTP status codes by `ExceptionHandlingMiddleware`:

| Exception | Status |
|---|---|
| `KeyNotFoundException` | 404 Not Found |
| `ArgumentException` | 400 Bad Request |
| `InvalidOperationException` | 409 Conflict |
| Anything else | 500 Internal Server Error |

Error responses use a uniform JSON shape: `{ status, title, detail, instance }`.
