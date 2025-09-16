import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { battleSchema, cardSchema, playedCardSchema } from './schemas.js';
import crypto from 'crypto';

import z from 'zod';

type CardData = z.infer<typeof cardSchema>;
type PlayedCardData = z.infer<typeof playedCardSchema>;
type BattleData = z.infer<typeof battleSchema>;

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

/*export async function getOrCreateDeck(
  playedCardsData: PlayedCardData[],
  tx: Prisma.TransactionClient
) {
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
} */

async function createUniqueDecks(
  battle: BattleData,
  tx: Prisma.TransactionClient
) {
  const playerData = battle.team.concat(battle.opponent);

  const hashToPlayer = new Map<string, string[]>();
  const hashToId = new Map<string, number>();

  // Schritt 1: Iteriere durch alle Spieler und berechne/erhalte Decks
  for (const player of playerData) {
    const cardIds = player.cards.map((card) =>
      getCardIdFromCache({
        supercellId: card.id,
        isEvolution: card.evolutionLevel ? true : false,
      })
    );

    const deckHash = getDeckHash(cardIds);

    // Wenn der Deck-Hash nicht existiert, dann erstell das Deck und füge es hinzu
    if (!hashToPlayer.has(deckHash)) {
      const deck = await perfGetOrCreateDeck(player.cards, tx);
      hashToId.set(deckHash, deck.id);
      hashToPlayer.set(deckHash, [player.tag]); // Erstelle neue Liste mit dem Spieler-Tag
    } else {
      // Wenn der Deck-Hash schon existiert, füge das Spieler-Tag der Liste hinzu
      hashToPlayer.get(deckHash)!.push(player.tag);
    }
  }

  // Schritt 2: Erstelle eine Map von PlayerTags zu Deck-IDs
  const playerToDeckId = new Map<string, number>();

  hashToPlayer.forEach((playerTags, deckHash) => {
    const deckId = hashToId.get(deckHash)!;
    playerTags.forEach((playerTag) => {
      playerToDeckId.set(playerTag, deckId);
    });
  });

  return playerToDeckId;
}

export async function getOrCreateBattle(battle: BattleData) {
  return prisma.$transaction(
    async (tx) => {
      const existingBattle = await tx.battle.findFirst({
        where: {
          time: battle.battleTime,
          Team: {
            some: {
              TeamMember: {
                some: {
                  playerTag: battle.team[0]?.tag ?? 'test',
                },
              },
            },
          },
        },
        include: {
          Team: {
            include: {
              TeamMember: true,
            },
          },
        },
      });

      if (existingBattle) return existingBattle;

      const playerTagToDeckId = await createUniqueDecks(battle, tx);

      return tx.battle.create({
        data: {
          time: battle.battleTime,
          Team: {
            create: [
              {
                crowns: battle.team[0]?.crowns ?? 0,
                TeamMember: {
                  create: await Promise.all(
                    battle.team.map(async (teamMember) => ({
                      startingTrophies: teamMember.startingTrophies ?? null,
                      Deck: {
                        connect: {
                          id: playerTagToDeckId.get(teamMember.tag)!,
                        },
                      },
                      Player: {
                        connectOrCreate: {
                          where: {
                            tag: teamMember.tag,
                          },
                          create: {
                            tag: teamMember.tag,
                          },
                        },
                      },
                    }))
                  ),
                },
              },
              {
                crowns: battle.opponent[0]?.crowns ?? 0,
                TeamMember: {
                  create: await Promise.all(
                    battle.opponent.map(async (teamMember) => ({
                      startingTrophies: teamMember.startingTrophies ?? null,
                      Deck: {
                        connect: {
                          id: playerTagToDeckId.get(teamMember.tag)!,
                        },
                      },
                      Player: {
                        connectOrCreate: {
                          where: {
                            tag: teamMember.tag,
                          },
                          create: {
                            tag: teamMember.tag,
                          },
                        },
                      },
                    }))
                  ),
                },
              },
            ],
          },
          GameMode: {
            connectOrCreate: {
              where: {
                id: battle.gameMode.id,
              },
              create: { id: battle.gameMode.id, name: battle.gameMode.name },
            },
          },
        },
      });
    },
    { isolationLevel: 'ReadUncommitted' }
  );
}

export async function getNeverFetchedPlayers() {
  return prisma.player.findMany({ where: { lastUpdated: null } });
}

export async function updatePlayerFetch(playerTag: string) {
  await prisma.player.update({
    where: { tag: playerTag },
    data: { lastUpdated: new Date() },
  });
}

type CardIdentifier = { supercellId: number; isEvolution: boolean };

const cardCache = new Map<string, number>();

function getCardIdentifierString(cardIdentifier: CardIdentifier) {
  const { supercellId, isEvolution } = cardIdentifier;
  return `${supercellId}-${isEvolution ? 1 : 0}`;
}

function getCardIdFromCache(cardIdentifier: CardIdentifier) {
  const identifierString = getCardIdentifierString(cardIdentifier);
  const cardId = cardCache.get(identifierString);

  if (!cardId)
    throw new Error(
      'Identifier ' + identifierString + ' nicht im Cache gefunden!'
    );

  return cardId;
}

export async function loadCardCache() {
  const cards = await prisma.card.findMany();

  for (const card of cards) {
    const identifierString = getCardIdentifierString({
      supercellId: card.supercellId,
      isEvolution: card.isEvolution,
    });

    cardCache.set(identifierString, card.id);
  }
}

function getDeckHash(cardIds: number[]) {
  const sortedId = cardIds.sort();
  const hashContent = sortedId.join('-');
  return crypto.createHash('sha256').update(hashContent).digest('hex');
}

async function perfGetOrCreateDeck(
  playedCards: PlayedCardData[],
  tx: Prisma.TransactionClient
) {
  const cardIdentifiers = playedCards.map((card) => ({
    supercellId: card.id,
    isEvolution: card.evolutionLevel ? true : false,
  }));

  const cardIds = cardIdentifiers.map((identifier) =>
    getCardIdFromCache(identifier)
  );

  const deckHash = getDeckHash(cardIds);
  const existingDeck = await tx.deck.findUnique({ where: { hash: deckHash } });

  if (existingDeck) return existingDeck;

  return tx.deck.create({
    data: {
      hash: deckHash,
      Cards: {
        connect: cardIds.map((id) => ({
          id,
        })),
      },
    },
  });
}
