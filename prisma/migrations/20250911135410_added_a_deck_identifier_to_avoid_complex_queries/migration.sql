/*
  Warnings:

  - A unique constraint covering the columns `[identifier]` on the table `Deck` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `identifier` to the `Deck` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Deck" ADD COLUMN     "identifier" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Deck_identifier_key" ON "public"."Deck"("identifier");
