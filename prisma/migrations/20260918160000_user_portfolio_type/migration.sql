-- CreateEnum
CREATE TYPE "portfolio_type" AS ENUM ('CROISSANCE', 'RENTE', 'TRADING', 'CROISSANCE_MAX');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "portfolio_type" "portfolio_type";
