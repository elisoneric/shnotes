-- CreateTable
CREATE TABLE "page_collaborators" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_collaborators_pageId_userId_key" ON "page_collaborators"("pageId", "userId");

-- CreateIndex
CREATE INDEX "page_collaborators_userId_idx" ON "page_collaborators"("userId");

-- AddForeignKey
ALTER TABLE "page_collaborators" ADD CONSTRAINT "page_collaborators_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_collaborators" ADD CONSTRAINT "page_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
