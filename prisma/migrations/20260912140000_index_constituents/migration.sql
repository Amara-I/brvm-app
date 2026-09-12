-- CreateTable
CREATE TABLE "market_index_constituents" (
    "id" TEXT NOT NULL,
    "market_index_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "weight" DECIMAL(8,4),
    "source" "data_source" NOT NULL,
    "as_of" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_index_constituents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_index_constituents_market_index_id_as_of_idx" ON "market_index_constituents"("market_index_id", "as_of");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_index_constituent" ON "market_index_constituents"("market_index_id", "ticker", "as_of", "source");

-- AddForeignKey
ALTER TABLE "market_index_constituents" ADD CONSTRAINT "market_index_constituents_market_index_id_fkey" FOREIGN KEY ("market_index_id") REFERENCES "market_indices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
