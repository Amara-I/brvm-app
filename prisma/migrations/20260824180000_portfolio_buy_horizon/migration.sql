-- CreateEnum
CREATE TYPE "buy_horizon" AS ENUM ('COURT', 'MOYEN', 'LONG');

-- AlterTable
ALTER TABLE "portfolio_holdings" ADD COLUMN "buy_horizon" "buy_horizon" NOT NULL DEFAULT 'MOYEN';
