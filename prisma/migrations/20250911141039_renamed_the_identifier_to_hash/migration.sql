/*
  Warnings:

  - You are about to drop the column `identifier` on the `Deck` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hash]` on the table `Deck` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hash` to the `Deck` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Deck_identifier_key";

-- AlterTable
ALTER TABLE "public"."Deck" DROP COLUMN "identifier",
ADD COLUMN     "hash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Deck_hash_key" ON "public"."Deck"("hash");
