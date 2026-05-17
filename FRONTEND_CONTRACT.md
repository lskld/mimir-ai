# FRONTEND_CONTRACT.md

This document is the complete API reference for the Mimir backend. It is written for a Next.js developer and contains every request shape, response shape, and error code you need to build the frontend. No backend knowledge is required.

---

## 1. Overview

Mimir is a compliance training platform grounded in regulatory documents (PDF or DOCX). It automates the complete pipeline: upload → parse → analyze → generate role-based training outlines. All training recommendations are cited to specific regulatory articles, and training depth is calibrated to each role's risk profile.

**Use case**: A bank uploads the AMLR 2024/1624 anti-money laundering regulation and role-specific risk assessments. Mimir automatically generates a KYC Analyst training plan that covers high-risk topics in depth, and a Customer Advisor plan that covers foundation-level topics only — both grounded in AMLR articles.

**Base URL (local development)**
```
http://localhost:5003
```

**Running the backend locally**
You need the .NET 10 SDK installed. Clone the repo, open a terminal in the project root, and run `dotnet run --project Mimir.API`. The server starts at `http://localhost:5003`. The backend uses [OpenRouter](https://openrouter.ai) as its LLM provider (currently routing to `google/gemini-2.5-flash-lite`) — set the API key with `dotnet user-secrets set "OpenRouter:ApiKey" "<your-key>" --project Mimir.API` before any AI endpoints will work. The server throws on startup if the key is missing.

**General notes**
- All request and response bodies are JSON unless the endpoint uses file upload (see §2).
- All timestamps are UTC in ISO 8601 format: `"2025-11-03T14:32:00Z"`.
- All IDs are UUIDs represented as strings: `"3fa85f64-5717-4562-b3fc-2c963f66afa6"`.
- Set the `Content-Type: application/json` header on all JSON requests.

---

## 2. General Conventions

### Error Format

A global exception-handling middleware maps the three domain exception types to HTTP status codes and returns a uniform JSON body for all `4xx` and `5xx` responses:

```json
{
  "status": 404,
  "title": "Not Found",
  "detail": "Role 33333333-3333-3333-3333-333333333333 not found",
  "instance": "/api/training/roles/33333333-3333-3333-3333-333333333333/full-program/status"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `status` | number | The HTTP status code (mirrors the response status line) |
| `title` | string | Short label: `"Not Found"`, `"Bad Request"`, `"Conflict"`, `"Internal Server Error"` |
| `detail` | string | Human-readable description; safe to surface in dev tooling, do not show raw to end users |
| `instance` | string | The request path that produced the error |

A few endpoints (`GET /api/training/roles/{roleId}/outline`, `POST /api/training/roles/{roleId}/approve`, `GET /api/training/roles/{roleId}/full-program`) return their `409 Conflict` responses with a small ad-hoc body shape:

```json
{ "message": "Program generation still in progress." }
```

For these, treat the `message` field as the human-readable explanation. The HTTP status code is always the authoritative signal — branch on the status first, then read the body for context.

For simple validation errors on a few legacy endpoints (e.g. `POST /api/analysis` with a missing field), the response body is a plain string:
```
"DocumentId and RegulationType are required."
```

### HTTP Status Codes

| Code | When it happens |
|------|----------------|
| `200 OK` | Request succeeded, body contains the result |
| `201 Created` | Resource created, `Location` header points to new resource |
| `202 Accepted` | Background job started, poll the URL in the `Location` header |
| `400 Bad Request` | Invalid input — missing required field, wrong type, unsupported value |
| `404 Not Found` | Requested resource does not exist |
| `409 Conflict` | Operation is not allowed given current state (duplicate assignment, role has no departments, etc.) |
| `500 Internal Server Error` | Unexpected server error |

### File Uploads

File upload endpoints use `multipart/form-data`, not JSON. In a browser/Next.js:

```js
const formData = new FormData();
formData.append("file", fileObject); // fileObject is a File from an <input type="file">

const response = await fetch(
  "http://localhost:5003/api/documents/upload?regulationType=GDPR",
  {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type manually — the browser sets it with the correct boundary
  }
);
```

Note that `regulationType` is passed as a **URL query parameter**, not inside the form data.

### Background Jobs — The 202 / Poll Pattern

Some operations take several seconds because they call an AI service. These endpoints return `202 Accepted` immediately with a `documentId`, then do the work in the background. The frontend must poll a status endpoint until processing is complete.

**Flow:**
1. Frontend calls the trigger endpoint → gets back `202` with `{ "documentId": "..." }`
2. Frontend polls `GET /api/analysis/{documentId}/outline` every **2 seconds**
3. When the outline exists, the endpoint returns `200` with the full outline — polling stops
4. If the document's `status` field becomes `"Failed"`, show an error and stop polling

---

## 3. Document Endpoints

### `POST /api/documents/upload`

Uploads a compliance document (PDF or DOCX) and registers it in the system. The file is stored on the server; processing does not start automatically — you must trigger analysis separately.

**Request** — `multipart/form-data`

| Field | Where | Type | Required | Notes |
|-------|-------|------|----------|-------|
| `file` | form body | File | Yes | Must be `.pdf` or `.docx`, max 20 MB |
| `regulationType` | query param | string | No | Free-text label, e.g. `"GDPR"`, `"SOX"` |

```js
// Example
const formData = new FormData();
formData.append("file", file);
fetch("http://localhost:5003/api/documents/upload?regulationType=GDPR", {
  method: "POST",
  body: formData,
});
```

**Response — `201 Created`**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "originalFileName": "gdpr-policy-2024.pdf",
  "status": "Pending",
  "regulationType": "GDPR",
  "uploadedAt": "2025-11-03T14:32:00Z"
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | No file attached to the request |
| `400` | File type is not `.pdf` or `.docx` |
| `400` | File exceeds 20 MB |

---

### `GET /api/documents/{documentId}`

Retrieves current metadata and processing status for a previously uploaded document.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `documentId` | UUID | The `id` returned from the upload endpoint |

**Response — `200 OK`**

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "originalFileName": "gdpr-policy-2024.pdf",
  "status": "Analyzed",
  "regulationType": "GDPR",
  "uploadedAt": "2025-11-03T14:32:00Z"
}
```

**`status` values**

| Value | Meaning |
|-------|---------|
| `"Pending"` | File uploaded, not yet processed |
| `"Parsed"` | Text has been extracted from the file |
| `"Analyzed"` | AI analysis complete, training outline is ready |
| `"Failed"` | Processing encountered an error |

**Errors**

| Status | When |
|--------|------|
| `404` | No document with that ID exists |

---

## 4. Analysis Pipeline Endpoints

### `POST /api/analysis`

Triggers the AI analysis pipeline for an uploaded document. This endpoint returns immediately — the actual work (reading the document, calling the AI service, building the outline) happens in the background.

**Request body** — `application/json`

```json
{
  "documentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "regulationType": "GDPR"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `documentId` | UUID | Yes | Must be a valid uploaded document |
| `regulationType` | string | Yes | The regulation type to focus analysis on |

**Response — `202 Accepted`**

The body contains the document ID so you know what to poll. The `Location` response header also points directly to the outline endpoint.

```json
{
  "documentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

**Polling pattern — what to do after receiving 202:**

```js
const POLL_INTERVAL_MS = 2000;

async function pollForOutline(documentId) {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    const res = await fetch(
      `http://localhost:5003/api/analysis/${documentId}/outline`
    );

    if (res.status === 200) {
      const outline = await res.json();
      return outline; // Done!
    }

    if (res.status === 404) {
      // Still processing — outline not created yet, keep polling
      continue;
    }

    // Check document status for failure
    const docRes = await fetch(
      `http://localhost:5003/api/documents/${documentId}`
    );
    const doc = await docRes.json();
    if (doc.status === "Failed") {
      throw new Error("Document analysis failed");
    }
  }
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | `documentId` is missing/empty or `regulationType` is missing |

---

### `GET /api/analysis/{documentId}/outline`

Returns the AI-generated training outline for a document. Returns `404` while the outline is still being generated — this is normal and expected during polling.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `documentId` | UUID | The document ID from the upload step |

**Response — `200 OK`**

```json
{
  "documentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "regulationType": "GDPR",
  "generatedAt": "2025-11-03T14:35:22Z",
  "sections": [
    {
      "title": "Lawful Basis for Data Processing",
      "description": "Covers the six legal grounds under Article 6 that permit processing of personal data.",
      "learningObjectives": [
        "Identify the six lawful bases for processing personal data under GDPR Article 6",
        "Determine which lawful basis applies to common business processing activities",
        "Recognize when consent is and is not an appropriate basis"
      ],
      "citations": [
        {
          "text": "Processing shall be lawful only if and to the extent that at least one of the following applies: the data subject has given consent to the processing of his or her personal data.",
          "sourceDocument": "gdpr-policy-2024.pdf",
          "pageNumber": 12,
          "section": "Article 6 – Lawfulness of Processing",
          "chunkId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        }
      ]
    },
    {
      "title": "Data Subject Rights",
      "description": "Overview of individual rights under GDPR including access, rectification, and erasure.",
      "learningObjectives": [
        "List all eight data subject rights granted by GDPR",
        "Explain the process and deadlines for responding to a Subject Access Request"
      ],
      "citations": [
        {
          "text": "The data subject shall have the right to obtain from the controller confirmation as to whether or not personal data concerning him or her are being processed.",
          "sourceDocument": "gdpr-policy-2024.pdf",
          "pageNumber": 45,
          "section": "Article 15 – Right of Access",
          "chunkId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
        }
      ]
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| `404` | Outline not yet created (pipeline still running) or document does not exist |

---

### `POST /api/analysis/{documentId}/approve`

Marks a training outline as approved, indicating it is ready to be used for training. No request body is needed.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `documentId` | UUID | The document whose outline to approve |

**Request body** — none

**Response — `200 OK`**

Returns the updated outline (same shape as the `GET /outline` response above), with any status-level change reflected.

**Errors**

| Status | When |
|--------|------|
| `404` | No outline found for that document ID |

---

## 5. Hierarchy Management Endpoints

The hierarchy has three levels: **Organization Level → Department → Role**. Build this tree first before assigning documents or users to roles.

### `GET /api/hierarchy`

Returns the complete organizational hierarchy as a nested tree. This is the primary data source for the folder-tree navigation in the UI.

**Response — `200 OK`**

```json
[
  {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "EMEA Region",
    "description": "European, Middle East, and Africa operations",
    "geography": "Europe",
    "createdAt": "2025-10-01T09:00:00Z",
    "departments": [
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Finance",
        "description": "Financial operations and reporting",
        "organizationLevels": [
          {
            "id": "11111111-1111-1111-1111-111111111111",
            "name": "EMEA Region",
            "description": "European, Middle East, and Africa operations",
            "geography": "Europe",
            "createdAt": "2025-10-01T09:00:00Z"
          }
        ],
        "roles": [
          {
            "id": "33333333-3333-3333-3333-333333333333",
            "name": "Financial Analyst",
            "description": "Analysts responsible for financial modelling",
            "status": "Published",
            "departments": [
              {
                "id": "22222222-2222-2222-2222-222222222222",
                "name": "Finance",
                "description": null,
                "organizationLevels": []
              }
            ]
          }
        ]
      }
    ]
  }
]
```

> **Note:** The top-level array is a list of Organization Levels. Each org level contains its departments; each department contains its roles. The `organizationLevels` and `departments` back-references inside nested objects are included for convenience but may be omitted by the frontend when rendering the tree.

---

### `POST /api/hierarchy/organization-levels`

Creates a new top-level organizational unit (a company, region, business unit, etc.).

**Request body** — `application/json`

```json
{
  "name": "EMEA Region",
  "description": "European, Middle East, and Africa operations",
  "geography": "Europe"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Display name |
| `description` | string | No | Optional longer description |
| `geography` | string | No | Optional geographic label |

**Response — `201 Created`**

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "name": "EMEA Region",
  "description": "European, Middle East, and Africa operations",
  "geography": "Europe",
  "createdAt": "2025-11-03T14:00:00Z"
}
```

---

### `POST /api/hierarchy/departments`

Creates a new department and links it to one or more existing organization levels.

**Request body** — `application/json`

```json
{
  "name": "Finance",
  "description": "Financial operations and reporting",
  "organizationLevelIds": [
    "11111111-1111-1111-1111-111111111111"
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Display name |
| `description` | string | No | Optional description |
| `organizationLevelIds` | array of UUIDs | No | IDs of org levels this department belongs to; can be empty |

**Response — `201 Created`**

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "Finance",
  "description": "Financial operations and reporting",
  "organizationLevels": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "EMEA Region",
      "description": "European, Middle East, and Africa operations",
      "geography": "Europe",
      "createdAt": "2025-10-01T09:00:00Z"
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Any ID in `organizationLevelIds` does not exist |

---

### `POST /api/hierarchy/roles`

Creates a new role in `Draft` status and links it to one or more departments. Optionally assigns risk levels (defaults to "Medium" for all risks if omitted). A role must be published before documents can be assigned to it. Training will be calibrated to the role's risk profile.

**Request body** — `application/json`

```json
{
  "name": "Financial Analyst",
  "description": "Analysts responsible for financial modelling",
  "departmentIds": [
    "22222222-2222-2222-2222-222222222222"
  ],
  "amlRisk": "High",
  "sanctionsRisk": "High",
  "fraudRisk": "Medium",
  "documentationRisk": "High",
  "operationalRisk": "Medium"
}
```

| Field | Type | Required | Valid values | Notes |
|-------|------|----------|-------------|-------|
| `name` | string | Yes | | Display name |
| `description` | string | No | | Optional description |
| `departmentIds` | array of UUIDs | No | | IDs of departments this role belongs to; can be empty (but role cannot be published until it has at least one) |
| `amlRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Defaults to `"Medium"` |
| `sanctionsRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Defaults to `"Medium"` |
| `fraudRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Defaults to `"Medium"` |
| `documentationRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Defaults to `"Medium"` |
| `operationalRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Defaults to `"Medium"` |

**Response — `201 Created`**

```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "name": "Financial Analyst",
  "description": "Analysts responsible for financial modelling",
  "status": "Draft",
  "amlRisk": "High",
  "sanctionsRisk": "High",
  "fraudRisk": "Medium",
  "documentationRisk": "High",
  "operationalRisk": "Medium",
  "departments": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Finance",
      "description": "Financial operations and reporting",
      "organizationLevels": []
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Any ID in `departmentIds` does not exist |

---

### `POST /api/hierarchy/roles/{roleId}/publish`

Transitions a role from `Draft` to `Published`. A role must have at least one linked department before it can be published. Published roles are visible to employees and can receive document assignments.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the draft role to publish |

**Request body** — none

**Response — `200 OK`**

Same shape as the create role response, with `"status": "Published"`.

```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "name": "Financial Analyst",
  "description": "Analysts responsible for financial modelling",
  "status": "Published",
  "amlRisk": "High",
  "sanctionsRisk": "High",
  "fraudRisk": "Medium",
  "documentationRisk": "High",
  "operationalRisk": "Medium",
  "departments": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Finance",
      "description": null,
      "organizationLevels": []
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |
| `409` | Role has no linked departments — add at least one department before publishing |

---

### `GET /api/hierarchy/roles/{roleId}/risk-profile`

Retrieves the risk exposure profile for a specific role. This endpoint is used by the frontend to display risk scores before triggering role-based training generation.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the published role |

**Response — `200 OK`**

```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "name": "Financial Analyst",
  "amlRisk": "High",
  "sanctionsRisk": "High",
  "fraudRisk": "Medium",
  "documentationRisk": "High",
  "operationalRisk": "Medium"
}
```

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |

---

## 6. Document Vault Endpoints

The vault manages which documents are assigned to which parts of the hierarchy. Documents can be assigned at any of the three hierarchy levels.

### `POST /api/vault/assign`

Assigns a document to an organization level, department, or role. Employees who belong to that node (or any child node) will then see this document in their training queue.

**Request body** — `application/json`

```json
{
  "documentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "targetType": "Department",
  "targetId": "22222222-2222-2222-2222-222222222222"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `documentId` | UUID | Yes | Must be a valid uploaded document |
| `targetType` | string | Yes | Exactly one of: `"OrganizationLevel"`, `"Department"`, `"Role"` (case-insensitive) |
| `targetId` | UUID | Yes | The ID of the org level / department / role to assign to |

**Response — `200 OK`** — empty body

**Errors**

| Status | When |
|--------|------|
| `400` | `targetType` is not one of the three valid values |
| `404` | Document or target hierarchy node does not exist |
| `409` | This document is already assigned to this exact target |

---

### `GET /api/vault/roles/{roleId}/documents`

Returns the **complete resolved document set** for a role — this includes documents assigned directly to the role *plus* all documents inherited from its parent departments and organization levels. Duplicate documents are deduplicated, with the most specific assignment winning (Role overrides Department overrides Organization Level).

This is the primary endpoint for building a user's training queue.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the published role |

**Response — `200 OK`**

```json
{
  "roleId": "33333333-3333-3333-3333-333333333333",
  "roleName": "Financial Analyst",
  "documents": [
    {
      "documentId": "aaaa0000-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "fileName": "company-wide-code-of-conduct.pdf",
      "inheritedFrom": "OrganizationLevel",
      "inheritedFromName": "EMEA Region",
      "targetType": "OrganizationLevel"
    },
    {
      "documentId": "bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "fileName": "finance-sox-compliance.pdf",
      "inheritedFrom": "Department",
      "inheritedFromName": "Finance",
      "targetType": "Department"
    },
    {
      "documentId": "cccc0000-cccc-cccc-cccc-cccccccccccc",
      "fileName": "analyst-trading-policy.pdf",
      "inheritedFrom": "Role",
      "inheritedFromName": "Financial Analyst",
      "targetType": "Role"
    }
  ]
}
```

**Understanding `inheritedFrom`:**
- `"OrganizationLevel"` — document was assigned to the whole org (e.g. company-wide policy); this role gets it because it belongs to a department in that org
- `"Department"` — document was assigned to the department this role belongs to; the role inherits it
- `"Role"` — document was assigned directly to this role

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |

---

### `GET /api/vault/{targetType}/{targetId}/documents`

Returns only the **directly assigned** documents for a single hierarchy node (org level, department, or role). Unlike the `roles/{roleId}/documents` endpoint, this does not walk up the hierarchy — it only shows what was explicitly assigned to this one node.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `targetType` | string | One of: `OrganizationLevel`, `Department`, `Role` (case-insensitive) |
| `targetId` | UUID | The ID of the specific node |

**Response — `200 OK`** — array of document entries

```json
[
  {
    "documentId": "bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "fileName": "finance-sox-compliance.pdf",
    "inheritedFrom": "Department",
    "inheritedFromName": "Finance",
    "targetType": "Department"
  }
]
```

Returns an empty array `[]` if no documents are directly assigned to this node.

**Errors**

| Status | When |
|--------|------|
| `400` | `targetType` is not one of the three valid values |

---

## 7. Role-Based Training Generation Endpoints

These endpoints orchestrate generating a risk-calibrated training program for a specific role based on its resolved document set and risk profile.

### `POST /api/training/roles/{roleId}/generate`

Triggers the training generation pipeline for a role. The pipeline loads the role's risk profile, collects all inherited documents via the vault, analyzes each document (if not already analyzed), and generates a combined training outline. This endpoint returns immediately with a `202 Accepted` response — the actual work happens in the background.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the published role |

**Request body** — none

**Response — `202 Accepted`**

```json
{
  "roleId": "33333333-3333-3333-3333-333333333333",
  "status": "Generating",
  "message": "Training generation started. Poll /api/training/roles/{roleId}/status for updates."
}
```

The `Location` response header also points to the status endpoint.

**Polling pattern — what to do after receiving 202:**

```js
const POLL_INTERVAL_MS = 2000;

async function pollForTraining(roleId) {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    const res = await fetch(
      `http://localhost:5003/api/training/roles/${roleId}/status`
    );

    const status = await res.json();

    if (status.status === "Ready") {
      // Get the generated outline
      const outlineRes = await fetch(
        `http://localhost:5003/api/training/roles/${roleId}/outline`
      );
      const outline = await outlineRes.json();
      return outline; // Done!
    }

    if (status.status === "Failed") {
      throw new Error(status.errorMessage ?? "Training generation failed");
    }

    // status === "Generating" or "Pending" — keep polling
  }
}
```

**Empty vault note:** If the role has no inherited documents at all, the pipeline still completes successfully — the resulting outline just has an empty `sections` array. There is no 409 for "vault is empty". The UI should detect `sections.length === 0` and render a friendly "Assign documents to this role before viewing training" state.

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |

---

### `GET /api/training/roles/{roleId}/status`

Returns the current generation status for a role's training outline. Use this endpoint to poll during the background generation job.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the role |

**Response — `200 OK`** — success

```json
{
  "roleId": "33333333-3333-3333-3333-333333333333",
  "status": "Ready",
  "lastUpdated": "2025-11-03T14:35:22Z"
}
```

**Response — `200 OK`** — failure (extra `errorMessage` field)

```json
{
  "roleId": "33333333-3333-3333-3333-333333333333",
  "status": "Failed",
  "lastUpdated": "2025-11-03T14:34:01Z",
  "errorMessage": "LLM response was truncated at 4000 tokens (finish_reason=length). Increase max_tokens or shorten the input."
}
```

**Response — `200 OK`** — never triggered (no record yet)

```json
{
  "roleId": "33333333-3333-3333-3333-333333333333",
  "status": "Pending",
  "lastUpdated": null
}
```

**`status` values**

| Value | Meaning |
|-------|---------|
| `"Pending"` | Training not yet triggered for this role |
| `"Generating"` | Pipeline is running — outline is not ready yet |
| `"Ready"` | Outline is ready (covers both `Draft` and `Approved` underlying states); call `GET /outline` to fetch it |
| `"Failed"` | Pipeline encountered an error; `errorMessage` field is populated |

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |

---

### `GET /api/training/roles/{roleId}/outline`

Returns the role-specific training outline generated from all inherited documents. The outline is risk-calibrated based on the role's risk profile — high-risk roles receive deeper, more comprehensive training; low-risk roles receive foundation-level modules only.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the published role |

**Response — `200 OK`**

```json
{
  "documentId": "00000000-0000-0000-0000-000000000000",
  "regulationType": "AMLR 2024/1624",
  "roleName": "Financial Analyst",
  "riskProfile": {
    "AmlRisk": "High",
    "SanctionsRisk": "High",
    "FraudRisk": "Medium",
    "DocumentationRisk": "High",
    "OperationalRisk": "Medium"
  },
  "generatedAt": "2025-11-03T14:35:22Z",
  "sections": [
    {
      "title": "AML Regulatory Foundations",
      "description": "Deep dive into AMLR obligations and risk assessment requirements.",
      "learningObjectives": [
        "Understand AMLR 2024/1624 Articles 9–13 governance requirements",
        "Apply risk-based AML controls to customer profiles",
        "Document compliance findings with regulatory citations"
      ],
      "regulatoryBasis": {
        "amlrArticle": "10",
        "articleTitle": "Risk Assessment"
      },
      "citations": [
        {
          "text": "Financial institutions shall conduct a risk assessment to identify, assess, and understand the money laundering and terrorist financing risks.",
          "sourceDocument": "AMLR_1624.pdf",
          "pageNumber": 8,
          "section": "Article 10 – Risk Assessment",
          "chunkId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        }
      ]
    }
  ]
}
```

> **Note:** `documentId` is `00000000-0000-0000-0000-000000000000` (the empty UUID) for merged role outlines — this outline is synthesized from several source documents, not tied to a single one. Identify the role by the `roleName` field instead. Approval state is *not* on this body; query the `/status` endpoint (status `"Ready"` covers both `Draft` and `Approved`) and call `POST /approve` to advance.

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found (returned via the global error response shape) |
| `409` | No outline generated yet, generation still in progress, or generation failed (body: `{ "message": "...", "errorMessage"?: "..." }`) |

---

### `POST /api/training/roles/{roleId}/approve`

Marks a training outline as approved. Approval is a prerequisite for full program generation (see §8) and SCORM export. Calling this on an already-approved outline is a no-op — it returns the same outline body with `200 OK`.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the role |

**Request body** — none

**Response — `200 OK`**

Returns the outline body (same shape as `GET /outline` above). Approval state is persisted server-side but is *not* a field on this body; query `/status` if needed.

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |
| `409` | No outline exists yet for this role — body: `{ "message": "No outline to approve. Generate training first." }` |

---

> **SCORM export moved.** Earlier drafts of this contract listed `GET /api/training/roles/{roleId}/export/scorm` here. That endpoint was replaced in Phase 6 by `GET /api/training/roles/{roleId}/full-program/export/scorm` (§8), which packages the *full* program — lesson text, quizzes, and scenarios — not just the outline. The outline by itself is no longer exportable.

---

## 8. Full Training Program Endpoints (Phase 6)

These endpoints generate and export a **complete, deliverable training course** for a role — lesson text, multiple-choice quizzes, and role-specific case-study scenarios — built on top of an approved training outline from §7.

**Prerequisite chain:** Upload document → analyze → assign to vault → generate role outline → **approve role outline** → generate full program → poll status → fetch program / export SCORM.

Generation takes 2–5 minutes for a typical AMLR-scale program (~50 LLM calls). Always trigger via `POST /generate` and poll `/status`; never await the response synchronously.

### `POST /api/training/roles/{roleId}/full-program/generate`

Triggers the full-program generation pipeline for a role. The pipeline loops through each module in the approved outline and calls the LLM three times per module (lesson content per objective, quiz questions per objective, role-specific scenarios per module). Returns 202 immediately; the actual work runs in the background.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of a role whose training outline is in `Approved` state |

**Request body** — none

**Response — `202 Accepted`**

```json
{
  "status": "Generating",
  "roleId": "33333333-3333-3333-3333-333333333333",
  "errorMessage": null
}
```

The `Location` response header points to the status endpoint.

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |
| `409` | No training outline exists for this role yet (`detail: "No training outline exists for role '…'. Generate and approve a training outline first."`) |
| `409` | Training outline exists but is not in `Approved` state (`detail: "Training outline for role '…' is not approved (current status: Draft). …"`) |
| `409` | A full-program generation is already running for this role (`detail: "Full program generation is already in progress for role '…'. …"`) |

---

### `GET /api/training/roles/{roleId}/full-program/status`

Returns the current generation status for a role's full program. Poll this every 3–5 seconds after triggering — generation is significantly slower than outline generation.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the role |

**Response — `200 OK`** — success

```json
{
  "status": "Ready",
  "roleId": "33333333-3333-3333-3333-333333333333",
  "errorMessage": null
}
```

**Response — `200 OK`** — failure (extra `errorMessage` field is populated)

```json
{
  "status": "Failed",
  "roleId": "33333333-3333-3333-3333-333333333333",
  "errorMessage": "LLM response was truncated at 16000 tokens (finish_reason=length). Increase max_tokens or shorten the input."
}
```

**`status` values**

| Value | Meaning |
|-------|---------|
| `"Generating"` | Pipeline is running |
| `"Ready"` | Program is ready; call `GET /full-program` to fetch the content or `GET /full-program/export/scorm` to download the ZIP |
| `"Failed"` | Pipeline failed; `errorMessage` describes the cause |

Note: there is no `"Pending"` status for the full program — if generation has never been triggered, the status endpoint returns `404`.

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |
| `404` | No full-program record exists yet — generation hasn't been triggered (`detail: "No full training program record found for role '…'. Trigger generation first."`) |

**Polling pattern:**

```js
const POLL_INTERVAL_MS = 4000;

async function pollForFullProgram(roleId) {
  while (true) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(
      `http://localhost:5003/api/training/roles/${roleId}/full-program/status`
    );

    if (res.status === 404) {
      // No record yet — generation must not have been triggered
      throw new Error("Full program was never triggered for this role");
    }

    const body = await res.json();

    if (body.status === "Ready") return body;
    if (body.status === "Failed") throw new Error(body.errorMessage ?? "Generation failed");
    // status === "Generating" — keep polling
  }
}
```

---

### `GET /api/training/roles/{roleId}/full-program`

Returns the full program once generation is `Ready`. The body contains every lesson paragraph, quiz question, and scenario produced by the pipeline.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of the role |

**Response — `200 OK`**

```json
{
  "roleId": "33333333-3333-3333-3333-333333333333",
  "roleName": "Financial Analyst",
  "regulationType": "AMLR 2024/1624",
  "riskProfile": {
    "AmlRisk": "High",
    "SanctionsRisk": "High",
    "FraudRisk": "Medium",
    "DocumentationRisk": "High",
    "OperationalRisk": "Medium"
  },
  "generatedAt": "2025-11-03T14:42:18Z",
  "modules": [
    {
      "moduleTitle": "Customer Due Diligence for Financial Analysts",
      "amlrArticle": "10",
      "description": "Risk-based application of AMLR Article 10 to customer onboarding and ongoing monitoring.",
      "objectives": [
        {
          "objective": "Apply enhanced due diligence to high-risk customer segments",
          "lessonContent": "Under AMLR Article 10, financial institutions must conduct enhanced due diligence (EDD) when onboarding customers whose risk profile exceeds the standard threshold. For Financial Analysts, this means…\n\nIn practice, you will encounter EDD triggers in your daily portfolio review…\n\nConsider a case where a long-standing client requests a $5M transfer to a jurisdiction newly flagged by the FATF…",
          "quizQuestions": [
            {
              "text": "Which of the following best describes the trigger for enhanced due diligence under AMLR Article 10?",
              "options": {
                "A": "Any transaction above $10,000",
                "B": "Customer risk profile exceeds the institution's standard threshold",
                "C": "A request from law enforcement",
                "D": "The compliance officer's personal judgment"
              },
              "correctAnswer": "B",
              "explanation": "AMLR Article 10 requires risk-based EDD. Threshold-based triggers (A) and discretionary judgment (D) are not the regulatory standard. Law enforcement requests (C) trigger separate obligations under STR rules."
            }
          ]
        }
      ],
      "scenarios": [
        {
          "title": "The Long-Standing Client and the Unusual Wire",
          "description": "A client of 15 years, previously rated Low risk, has just requested a $5M outbound wire to a jurisdiction added last week to the FATF grey list. The relationship manager wants to process it quickly to preserve the relationship.",
          "complication": "Documentation on the destination beneficiary is thin — the client says it is a 'family investment vehicle' and is reluctant to provide more detail. Your team lead is on vacation and the compliance officer is in another timezone.",
          "discussionQuestions": [
            "What would you do in this situation, and why?",
            "What factors would change your decision?",
            "Who else needs to be involved before this wire is released?"
          ]
        }
      ]
    }
  ]
}
```

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |
| `404` | No full-program record exists for this role (never triggered) |
| `409` | Program is still generating — body: `{ "message": "Program generation still in progress." }` |
| `409` | Program generation failed — body: `{ "message": "Program generation failed: <reason>" }` |
| `409` | Program is in any other non-Ready state — body: `{ "message": "Program generation has not started." }` |

---

### `GET /api/training/roles/{roleId}/full-program/export/scorm`

Streams a SCORM 1.2 compliant ZIP package containing the full program. The ZIP is ready to upload directly to any standards-compliant LMS, or to unzip and open `content/module_1.html` in a browser for a standalone preview.

**Path parameters**

| Param | Type | Description |
|-------|------|-------------|
| `roleId` | UUID | The ID of a role whose full program is `Ready` |

**Response — `200 OK`** — binary ZIP

Response headers:
```
Content-Type: application/zip
Content-Disposition: attachment; filename="training-course-financial-analyst.zip"
```

The filename is derived from the role name (lowercased, non-alphanumerics replaced with `-`).

**ZIP contents:**
```
training-course-{role}.zip
├── imsmanifest.xml          SCORM 1.2 metadata + course structure
├── content/
│   ├── module_1.html        Self-contained HTML module (inline CSS, embedded quiz JS)
│   ├── module_2.html
│   └── ...
└── data/
    └── quiz_data.json       Flat list of all quiz questions (for LMS integration)
```

Each `module_N.html` is fully self-contained: it embeds the relevant quiz data as a JavaScript constant and runs the quiz interaction locally, so the modules work both inside an LMS and when opened directly from the filesystem.

**Errors**

| Status | When |
|--------|------|
| `404` | Role not found |
| `404` | No full-program record for this role |
| `409` | Program is not in `Ready` state (`detail: "Program not ready for export. Current status: <status>."`) |

**Download example (browser):**

```js
async function downloadScorm(roleId) {
  const res = await fetch(
    `http://localhost:5003/api/training/roles/${roleId}/full-program/export/scorm`
  );
  if (!res.ok) throw new Error(`SCORM export failed: ${res.status}`);

  const blob = await res.blob();
  const filename = res.headers
    .get("content-disposition")
    ?.match(/filename="([^"]+)"/)?.[1] ?? "training-course.zip";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 9. Data Models Reference

### `DocumentResponse`

Returned by document upload and document detail endpoints.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | UUID (string) | No | Unique identifier |
| `originalFileName` | string | No | The filename the user uploaded |
| `status` | string | No | `"Pending"`, `"Parsed"`, `"Analyzed"`, or `"Failed"` |
| `regulationType` | string | Yes | The regulation label, e.g. `"GDPR"` |
| `uploadedAt` | datetime (UTC ISO 8601) | No | When the file was uploaded |

---

### `TrainingOutlineResponse`

Returned by both the document-level outline endpoints (§4) and the role-level outline endpoints (§7). The shape is shared, but `roleName` and `riskProfile` are only populated on role outlines.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `documentId` | UUID (string) | No | Document this outline belongs to. For *role* outlines, this is the empty UUID `"00000000-0000-0000-0000-000000000000"` because role outlines are merged across many documents |
| `regulationType` | string | No | Regulation type used for analysis (e.g. `"AMLR 2024/1624"`) |
| `roleName` | string | Yes | `null` for document outlines; populated for role outlines |
| `riskProfile` | object\<string, string\> | Yes | `null` for document outlines; populated for role outlines — keys are PascalCase (`AmlRisk`, `SanctionsRisk`, `FraudRisk`, `DocumentationRisk`, `OperationalRisk`), values are `"High"` \| `"Medium"` \| `"Low"` |
| `generatedAt` | datetime (UTC ISO 8601) | No | When the LLM produced this outline |
| `sections` | array of `OutlineSectionResponse` | No | The training modules; may be empty if the vault was empty when the role outline was generated |

---

### `OutlineSectionResponse`

One training module inside an outline.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `title` | string | No | Module title |
| `description` | string | No | Brief summary of what this module covers |
| `learningObjectives` | array of string | No | Bullet-point outcomes for learners |
| `regulatoryBasis` | `RegulatoryBasisResponse` | Yes | Which AMLR article(s) this module derives from |
| `citations` | array of `CitationResponse` | No | Source passages that back this section |

---

### `RegulatoryBasisResponse`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `amlrArticle` | string | No | Article number(s) as a string. The LLM returns this in three shapes (integer `6`, string `"Preamble"`, or array `[6, 25, 26]`); the server normalizes all three to a string (`"6"`, `"Preamble"`, `"6, 25, 26"`). Always parse defensively |
| `articleTitle` | string | No | Human-readable article title, e.g. `"Risk Assessment"` |

---

### `CitationResponse`

A reference to a specific passage in the source document.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `text` | string | No | The quoted or paraphrased passage |
| `sourceDocument` | string | No | Original filename of the source document |
| `pageNumber` | number (integer) | No | Page in the source document where this appears |
| `section` | string | No | Heading of the section in the source document |
| `chunkId` | UUID (string) | No | Internal ID of the text chunk; can be used to deep-link |

---

### `OrganizationLevelResponse`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | UUID (string) | No | |
| `name` | string | No | Display name |
| `description` | string | Yes | |
| `geography` | string | Yes | Optional geographic label |
| `createdAt` | datetime (UTC ISO 8601) | No | |
| `departments` | array of `DepartmentResponse` | No | Present in hierarchy tree response; empty array if none |

---

### `DepartmentResponse`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | UUID (string) | No | |
| `name` | string | No | Display name |
| `description` | string | Yes | |
| `organizationLevels` | array of `OrganizationLevelResponse` | No | Parent org levels (without their own departments nested) |
| `roles` | array of `RoleResponse` | No | Present in hierarchy tree response; empty array if none |

---

### `RoleResponse`

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | UUID (string) | No | |
| `name` | string | No | Display name |
| `description` | string | Yes | |
| `status` | string | No | `"Draft"` or `"Published"` |
| `amlRisk` | string | No | Risk level: `"High"`, `"Medium"`, or `"Low"` |
| `sanctionsRisk` | string | No | Risk level: `"High"`, `"Medium"`, or `"Low"` |
| `fraudRisk` | string | No | Risk level: `"High"`, `"Medium"`, or `"Low"` |
| `documentationRisk` | string | No | Risk level: `"High"`, `"Medium"`, or `"Low"` |
| `operationalRisk` | string | No | Risk level: `"High"`, `"Medium"`, or `"Low"` |
| `departments` | array of `DepartmentResponse` | No | Parent departments (without their own roles nested) |

---

### `ResolvedDocumentSetResponse`

Returned by `GET /api/vault/roles/{roleId}/documents`.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `roleId` | UUID (string) | No | The role that was queried |
| `roleName` | string | No | Display name of the role |
| `documents` | array of `ResolvedDocumentResponse` | No | All visible documents after inheritance resolution |

---

### `ResolvedDocumentResponse`

One document entry in a resolved or direct document set.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `documentId` | UUID (string) | No | The document's ID |
| `fileName` | string | No | Original filename |
| `inheritedFrom` | string | No | Hierarchy level type where this was assigned: `"OrganizationLevel"`, `"Department"`, or `"Role"` |
| `inheritedFromName` | string | No | Display name of that hierarchy node (e.g. `"Finance"`) |
| `targetType` | string | No | Same value as `inheritedFrom`; the hierarchy level type |

---

### `ErrorResponse`

Returned by the global exception-handling middleware for all `4xx` (except the legacy 400 string and the 409 `{ message }` bodies on a handful of training endpoints) and all `5xx` responses.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `status` | number | No | Mirrors the HTTP status code |
| `title` | string | No | Short label (`"Not Found"`, `"Bad Request"`, `"Conflict"`, `"Internal Server Error"`) |
| `detail` | string | No | Human-readable description |
| `instance` | string | Yes | The request path that produced the error |

---

### `FullProgramStatusResponse`

Returned by `POST /api/training/roles/{roleId}/full-program/generate` and `GET /api/training/roles/{roleId}/full-program/status`.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `status` | string | No | `"Generating"`, `"Ready"`, or `"Failed"` |
| `roleId` | UUID (string) | No | The role this status pertains to |
| `errorMessage` | string | Yes | Populated only when `status === "Failed"`; otherwise `null` |

---

### `FullTrainingProgramResponse`

Returned by `GET /api/training/roles/{roleId}/full-program`. The complete, deliverable training course for a role.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `roleId` | UUID (string) | No | The role this program was generated for |
| `roleName` | string | No | Display name of the role |
| `regulationType` | string | No | Defaults to `"AMLR 2024/1624"` |
| `riskProfile` | object\<string, string\> | Yes | Snapshot of the role's risk profile at generation time. Keys are PascalCase (see `TrainingOutlineResponse`) |
| `modules` | array of `FullTrainingModuleResponse` | No | One entry per module from the approved outline |
| `generatedAt` | datetime (UTC ISO 8601) | No | When generation completed |

---

### `FullTrainingModuleResponse`

One module in the full program.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `moduleTitle` | string | No | Inherited from the approved outline's section title |
| `amlrArticle` | string | Yes | AMLR article reference (e.g. `"10"` or `"6, 25"`); inherited from the outline section's `regulatoryBasis.amlrArticle` |
| `description` | string | Yes | Inherited from the outline section's description |
| `objectives` | array of `LessonObjectiveResponse` | No | One entry per learning objective in the source section |
| `scenarios` | array of `ScenarioResponse` | No | 1–2 LLM-generated case studies per module |

---

### `LessonObjectiveResponse`

One learning objective inside a module, with generated lesson content and quiz.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `objective` | string | No | Inherited verbatim from the outline section's `learningObjectives` array |
| `lessonContent` | string | No | 2–3 paragraphs of plain-text instructional content. May be an empty string if the LLM call failed or returned empty |
| `quizQuestions` | array of `QuizQuestionResponse` | No | 3–5 multiple-choice questions assessing the objective. May be empty if the LLM call failed or returned invalid JSON |

---

### `QuizQuestionResponse`

One multiple-choice question.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `text` | string | No | Question text, ending with a `?` |
| `options` | object\<string, string\> | No | Always has exactly four keys: `"A"`, `"B"`, `"C"`, `"D"`. Values are the option text |
| `correctAnswer` | string | No | One of `"A"`, `"B"`, `"C"`, `"D"` |
| `explanation` | string | No | Explains why the correct answer is right (and often why a distractor is wrong); may cite the AMLR article |

---

### `ScenarioResponse`

One case-study scenario for facilitated discussion.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `title` | string | No | Short descriptive title (5–10 words) |
| `description` | string | No | The situation setup — who, what, what's known |
| `complication` | string | No | The specific decision point the learner must navigate |
| `discussionQuestions` | array of string | No | 3–4 questions; at least one is "What would you do?"-style |

---

### Request Models

#### `AnalyzeDocumentRequest`

| Field | Type | Required |
|-------|------|----------|
| `documentId` | UUID (string) | Yes |
| `regulationType` | string | Yes |

#### `CreateOrganizationLevelRequest`

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `description` | string | No |
| `geography` | string | No |

#### `CreateDepartmentRequest`

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `description` | string | No |
| `organizationLevelIds` | array of UUID | No (defaults to empty) |

#### `CreateRoleRequest`

| Field | Type | Required | Valid values | Notes |
|-------|------|----------|-------------|-------|
| `name` | string | Yes | | Display name |
| `description` | string | No | | Optional description |
| `departmentIds` | array of UUID | No (defaults to empty) | | IDs of departments this role belongs to |
| `amlRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | AML risk exposure; defaults to `"Medium"` |
| `sanctionsRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Sanctions screening risk; defaults to `"Medium"` |
| `fraudRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Fraud detection risk; defaults to `"Medium"` |
| `documentationRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Documentation/compliance risk; defaults to `"Medium"` |
| `operationalRisk` | string | No | `"High"`, `"Medium"`, `"Low"` | Operational control risk; defaults to `"Medium"` |

#### `AssignDocumentRequest`

| Field | Type | Required | Valid values |
|-------|------|----------|-------------|
| `documentId` | UUID (string) | Yes | Any valid document ID |
| `targetType` | string | Yes | `"OrganizationLevel"`, `"Department"`, `"Role"` |
| `targetId` | UUID (string) | Yes | Any valid hierarchy node ID |

---

## 10. Key Concepts for the Frontend Developer

### The Three-Level Hierarchy

Think of the hierarchy as three nested layers, like a company org chart:

1. **Organization Level** — the broadest unit: a company, region, or business unit. Example: *EMEA Region*, *North America HQ*.
2. **Department** — a team or function within an org level. Example: *Finance*, *Legal*, *Engineering*. A department can belong to multiple org levels.
3. **Role** — a job function within a department. Example: *Financial Analyst*, *Compliance Officer*. A role can span multiple departments. Roles start as `Draft` and must be explicitly published before they are active.

The hierarchy tree flows top-down: `Organization Level → Department → Role`.

### Document Inheritance

When a document is assigned to a hierarchy node, every node below it automatically sees that document too. For example:

- Assigning *GDPR Policy* to the *EMEA Region* org level means every department in EMEA, and every role in those departments, will see *GDPR Policy* in their resolved document set.
- Assigning *SOX Compliance Guide* specifically to the *Finance* department means only Finance roles (not other EMEA departments) see it.
- Assigning *Trading Limits Policy* directly to the *Financial Analyst* role means only that role sees it.

When the same document is assigned at multiple levels (e.g. both at the org level and directly to a role), the **most specific assignment wins**: Role > Department > Organization Level.

### Direct Assignments vs Resolved Document Sets

- **Direct assignment** (`GET /api/vault/{targetType}/{targetId}/documents`): shows only the documents explicitly assigned to that one node. Use this in admin views where you want to manage what's directly assigned to a department or role.
- **Resolved document set** (`GET /api/vault/roles/{roleId}/documents`): walks the full hierarchy upward and returns everything the role can see, after inheritance and deduplication. Use this to build a user's training queue.

### The Analysis Pipeline Flow

```
Upload document               →  status: "Pending"
    ↓
POST /api/analysis            →  202 Accepted, pipeline starts in background
    ↓ (poll GET /outline every 2s)
Text extraction completes     →  status: "Parsed"
    ↓
AI generates training outline →  status: "Analyzed", outline available (status: "Draft")
    ↓
Admin reviews and approves    →  POST /api/analysis/{id}/approve
                              →  outline status: "Approved"
```

The outline appears as soon as the document status is `"Analyzed"`. The `"Approved"` step is an editorial gate — the frontend should show the outline for review before allowing approval.

### Citations

Citations are the evidence that backs each section of a training outline. Each citation contains:
- The exact text passage from the source document (`text`)
- Which page it came from (`pageNumber`)
- The section heading in the document (`section`)
- The original filename (`sourceDocument`)

When displaying a training module, render citations as footnotes or an expandable "Sources" panel. The `chunkId` uniquely identifies the text segment and can be used as a stable key for linking.

### Draft vs Published Roles

Roles start as `"Draft"` and become `"Published"` via the publish endpoint. The UI rules are:

| Action | Draft role | Published role |
|--------|-----------|---------------|
| Assign documents | Allowed | Allowed |
| Show in employee-facing views | No | Yes |
| Include in resolved document sets | Yes (admin only) | Yes |
| Can be published | Yes (if has ≥1 department) | Already published |

### Risk Profiles and Training Calibration

Each role has a **risk profile** — a set of five risk dimensions that describe the role's exposure to different types of compliance threats:

1. **AML Risk** — Anti-money laundering exposure (e.g. KYC Analyst has High AML risk)
2. **Sanctions Risk** — Export controls and sanctions screening exposure
3. **Fraud Risk** — Fraud detection and prevention responsibility
4. **Documentation Risk** — Regulatory documentation and record-keeping obligations
5. **Operational Risk** — Operational control and process risk

**How risk drives training depth:**

When you trigger training generation for a role (via `POST /api/training/roles/{roleId}/generate`), Mimir's AI engine uses the role's risk profile to calibrate the depth and breadth of training:

- **High-risk roles** (e.g. Compliance Officer, AML Investigator) receive:
  - Deep, comprehensive modules covering all aspects of each regulation
  - Multiple modules per regulatory topic (Foundation → Application → Deepening → Embedding)
  - Detailed quiz questions and scenario-based assessments
  - Every regulatory article cited in the source documents

- **Medium-risk roles** (e.g. Sales Manager, Customer Advisor) receive:
  - Foundation and application-level modules only
  - Focused content covering the most critical obligations
  - Moderate number of learning objectives and assessments

- **Low-risk roles** (e.g. Receptionist, IT Operations) receive:
  - Foundation-level modules only
  - High-level awareness content
  - Minimal assessments

This risk-based calibration ensures compliance training is proportionate to actual risk exposure — high-risk roles get expert-level depth, low-risk roles get awareness training, and everyone gets exactly what they need.

**Where to find risk profiles:**

- When creating a role: set risk levels in `POST /api/hierarchy/roles`
- Before generating training: retrieve via `GET /api/hierarchy/roles/{roleId}/risk-profile`
- After generating training: view in the role's `TrainingOutlineResponse` under `riskProfile`

---

### Two-Stage Training Generation (Outline → Full Program)

Mimir generates training in two distinct stages, with an explicit human approval gate between them:

| Stage | Endpoint family | Output | Approx. time |
|-------|----------------|--------|--------------|
| **1. Role outline** | `/api/training/roles/{roleId}/...` | Module titles, learning objectives, regulatory citations | 30–90 seconds |
| **2. Full program** | `/api/training/roles/{roleId}/full-program/...` | Lesson paragraphs, MCQ quizzes, scenarios, SCORM ZIP | 2–5 minutes |

**Why two stages:**

- The outline is **cheap and fast** — the user can iterate on the structure (re-run if unhappy, edit assignments in the vault) without paying for full content generation.
- The full program is **expensive** (~50 LLM calls per AMLR-scale role at ~$0.05 each via OpenRouter). It only runs once the outline has been explicitly approved.
- The full program is **read-only after generation**. There is no re-generate-while-keeping-content endpoint — to regenerate, you simply call `POST /full-program/generate` again and the old record is overwritten.

**Recommended UI flow:**

1. Trigger outline generation → poll `/status` → render outline → user reviews → user clicks "Approve outline".
2. Show a "Generate full course" button (disabled until outline is approved).
3. On click, trigger full-program generation → show a determinate-progress-style polling indicator (4-second interval recommended).
4. When status is `"Ready"`, show two CTAs: "Preview full course" (calls `GET /full-program`) and "Download SCORM" (calls `GET /full-program/export/scorm`).

**Error recovery:** If full-program generation fails (LLM rate limit, truncation, network error), the status will read `"Failed"` with an `errorMessage`. The UI should show the message and offer a "Retry" button that simply calls `POST /full-program/generate` again — the new run overwrites the failed record.

---

## 11. Frontend Integration Notes

- **CORS**: The backend allows requests from `http://localhost:5173` (Vite default) and `http://localhost:3000` (Next.js default). No extra CORS setup needed on the frontend.
- **File upload limit**: 20 MB per file. Show an error before attempting upload if the file exceeds this.
- **Accepted file types**: `.pdf` and `.docx` only. Filter the `<input type="file">` with `accept=".pdf,.docx"`.
- **All IDs are UUID strings**: Store and pass them as strings, never as numbers.
- **Polling intervals**:
  - Document analysis outline (`GET /api/analysis/{documentId}/outline`): every **2 seconds**.
  - Role training outline (`GET /api/training/roles/{roleId}/status`): every **2–3 seconds**.
  - Full program (`GET /api/training/roles/{roleId}/full-program/status`): every **4 seconds** — generation takes 2–5 minutes and aggressive polling wastes requests.
- **SCORM download**: Use `fetch` + `Blob` + a hidden `<a download>` link (see the snippet in §8). Do not set `window.location` directly — it can be hard to surface errors that way.
- **Empty arrays vs null**: Array fields (e.g. `sections`, `documents`, `departments`, `modules`, `quizQuestions`, `scenarios`) are always returned as arrays — never `null`. Missing optional string fields (e.g. `description`, `geography`, `amlrArticle`) may be `null`.
- **`targetType` is case-insensitive** on the server side, but use the cased versions (`"OrganizationLevel"`, `"Department"`, `"Role"`) for consistency.
- **Risk profile keys are PascalCase**: `AmlRisk`, `SanctionsRisk`, `FraudRisk`, `DocumentationRisk`, `OperationalRisk`. The `POST /hierarchy/roles` request body uses camelCase (`amlRisk`, …) but the response payloads inside `TrainingOutlineResponse.riskProfile` and `FullTrainingProgramResponse.riskProfile` use PascalCase. This asymmetry comes from how each side serializes; just match what the responses actually return.
- **LLM-generated content may be empty.** If an individual LLM call fails or returns malformed JSON during full-program generation, the affected `lessonContent` will be `""` and the `quizQuestions` / `scenarios` array will be `[]` — the rest of the program is preserved. The frontend should render an inline placeholder ("Lesson content could not be generated for this objective") rather than crashing.
