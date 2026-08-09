-- CreateEnum
CREATE TYPE "data_source" AS ENUM ('BRVM_OFFICIEL', 'SIKAFINANCE', 'RICHBOURSE', 'MANUEL');

-- CreateEnum
CREATE TYPE "ingestion_status" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED', 'RUNNING');

-- CreateEnum
CREATE TYPE "holding_side" AS ENUM ('ACHAT', 'VENTE');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flag_emoji" TEXT NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isin" TEXT,
    "country_id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "color" TEXT NOT NULL,
    "description" TEXT,
    "listed_since" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close_price" DECIMAL(14,2) NOT NULL,
    "volume" BIGINT,
    "source" "data_source" NOT NULL,
    "is_canonical" BOOLEAN NOT NULL DEFAULT false,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividends" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "ex_date" DATE,
    "payment_date" DATE,
    "source" "data_source" NOT NULL,
    "is_canonical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_ratios" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "per" DECIMAL(8,2),
    "mkt_cap" DECIMAL(14,2),
    "roe" DECIMAL(6,2),
    "net_margin" DECIMAL(6,2),
    "source" "data_source" NOT NULL,
    "is_canonical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_ratios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_discrepancies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "field" TEXT NOT NULL,
    "brvm_value" DECIMAL(14,4),
    "sika_value" DECIMAL(14,4),
    "rich_value" DECIMAL(14,4),
    "delta_percent" DECIMAL(6,2),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_value" DECIMAL(14,4),
    "resolved_source" "data_source",
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_logs" (
    "id" TEXT NOT NULL,
    "source" "data_source" NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" "ingestion_status" NOT NULL DEFAULT 'RUNNING',
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_inserted" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_indices" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "market_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_index_values" (
    "id" TEXT NOT NULL,
    "market_index_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "change_percent" DECIMAL(6,2),
    "volume" BIGINT,
    "source" "data_source" NOT NULL,
    "is_canonical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_index_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "url" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "company_id" TEXT,
    "image_url" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "image" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "email_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mon portefeuille',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_holdings" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "avg_buy_price" DECIMAL(14,2) NOT NULL,
    "last_side" "holding_side" NOT NULL DEFAULT 'ACHAT',
    "buy_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_name_key" ON "sectors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_slug_key" ON "sectors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_ticker_key" ON "companies"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "companies_isin_key" ON "companies"("isin");

-- CreateIndex
CREATE INDEX "companies_sector_id_idx" ON "companies"("sector_id");

-- CreateIndex
CREATE INDEX "companies_country_id_idx" ON "companies"("country_id");

-- CreateIndex
CREATE INDEX "price_history_company_id_date_idx" ON "price_history"("company_id", "date");

-- CreateIndex
CREATE INDEX "price_history_date_idx" ON "price_history"("date");

-- CreateIndex
CREATE UNIQUE INDEX "price_history_company_id_date_source_key" ON "price_history"("company_id", "date", "source");

-- CreateIndex
CREATE INDEX "dividends_company_id_year_idx" ON "dividends"("company_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "dividends_company_id_year_source_key" ON "dividends"("company_id", "year", "source");

-- CreateIndex
CREATE INDEX "financial_ratios_company_id_year_idx" ON "financial_ratios"("company_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "financial_ratios_company_id_year_source_key" ON "financial_ratios"("company_id", "year", "source");

-- CreateIndex
CREATE INDEX "data_discrepancies_company_id_date_idx" ON "data_discrepancies"("company_id", "date");

-- CreateIndex
CREATE INDEX "data_discrepancies_resolved_idx" ON "data_discrepancies"("resolved");

-- CreateIndex
CREATE INDEX "ingestion_logs_source_run_at_idx" ON "ingestion_logs"("source", "run_at");

-- CreateIndex
CREATE INDEX "ingestion_logs_status_idx" ON "ingestion_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "market_indices_code_key" ON "market_indices"("code");

-- CreateIndex
CREATE INDEX "market_index_values_market_index_id_date_idx" ON "market_index_values"("market_index_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "market_index_values_market_index_id_date_source_key" ON "market_index_values"("market_index_id", "date", "source");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_slug_key" ON "news_articles"("slug");

-- CreateIndex
CREATE INDEX "news_articles_published_at_idx" ON "news_articles"("published_at");

-- CreateIndex
CREATE INDEX "news_articles_company_id_idx" ON "news_articles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "portfolios_user_id_idx" ON "portfolios"("user_id");

-- CreateIndex
CREATE INDEX "portfolio_holdings_portfolio_id_idx" ON "portfolio_holdings"("portfolio_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_holdings_portfolio_id_company_id_key" ON "portfolio_holdings"("portfolio_id", "company_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_ratios" ADD CONSTRAINT "financial_ratios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_discrepancies" ADD CONSTRAINT "data_discrepancies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_index_values" ADD CONSTRAINT "market_index_values_market_index_id_fkey" FOREIGN KEY ("market_index_id") REFERENCES "market_indices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
