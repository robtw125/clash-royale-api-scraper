import { PrismaClient, type Card } from '../generated/prisma/client.js';

export class CardIdentifier {
  constructor(public supercellId: number, public isEvolution: boolean) {}

  toString() {
    return `${this.supercellId}-${this.isEvolution ? 1 : 0}`;
  }
}

export class CardCache {
  private content: Map<string, Card> = new Map();

  constructor(private prisma: PrismaClient) {}

  async getOrThrow(identifier: CardIdentifier) {
    const key = identifier.toString();
    const storedId = this.content.get(key);

    if (!storedId) {
      console.warn(
        `Die Karte ${key} wurde nicht im Cache gefunden, suche in der Datenbank.`
      );

      const card = await this.prisma.card.findUnique({
        where: {
          supercellId_isEvolution: {
            supercellId: identifier.supercellId,
            isEvolution: identifier.isEvolution,
          },
        },
      });

      if (!card)
        throw new Error(
          `Die Karte ${key} wurde nicht in der Datenbank gefunden.`
        );

      this.content.set(key, card);
      return card;
    }

    return storedId;
  }
}
