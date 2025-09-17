/*
  Warnings:

  - Added the required column `outcome` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."Outcome" AS ENUM ('WIN', 'LOOSE', 'DRAW');

-- AlterTable
ALTER TABLE "public"."Team" ADD COLUMN     "outcome" "public"."Outcome" NOT NULL;
