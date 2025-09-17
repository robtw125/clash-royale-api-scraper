import { DeckFactory, upsertCard } from './database.js';
import { fetchCards, fectchRecentBattles } from './api.js';
import { CardIdentifier } from './card-cache.js';
import { PrismaClient } from '../generated/prisma/client.js';

async function main() {
  const battles = await fectchRecentBattles('#RCLC0J0YQ');
  const allCards = await fetchCards();

  for (const card of allCards.items) {
    await upsertCard(card, false);
  }

  for (const card of allCards.supportItems) {
    await upsertCard(card, true);
  }

  const factory = new DeckFactory();

  let deckCards = battles[0]!.team[0]!.cards;
  deckCards = deckCards.concat(battles[0]!.team[0]!.supportCards);

  for (const card of deckCards) {
    const identifier = new CardIdentifier(
      card.id,
      card.maxEvolutionLevel ? true : false
    );

    await factory.addCard(identifier);
  }

  const client = new PrismaClient();

  await factory.getOrCreate(client);
}

main();
