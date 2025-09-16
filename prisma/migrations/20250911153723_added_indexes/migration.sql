-- CreateIndex
CREATE INDEX "Battle_time_idx" ON "public"."Battle"("time");

-- CreateIndex
CREATE INDEX "Deck_hash_idx" ON "public"."Deck"("hash");

-- CreateIndex
CREATE INDEX "Team_battleId_idx" ON "public"."Team"("battleId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_playerTag_idx" ON "public"."TeamMember"("teamId", "playerTag");
