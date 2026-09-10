-- CreateTable
CREATE TABLE "chart_analyses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "drawings" JSONB NOT NULL DEFAULT '[]',
    "indicators" JSONB NOT NULL,
    "range" TEXT NOT NULL DEFAULT '1A',
    "candle_interval" TEXT NOT NULL DEFAULT '1D',
    "compare_tickers" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chart_analyses_user_id_ticker_idx" ON "chart_analyses"("user_id", "ticker");

-- CreateIndex
CREATE INDEX "chart_analyses_user_id_updated_at_idx" ON "chart_analyses"("user_id", "updated_at");

-- AddForeignKey
ALTER TABLE "chart_analyses" ADD CONSTRAINT "chart_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
