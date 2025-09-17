/*
  Warnings:

  - Added the required column `isSupport` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "isSupport" BOOLEAN NOT NULL;
