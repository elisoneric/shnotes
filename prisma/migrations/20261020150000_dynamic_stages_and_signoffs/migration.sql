-- AlterEnum WorkspaceRole
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'PRODUCT_OWNER';
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'STAFF';

-- AlterEnum ProjectAccessLevel
ALTER TYPE "ProjectAccessLevel" ADD VALUE IF NOT EXISTS 'PRODUCT_OWNER';
ALTER TYPE "ProjectAccessLevel" ADD VALUE IF NOT EXISTS 'LEAD_DEV';
ALTER TYPE "ProjectAccessLevel" ADD VALUE IF NOT EXISTS 'REVIEWER_REQUESTER';

-- AlterTable projects
ALTER TABLE "projects" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable pages
ALTER TABLE "pages" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- CreateTable project_stages
CREATE TABLE IF NOT EXISTS "project_stages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_stages_pkey" PRIMARY KEY ("id")
);

-- AlterTable tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "stageId" TEXT;

-- CreateTable task_signoffs
CREATE TABLE IF NOT EXISTS "task_signoffs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cleared" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "task_signoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_stages_projectId_order_idx" ON "project_stages"("projectId", "order");
CREATE INDEX IF NOT EXISTS "tasks_projectId_stageId_idx" ON "tasks"("projectId", "stageId");
CREATE UNIQUE INDEX IF NOT EXISTS "task_signoffs_taskId_userId_key" ON "task_signoffs"("taskId", "userId");
CREATE INDEX IF NOT EXISTS "pages_projectId_idx" ON "pages"("projectId");

-- AddForeignKey
ALTER TABLE "project_stages" DROP CONSTRAINT IF EXISTS "project_stages_projectId_fkey";
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_stageId_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "project_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_signoffs" DROP CONSTRAINT IF EXISTS "task_signoffs_taskId_fkey";
ALTER TABLE "task_signoffs" ADD CONSTRAINT "task_signoffs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_signoffs" DROP CONSTRAINT IF EXISTS "task_signoffs_userId_fkey";
ALTER TABLE "task_signoffs" ADD CONSTRAINT "task_signoffs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pages" DROP CONSTRAINT IF EXISTS "pages_projectId_fkey";
ALTER TABLE "pages" ADD CONSTRAINT "pages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill default project stages for any projects lacking stages
INSERT INTO "project_stages" ("id", "projectId", "name", "color", "order", "isCompleted")
SELECT 'stg_req_' || p.id, p.id, 'Backlog / Requests', '#94a3b8', 1000.0, false
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" ps WHERE ps."projectId" = p.id AND ps."name" = 'Backlog / Requests');

INSERT INTO "project_stages" ("id", "projectId", "name", "color", "order", "isCompleted")
SELECT 'stg_rev_' || p.id, p.id, 'In Review & Spec', '#a855f7', 2000.0, false
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" ps WHERE ps."projectId" = p.id AND ps."name" = 'In Review & Spec');

INSERT INTO "project_stages" ("id", "projectId", "name", "color", "order", "isCompleted")
SELECT 'stg_prog_' || p.id, p.id, 'In Progress', '#3b82f6', 3000.0, false
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" ps WHERE ps."projectId" = p.id AND ps."name" = 'In Progress');

INSERT INTO "project_stages" ("id", "projectId", "name", "color", "order", "isCompleted")
SELECT 'stg_qa_' || p.id, p.id, 'Ready for QA & Sign-Off', '#10b981', 4000.0, false
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" ps WHERE ps."projectId" = p.id AND ps."name" = 'Ready for QA & Sign-Off');

-- Map any existing tasks without stageId to corresponding default stage
UPDATE "tasks" t
SET "stageId" = 'stg_req_' || t."projectId"
WHERE t."stageId" IS NULL AND (t."stage" = 'PROPOSED' OR t."stage" IS NULL);

UPDATE "tasks" t
SET "stageId" = 'stg_rev_' || t."projectId"
WHERE t."stageId" IS NULL AND (t."stage" = 'TA_REVIEW' OR t."stage" = 'DEV_ASSESSMENT');

UPDATE "tasks" t
SET "stageId" = 'stg_prog_' || t."projectId"
WHERE t."stageId" IS NULL AND (t."stage" = 'CONFIRMED_READY' OR t."stage" = 'IN_PROGRESS');

UPDATE "tasks" t
SET "stageId" = 'stg_qa_' || t."projectId"
WHERE t."stageId" IS NULL AND (t."stage" = 'READY_FOR_TESTING' OR t."stage" = 'APPROVED_CLEARED' OR t."stage" = 'ARCHIVED');
