import { PrismaClient, Prisma, type Card } from '../generated/prisma/client.js';
import { battleSchema, cardSchema, playedCardSchema } from './schemas.js';
import crypto from 'crypto';

import { CardCache, CardIdentifier } from './card-cache.js';

import z from 'zod';

type CardData = z.infer<typeof cardSchema>;
type PlayedCardData = z.infer<typeof playedCardSchema>;
type BattleData = z.infer<typeof battleSchema>;

const prisma = new PrismaClient();
const cardCache = new CardCache(prisma);

export async function upsertCard(cardData: CardData, isSupport: boolean) {
  const hasEvolution = cardData.maxEvolutionLevel ? true : false;

  const card = {
    supercellId: cardData.id,
    isEvolution: false,
    name: cardData.name,
    elixirCost: cardData.elixirCost,
    iconUrl: cardData.iconUrls.medium,
    isSupport,
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

/** 

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
*/
async function getOrCreateBattle() {}

export class DeckFactory {
  private cards: Card[] = [];
  private static readonly MAX_CARDS = 9;

  private hasCardVersion(card: Card): boolean {
    return this.cards.some((c) => c.supercellId === card.supercellId);
  }

  private hasSupportCard(): boolean {
    return this.cards.some((c) => c.isSupport);
  }

  private allSupercellIdsUnique(): boolean {
    const supercellIds = this.cards.map((c) => c.supercellId);
    return new Set(supercellIds).size === supercellIds.length;
  }

  private isDeckComplete(): boolean {
    return this.cards.length === DeckFactory.MAX_CARDS;
  }

  private hasExactlyOneSupportCard(): boolean {
    return this.cards.filter((c) => c.isSupport).length === 1;
  }

  private isValid(): boolean {
    return (
      this.allSupercellIdsUnique() &&
      this.isDeckComplete() &&
      this.hasExactlyOneSupportCard()
    );
  }

  async addCard(identifier: CardIdentifier): Promise<void> {
    const card = await cardCache.getOrThrow(identifier);

    if (this.cards.length >= DeckFactory.MAX_CARDS) {
      throw new Error(
        `Cannot add card: deck already contains the maximum of ${DeckFactory.MAX_CARDS} cards.`
      );
    }

    if (this.hasCardVersion(card)) {
      throw new Error(
        `Cannot add card: a card with supercellId "${card.supercellId}" is already in the deck.`
      );
    }

    if (card.isSupport && this.hasSupportCard()) {
      throw new Error(
        'Cannot add card: the deck already contains a support card.'
      );
    }

    this.cards.push(card);
  }

  getHash(): string {
    const sortedCardIds = [...this.cards.map((c) => c.id)].sort();
    const textToHash = sortedCardIds.join('-');
    return crypto.createHash('sha256').update(textToHash).digest('hex');
  }

  async getOrCreate(transaction: Prisma.TransactionClient) {
    if (!this.isValid()) {
      throw new Error(
        'Cannot create deck: deck does not meet all constraints (unique supercellIds, complete, exactly one support card).'
      );
    }

    const existingDeck = await transaction.deck.findUnique({
      where: { hash: this.getHash() },
    });

    if (existingDeck) return existingDeck;

    return transaction.deck.create({
      data: {
        hash: this.getHash(),
        Cards: {
          connect: this.cards.map((c) => ({ id: c.id })),
        },
      },
    });
  }
}
