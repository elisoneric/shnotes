-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProjectAccessLevel" AS ENUM ('LEAD', 'CONTRIBUTOR', 'OBSERVER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSystemAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "colorAccent" TEXT DEFAULT '#3b82f6';

-- AlterTable pages
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "layout" TEXT DEFAULT 'centered';
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "fontFamily" TEXT DEFAULT 'sans';
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "fontSize" TEXT DEFAULT 'normal';

-- CreateTable project_members
CREATE TABLE IF NOT EXISTS "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessLevel" "ProjectAccessLevel" NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");
CREATE INDEX IF NOT EXISTS "project_members_userId_idx" ON "project_members"("userId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable page_subscribers
CREATE TABLE IF NOT EXISTS "page_subscribers" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "page_subscribers_pageId_email_key" ON "page_subscribers"("pageId", "email");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "page_subscribers" ADD CONSTRAINT "page_subscribers_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
