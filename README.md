# ShNotes Enterprise Governance Platform
## Production Architecture & Operational Walkthrough

An enterprise-grade, self-hosted governance and workflow platform deployed via Docker on Coolify. It combines Notion-style document canvases with multi-disciplinary role governance pipelines and zero-latency local-first offline synchronization.

The platform is designed for enterprise initiatives across any domain—including engineering, operations, legal, finance, product, or compliance.

---

## 1. Enterprise Role Architecture

Workspaces and projects are governed by flexible, professional role structures rather than rigid department-specific labels:

| Role Title | Governance Authority | Primary Functions |
| :--- | :--- | :--- |
| **Project Owner (Final Authority)** | Ultimate Sign-off Authority | Holds the final decision on requirements, deliverables, and production sign-off. |
| **Project Guide / Lead Reviewer** | Guidance & Triage Authority | Verifies requirements, inspects dependencies, and ensures alignment before execution. |
| **Specialist / Contributor** | Execution & Methodology Lead | Proposes execution plans, designs architecture, submits deliverables, and writes tasks. |
| **Auditor / Observer** | Read & Review Access | Monitors audit logs, inspects deliverables, and participates in discussion threads. |

> **Single-Role and Solo Operation:** A specialist or developer working independently can write tasks, propose plans, and execute sign-offs directly using their assigned authority without artificial gate blockades.

---

## 2. Universal 7-Stage Enterprise Task Lifecycle

Every task transitions through structured, transparent governance gates:

```
[1. Proposed] ──(Initiator: Business objective & operational requirements)
       │
       ▼
[2. Under Review] ──(Guide: Triage, dependencies & alignment notes)
       │
       ▼
[3. Plan & Scope] ──(Specialist: Methodology proposal & timeline)
       │
       ▼
[4. Scope Confirmed] ──(Owner / Guide: Scope approved & locked)
       │
       ▼
[5. In Progress] ──(Assignee: Active execution)
       │
       ▼
[6. Verification] ──(Reviewer / Specialist: Deliverables, staging credentials & evidence)
       │
       ▼
[7. Completed & Approved] ──(Final Sign-off: Acceptance confirmed & archived)
```

---

## 3. The 3-Tier Enterprise Governance Modal

Inside each task card:

* **Tier 1: Business Objective & Requirements:**
  * Initiator logs business rationale, expected outcome, and target release date.
  * Project Guide inputs review notes, compliance checkpoints, and dependency remarks.
* **Tier 2: Execution Methodology & Scope:**
  * Specialist outlines technical architecture, operational methodology, trade-offs, and risk matrix.
  * Action: **AI Draft Methodology Plan** (powered by Indunix AI `indunix-1-core`).
  * Action: **Confirm & Lock Scope** (approved by Project Guide or Owner).
* **Tier 3: Deliverables, Verification & Sign-off:**
  * Specialist submits staging demonstration links, test credentials, and verification instructions.
  * Action: **AI Generate Verification Criteria** (automated acceptance checklist).
  * Action: **Approve Acceptance & Final Sign-off** (records sign-off name, audit log, and clears task to archive).
* **Discussion Drawer ("Slack-in-a-Card"):**
  * Live conversation thread attached permanently to the task.
  * Filters: `All`, `Audit Trail` (state transition timestamps and authorities), and `Tech Notes`.
  * Action: **AI Summarize Discussion** into a concise 3-bullet consensus decision.

---

## 4. Local-First Offline Sync Engine

* **Instant Write (0ms Latency):** All reads and writes hit local IndexedDB via `Dexie.js`.
* **Outbox Mutation Queue (`mutationQueue`):** Edits performed offline are safely queued with client timestamps.
* **Delta Sync Protocol (`/api/sync`):** When network connectivity is active, pending mutations push to PostgreSQL inside a database transaction, and server deltas merge seamlessly.
* **Sync Badge:** Real-time indicator in the sidebar footer showing *All changes saved & synced*, *Syncing changes...*, or *Offline (X local edits queued)*.

---

## 5. Clean Enterprise Aesthetics & Standards

* **Zero Emojis:** Professional Lucide icons utilized throughout.
* **Titled Inputs:** Every input field has a descriptive title; no placeholder includes "e.g." or informal phrasing.
* **Typography:** Clean system UI font stack with high contrast dark/light themes.
* **Notion-Style Canvas:** Full block editor (Headings, Paragraphs, Checklists, Callout boxes, Code blocks, Quotes, Dividers) with 256-bit cryptographic public sharing (`/shared/[token]`).
* **Operations Diary:** Daily timeline calendar for operations standup records and sprint notes.

---

## 6. Multi-Platform Targets & Deployment

* **Docker on Coolify:** Multi-stage Dockerfile running standalone Next.js 15 on port 3000 with PostgreSQL 16 and automated `prisma migrate deploy` on container boot.
* **Web & iOS PWA:** Web App Manifest (`/manifest.json`), service worker (`/sw.js`), and Safari onboarding modal (`IosInstallModal`).
* **Lightweight Windows Client (`.exe` < 15 MB):** Configured in `src-tauri/` using native Windows WebView2 (~35 MB RAM).
* **Android Client (`.apk` ~ 2.5 MB):** Trusted Web Activity (TWA) with instant over-the-air updates from Coolify.
