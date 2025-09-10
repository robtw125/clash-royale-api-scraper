import { PrismaClient } from '../generated/prisma/client.js';
import { cardSchema, playedCardSchema } from './schemas.js';

import z from 'zod';

type CardData = z.infer<typeof cardSchema>;
type PlayedCardData = z.infer<typeof playedCardSchema>;

const prisma = new PrismaClient();

export async function upsertCard(cardData: CardData) {
  const hasEvolution = cardData.maxEvolutionLevel ? true : false;

  const card = {
    supercellId: cardData.id,
    isEvolution: false,
    name: cardData.name,
    elixirCost: cardData.elixirCost,
    iconUrl: cardData.iconUrls.medium,
    Rarity: {
      connect: {
        name: cardData.rarity,
      },
    },
  };

  await prisma.card.upsert({
    where: {
      supercellId_isEvolution: {
        supercellId: cardData.id,
        isEvolution: false,
      },
    },
    create: card,
    update: card,
  });

  if (!hasEvolution) return;

  card.isEvolution = true;

  if (cardData.iconUrls.evolutionMedium)
    card.iconUrl = cardData.iconUrls.evolutionMedium;

  await prisma.card.upsert({
    where: {
      supercellId_isEvolution: {
        supercellId: cardData.id,
        isEvolution: true,
      },
    },
    create: card,
    update: card,
  });
}

export async function getDeckById() {}

export async function getOrCreateDeck(playedCardsData: PlayedCardData[]) {
  return await prisma.$transaction(async (tx) => {
    const cardQueries = playedCardsData.map((playedCardData) => ({
      supercellId: playedCardData.id,
      isEvolution: playedCardData.evolutionLevel ? true : false,
    }));

    const cardIds = (
      await tx.card.findMany({
        where: { OR: cardQueries },
        select: { id: true },
      })
    ).map((card) => card.id);

    const existingDeck = await tx.deck.findFirst({
      where: {
        Cards: {
          every: {
            id: {
              in: cardIds,
            },
          },
        },
      },
    });

    if (existingDeck) return existingDeck;

    return await tx.deck.create({
      data: {
        Cards: {
          connect: cardIds.map((id) => ({ id })),
        },
      },
    });
  });
}

export async function getOrCreateBattle() {}
