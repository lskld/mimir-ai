# FRONTEND_CONTRACT.md

This document is the complete API reference for the Mimir backend. It is written for a Next.js developer and contains every request shape, response shape, and error code you need to build the frontend. No backend knowledge is required.

---

## 1. Overview

Mimir is a compliance training platform. It lets administrators upload regulatory documents (PDF or DOCX), run an AI pipeline that reads those documents and produces a structured training outline, and then assign documents to roles in an organizational hierarchy. Employees assigned to a role automatically inherit all documents assigned to that role's parent departments and the broader organization.

**Base URL (local development)**
```
http://localhost:5003
```

**Running the backend locally**
You need the .NET 10 SDK installed. Clone the repo, open a terminal in the project root, and run `dotnet run --project Mimir.API`. The server starts at `http://localhost:5003`. You also need a Groq API key — set it with `dotnet user-secrets set "Groq:ApiKey" "<your-key>" --project Mimir.API` before the AI analysis endpoints will work.

**General notes**
- All request and response bodies are JSON unless the endpoint uses file upload (see §2).
- All timestamps are UTC in ISO 8601 format: `"2025-11-03T14:32:00Z"`.
- All IDs are UUIDs represented as strings: `"3fa85f64-5717-4562-b3fc-2c963f66afa6"`.
- Set the `Content-Type: application/json` header on all JSON requests.

---

## 2. General Conventions

### Error Format

Error responses follow a standard structure with a `status` code, a short `title`, and optional `detail` string:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  "title": "Not Found",
  "status": 404,
  "detail": "No document found with the given id.",
  "traceId": "00-a1b2c3d4e5f6a7b8-c9d0e1f2-00"
}
```

For simple validation errors (e.g. missing required field) the response body is a plain string:
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

Creates a new role in `Draft` status and links it to one or more departments. A role must be published before documents can be assigned to it and before employees can be associated with it.

**Request body** — `application/json`

```json
{
  "name": "Financial Analyst",
  "description": "Analysts responsible for financial modelling",
  "departmentIds": [
    "22222222-2222-2222-2222-222222222222"
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Display name |
| `description` | string | No | Optional description |
| `departmentIds` | array of UUIDs | No | IDs of departments this role belongs to; can be empty (but the role cannot be published until it has at least one) |

**Response — `201 Created`**

```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "name": "Financial Analyst",
  "description": "Analysts responsible for financial modelling",
  "status": "Draft",
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

## 7. Data Models Reference

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

Returned by the outline and approve endpoints.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `documentId` | UUID (string) | No | The document this outline belongs to |
| `regulationType` | string | No | Regulation type used for analysis |
| `generatedAt` | datetime (UTC ISO 8601) | No | When the AI generated this outline |
| `sections` | array of `OutlineSectionResponse` | No | The training modules; may be empty during generation |

---

### `OutlineSectionResponse`

One training module inside an outline.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `title` | string | No | Module title |
| `description` | string | No | Brief summary of what this module covers |
| `learningObjectives` | array of string | No | Bullet-point outcomes for learners |
| `citations` | array of `CitationResponse` | No | Source passages that back this section |

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

| Field | Type | Required |
|-------|------|----------|
| `name` | string | Yes |
| `description` | string | No |
| `departmentIds` | array of UUID | No (defaults to empty) |

#### `AssignDocumentRequest`

| Field | Type | Required | Valid values |
|-------|------|----------|-------------|
| `documentId` | UUID (string) | Yes | Any valid document ID |
| `targetType` | string | Yes | `"OrganizationLevel"`, `"Department"`, `"Role"` |
| `targetId` | UUID (string) | Yes | Any valid hierarchy node ID |

---

## 8. Key Concepts for the Frontend Developer

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

---

## 9. Frontend Integration Notes

- **CORS**: The backend allows requests from `http://localhost:5173` (Vite default) and `http://localhost:3000` (Next.js default). No extra CORS setup needed on the frontend.
- **File upload limit**: 20 MB per file. Show an error before attempting upload if the file exceeds this.
- **Accepted file types**: `.pdf` and `.docx` only. Filter the `<input type="file">` with `accept=".pdf,.docx"`.
- **All IDs are UUID strings**: Store and pass them as strings, never as numbers.
- **Polling interval**: Poll `GET /api/analysis/{documentId}/outline` every **2 seconds** after triggering analysis.
- **Empty arrays vs null**: Array fields (e.g. `sections`, `documents`, `departments`) are always returned as arrays — never `null`. Missing optional string fields (e.g. `description`, `geography`) may be `null`.
- **`targetType` is case-insensitive** on the server side, but use the cased versions (`"OrganizationLevel"`, `"Department"`, `"Role"`) for consistency.
