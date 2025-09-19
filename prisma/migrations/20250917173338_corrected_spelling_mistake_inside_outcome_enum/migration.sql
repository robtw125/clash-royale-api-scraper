/*
  Warnings:

  - The values [LOOSE] on the enum `Outcome` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Outcome_new" AS ENUM ('WIN', 'LOSS', 'DRAW');
ALTER TABLE "public"."Team" ALTER COLUMN "outcome" TYPE "public"."Outcome_new" USING ("outcome"::text::"public"."Outcome_new");
ALTER TYPE "public"."Outcome" RENAME TO "Outcome_old";
ALTER TYPE "public"."Outcome_new" RENAME TO "Outcome";
DROP TYPE "public"."Outcome_old";
COMMIT;
