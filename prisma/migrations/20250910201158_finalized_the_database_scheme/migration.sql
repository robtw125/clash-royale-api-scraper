/*
  Warnings:

  - A unique constraint covering the columns `[supercellId,isEvolution]` on the table `Card` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `iconUrl` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isEvolution` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rarityId` to the `Card` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supercellId` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
CREATE SEQUENCE "public".card_id_seq;
ALTER TABLE "public"."Card" ADD COLUMN     "elixirCost" INTEGER,
ADD COLUMN     "iconUrl" TEXT NOT NULL,
ADD COLUMN     "isEvolution" BOOLEAN NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "rarityId" INTEGER NOT NULL,
ADD COLUMN     "supercellId" INTEGER NOT NULL,
ALTER COLUMN "id" SET DEFAULT nextval('"public".card_id_seq');
ALTER SEQUENCE "public".card_id_seq OWNED BY "public"."Card"."id";

-- CreateTable
CREATE TABLE "public"."Rarity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startLevel" INTEGER NOT NULL,
    "maxLevel" INTEGER NOT NULL,

    CONSTRAINT "Rarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Deck" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameMode" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GameMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Battle" (
    "id" SERIAL NOT NULL,
    "gameModeId" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" SERIAL NOT NULL,
    "crowns" INTEGER NOT NULL,
    "battleId" INTEGER NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Player" (
    "tag" TEXT NOT NULL,
    "lastUpdated" TIMESTAMP(3),

    CONSTRAINT "Player_pkey" PRIMARY KEY ("tag")
);

-- CreateTable
CREATE TABLE "public"."TeamMember" (
    "playerTag" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "deckId" INTEGER NOT NULL,
    "startingTrophies" INTEGER NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("playerTag","teamId")
);

-- CreateTable
CREATE TABLE "public"."_CardToDeck" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CardToDeck_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rarity_name_key" ON "public"."Rarity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GameMode_name_key" ON "public"."GameMode"("name");

-- CreateIndex
CREATE INDEX "_CardToDeck_B_index" ON "public"."_CardToDeck"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Card_supercellId_isEvolution_key" ON "public"."Card"("supercellId", "isEvolution");

-- AddForeignKey
ALTER TABLE "public"."Card" ADD CONSTRAINT "Card_rarityId_fkey" FOREIGN KEY ("rarityId") REFERENCES "public"."Rarity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Battle" ADD CONSTRAINT "Battle_gameModeId_fkey" FOREIGN KEY ("gameModeId") REFERENCES "public"."GameMode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "public"."Battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_playerTag_fkey" FOREIGN KEY ("playerTag") REFERENCES "public"."Player"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamMember" ADD CONSTRAINT "TeamMember_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "public"."Deck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CardToDeck" ADD CONSTRAINT "_CardToDeck_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CardToDeck" ADD CONSTRAINT "_CardToDeck_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
