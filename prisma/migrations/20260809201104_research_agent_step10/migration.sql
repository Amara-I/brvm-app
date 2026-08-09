-- CreateEnum
CREATE TYPE "research_category" AS ENUM ('UX', 'CONTENU', 'FONCTIONNALITE', 'CONCURRENCE');

-- CreateEnum
CREATE TYPE "research_status" AS ENUM ('NOUVEAU', 'RETENU', 'REJETE', 'APPLIQUE');

-- CreateTable
CREATE TABLE "research_findings" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "category" "research_category" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "provider" TEXT NOT NULL,
    "status" "research_status" NOT NULL DEFAULT 'NOUVEAU',
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,

    CONSTRAINT "research_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "research_findings_url_key" ON "research_findings"("url");

-- CreateIndex
CREATE INDEX "research_findings_category_idx" ON "research_findings"("category");

-- CreateIndex
CREATE INDEX "research_findings_status_idx" ON "research_findings"("status");

-- CreateIndex
CREATE INDEX "research_findings_discovered_at_idx" ON "research_findings"("discovered_at");
