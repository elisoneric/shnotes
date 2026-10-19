# Trustbricks Engineering Governance Platform
## Production Architecture & Operational Walkthrough

A white-labeled, self-hosted engineering workflow and governance platform deployed via Docker on Coolify. It unifies Notion-style document canvases with strict, role-governed sign-off pipelines (HOO, Technical Assistant, Developer) and local-first offline synchronization.

---

## 1. System Architecture & Tech Stack

| Component | Technology | Role in System |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router, React 19, TypeScript) | Standalone containerized application shell |
| **Client Database** | Dexie.js (IndexedDB wrapper, ~25KB) | Zero-latency local storage for offline read/writes |
| **Server Database** | PostgreSQL 16 + Prisma ORM 6.5.0 | Source of truth with deterministic migrations |
| **AI Gateway** | Indunix AI (`https://api.indunixai.com/v1`, `indunix-1-core`) | Architecture recommendation drafts, QA checklists, RAG context |
| **UI Styling** | Tailwind CSS + Lucide Icons | Clean, high-contrast dark/light design (Zero emojis) |
| **Desktop Shell** | Tauri v2 (Rust + Windows WebView2) | Native Windows client (< 15 MB footprint) |
| **Mobile Clients** | PWA (iOS standalone) / TWA (Android `.apk`) | Instant OTA updates and offline app caching |
| **Deployment** | Docker multi-stage + Docker Compose | Automated migration execution on Coolify |

---

## 2. The 7-Stage "Ball-in-Court" Governed Task Lifecycle

Tasks strictly advance through sequential gates to eliminate vague requirements and unverified deployments:

```
[1. Proposed (HOO)]
       │
       ▼
[2. TA Review (Technical Assistant)]
       │
       ▼
[3. Dev Assessment (Developer)] ──(Indunix AI Technical Spec Draft)
       │
       ▼
[4. Confirmed & Scope Locked (HOO / TA)]
       │
       ▼
[5. In Progress (Developer)]
       │
       ▼
[6. Ready for QA (Developer)] ──(Staging link, demo credentials, AI QA checklist)
       │
       ▼
[7. Approved & Cleared to Archive (HOO)]
```

### Stage Responsibilities Matrix

* **Stage 1: Proposed (HOO):** Head of Operations identifies an operational requirement and logs the business rationale and target release date.
* **Stage 2: TA Review (Technical Assistant):** TA inspects API dependencies, specifies edge cases, and assigns a primary developer.
* **Stage 3: Dev Assessment (Developer):** The developer writes a structured Technical Recommendation covering architecture, trade-offs, and estimated days. Click **AI Draft Recommendation** to have Indunix analyze the HOO request and generate a candidate spec.
* **Stage 4: Confirmed (HOO / TA):** Stakeholder reviews the technical spec and formally clicks **Approve Scope & Lock**.
* **Stage 5: In Progress (Developer):** The task is locked; active development occurs.
* **Stage 6: Ready for QA (Developer):** Developer deploys to staging and submits preview URLs, test accounts, and testing steps. Click **AI Generate QA Checklist** for automated test criteria.
* **Stage 7: Approved & Cleared (HOO):** HOO executes the acceptance test, clicks **Approve Acceptance & Clear to Archive**, moving the task to the permanent project archive.

---

## 3. The 3-Tier Task Governance Modal & "Slack-in-a-Card"

When clicking any task card on the Kanban board, the 3-Tier Governance modal opens:

* **Tier 1 (Top Card): Operational Request (HOO / TA):**
  * Displays user story, business outcome, and TA triage notes.
* **Tier 2 (Middle Card): Developer Architecture Box:**
  * Technical solution notes, trade-offs, and risk matrix.
  * Actions: `AI Draft Recommendation` and `Approve Scope & Lock`.
* **Tier 3 (Bottom Card): QA Verification Box:**
  * Staging URL, test credentials, testing instructions.
  * Actions: `AI Generate QA Checklist` and `Approve Acceptance & Clear to Archive`.
* **Embedded Conversation Drawer ("Slack-in-a-Card"):**
  * Live discussion attached permanently to the task record.
  * Filter tabs: `All`, `Audit Trail` (stage transition timestamps and user IDs), and `Tech Notes`.
  * Action: `AI Summarize Conversation` summarizes 20+ comment threads into a 3-bullet consensus decision.

---

## 4. Local-First Offline Sync Engine

The application functions 100% offline in transit or during network outages:

1. **Instant Write (0ms Latency):** Any note edit, task creation, or stage transition writes immediately to IndexedDB via `localDb`.
2. **Local Outbox (`mutationQueue`):** Every action appends a mutation record with timestamp and payload.
3. **Background Sync (`syncManager`):**
   * Automatically triggers when `navigator.onLine` fires or on a 20-second background cycle.
   * Dispatches pending mutations to `POST /api/sync`.
   * Server executes mutations in a PostgreSQL transaction, bumps version numbers, and logs audit events.
   * Server returns delta changes modified since `lastSyncedAt`.
   * Client clears applied mutations and updates local tables.
4. **Visual Indicator (Sidebar Bottom):**
   * Check icon: "All changes saved & synced"
   * Spin icon: "Syncing changes..."
   * Wifi-off icon: "Offline (X local edits queued)"

---

## 5. Notion-Style Document Canvas & Operations Diary

* **Document Canvas:**
  * Slash command menu (`/`): Heading 1, Heading 2, Paragraph, To-do list, Bullet list, Callout box, Code snippet, Quote, Divider.
  * Real-time autosave to local Dexie with background sync.
  * **Encrypted Read-Only Sharing:** Click **Share Secret Link** to generate a cryptographic 256-bit token. The public route `/shared/[secretToken]` renders a clean typography view without requiring an account.
* **Operations Diary:**
  * Dedicated timeline log with date navigation (Today, Prev, Next).
  * Automatically creates or loads daily standup logs.

---

## 6. How to Deploy on Coolify

1. **Push Code to Git Repository:**
   ```bash
   git add .
   git commit -m "feat: complete engineering governance platform"
   git push origin main
   ```
2. **Configure Application in Coolify:**
   * In Coolify, create a new service from your Git repository using the root `docker-compose.yml` or `Dockerfile`.
   * Under Environment Variables, copy the values from `.env.example`:
     ```env
     NODE_ENV=production
     APP_URL=https://notes.yourdomain.com
     POSTGRES_USER=shnotes
     POSTGRES_PASSWORD=your-secure-password
     POSTGRES_DB=shnotes
     DATABASE_URL=postgresql://shnotes:your-secure-password@db:5432/shnotes?schema=public
     AUTH_SECRET=generate-random-base64-string
     ADMIN_EMAIL=admin@trustbricks.com
     ADMIN_PASSWORD=your-admin-password
     WORKSPACE_NAME=Trustbricks
     INDUNIX_API_KEY=your-indunix-api-key
     INDUNIX_BASE_URL=https://api.indunixai.com/v1
     INDUNIX_MODEL=indunix-1-core
     ```
3. **Automatic Boot & Migration:**
   * Coolify runs `docker compose up --build`.
   * The container entrypoint `docker-entrypoint.sh` executes `prisma migrate deploy` automatically before launching Next.js on port 3000.
   * `ensureSeedData()` runs on first boot, establishing the default *Trustbricks* workspace, *Equity Portal* (`EQ`), *HR Portal* (`HR`), and initial governed tasks.

---

## 7. Multi-Platform Packaging

### A. Web App & iOS PWA
* Manifest is configured at `/manifest.json`.
* Service worker `/sw.js` caches the application shell.
* On iOS Safari, the custom onboarding banner (`IosInstallModal`) detects standalone mode and guides users to tap **Share** $\rightarrow$ **Add to Home Screen**.

### B. Lightweight Windows Desktop Client (`.exe` < 15 MB)
* Configured in `src-tauri/`.
* To compile the Windows executable:
  ```powershell
  # Requires Rust installed (https://rustup.rs)
  cargo install tauri-cli --version "^2.0.0"
  cargo tauri build
  ```
* The compiled binary is output to `src-tauri/target/release/Trustbricks.exe`. It utilizes the native Windows WebView2 runtime, consuming ~35 MB RAM.

### C. Android Client (`.apk` ~ 2.5 MB) via TWA
* Install Google's Bubblewrap CLI:
  ```bash
  npm i -g @bubblewrap/cli
  bubblewrap init --manifest=https://notes.yourdomain.com/manifest.json
  bubblewrap build
  ```
* Outputs an installable Android APK that connects directly to your Coolify instance with instant over-the-air updates.
