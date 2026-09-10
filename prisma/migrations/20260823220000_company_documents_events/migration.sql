-- Documents officiels + calendrier corporate par société
CREATE TABLE IF NOT EXISTS "company_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT,
    "filename" TEXT,
    "url" TEXT NOT NULL,
    "doc_type" TEXT,
    "period_label" TEXT,
    "published_at" DATE,
    "source_name" TEXT NOT NULL,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_documents_company_id_url_key"
  ON "company_documents"("company_id", "url");

CREATE INDEX IF NOT EXISTS "company_documents_company_id_published_at_idx"
  ON "company_documents"("company_id", "published_at");

ALTER TABLE "company_documents"
  DROP CONSTRAINT IF EXISTS "company_documents_company_id_fkey";
ALTER TABLE "company_documents"
  ADD CONSTRAINT "company_documents_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "company_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "event_type" TEXT,
    "event_date" DATE NOT NULL,
    "end_date" DATE,
    "comment" TEXT,
    "url" TEXT,
    "source_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_events_company_id_event_date_title_key"
  ON "company_events"("company_id", "event_date", "title");

CREATE INDEX IF NOT EXISTS "company_events_company_id_event_date_idx"
  ON "company_events"("company_id", "event_date");

ALTER TABLE "company_events"
  DROP CONSTRAINT IF EXISTS "company_events_company_id_fkey";
ALTER TABLE "company_events"
  ADD CONSTRAINT "company_events_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
