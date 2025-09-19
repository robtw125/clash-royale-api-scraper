import {
  PrismaClient,
  Prisma,
  type Card,
  Outcome,
} from '../generated/prisma/client.js';
import {
  battleSchema,
  cardSchema,
  playedCardSchema,
  playerBattleDataSchema,
} from './schemas.js';
import crypto from 'crypto';

import { CardCache, CardIdentifier } from './card-cache.js';

import z from 'zod';

type CardData = z.infer<typeof cardSchema>;
type PlayedCardData = z.infer<typeof playedCardSchema>;
type BattleData = z.infer<typeof battleSchema>;
type PlayerBattleData = z.infer<typeof playerBattleDataSchema>;

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

export async function getUnfetchedPlayers() {
  return prisma.player.findMany({
    where: {
      lastUpdated: null,
    },
  });
}

export async function updatePlayer(tag: string) {
  await prisma.player.update({
    where: {
      tag,
    },
    data: {
      lastUpdated: new Date(),
    },
  });
}

//Maybe sowas wie eine "TeamConverter" Klasse! -> Nimmt API Anfrage und convertet sie in wunderbare DB Klassen
//Vielleicht auch, dass sie einfach so CreateXType zurückgeben, sodass ich sie direkt in prisma queries einbauen kann!
//Hier auch eine möglichkeit, battle im bulk erstellen zu können!!!
//Fehlermeldung der DeckFactory verbessern!

class TeamMember {
  public playerTag: string;
  public startingTrophies: number | null;
  public deck: DeckFactory = new DeckFactory();

  constructor(private playerData: PlayerBattleData) {
    this.playerTag = playerData.tag;
    this.startingTrophies = playerData.startingTrophies ?? null;
  }

  async initializeDeck() {
    for (const card of this.playerData.cards.concat(
      this.playerData.supportCards
    )) {
      await this.deck.addCard(
        new CardIdentifier(card.id, card.evolutionLevel ? true : false)
      );
    }
  }

  private getCardIdentifier(cardData: PlayedCardData) {
    return new CardIdentifier(
      cardData.id,
      cardData.maxEvolutionLevel ? true : false
    );
  }

  public getCreateData() {
    return {
      startingTrophies: this.startingTrophies,
      Player: {
        connectOrCreate: {
          where: {
            tag: this.playerTag,
          },
          create: {
            tag: this.playerTag,
          },
        },
      },
      Deck: {
        connect: {
          hash: this.deck.getHash(),
        },
      },
    };
  }
}

class Team {
  private crowns: number;
  private members: TeamMember[] = [];

  constructor(private playerData: PlayerBattleData[]) {
    if (playerData.length <= 0) throw new Error();

    this.crowns = playerData[0]!.crowns;

    for (const player of playerData) {
      this.members.push(new TeamMember(player));
    }
  }

  getCrowns() {
    return this.crowns;
  }

  getOutcome(opposingTeam: Team) {
    const crownDifference = this.crowns - opposingTeam.getCrowns();

    if (crownDifference > 0) {
      return Outcome.WIN;
    }

    if (crownDifference < 0) {
      return Outcome.LOSS;
    }

    return Outcome.DRAW;
  }

  getMembers() {
    return this.members;
  }

  getCreateData(opposingTeam: Team) {
    return {
      crowns: this.getCrowns(),
      outcome: this.getOutcome(opposingTeam),
      TeamMember: {
        create: this.members.map((member) => member.getCreateData()),
      },
    };
  }
}

async function createUniqueDecks(
  participants: TeamMember[],
  transaction: Prisma.TransactionClient
) {
  const createdDeckHashes: string[] = [];

  //Scuffed ash (initializing the decks here)
  for (const participant of participants) {
    if (!createdDeckHashes.includes(participant.deck.getHash())) {
      await participant.initializeDeck();
      await participant.deck.getOrCreate(transaction);
      createdDeckHashes.push(participant.deck.getHash());
    }
  }
}

export async function getOrCreateBattle(battleData: BattleData) {
  const teamOne = new Team(battleData.team);
  const teamTwo = new Team(battleData.opponent);

  const participants = teamOne.getMembers().concat(teamTwo.getMembers());

  return await prisma.$transaction(async (tx) => {
    const existingBattle = await tx.battle.findFirst({
      where: {
        time: battleData.battleTime,
        Team: {
          some: {
            TeamMember: {
              some: {
                playerTag: participants[0]!.playerTag,
              },
            },
          },
        },
      },
    });

    if (existingBattle) return existingBattle;

    await createUniqueDecks(participants, tx);

    await tx.battle.create({
      data: {
        time: battleData.battleTime,
        Team: {
          create: [
            teamOne.getCreateData(teamTwo),
            teamTwo.getCreateData(teamOne),
          ],
        },
        GameMode: {
          connectOrCreate: {
            where: {
              id: battleData.gameMode.id,
            },
            create: {
              id: battleData.gameMode.id,
              name: battleData.gameMode.name,
            },
          },
        },
      },
    });
  });
}

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
      console.warn(
        this.allSupercellIdsUnique(),
        this.isDeckComplete(),
        this.hasExactlyOneSupportCard()
      );
      console.warn(this.cards);
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
