import z from 'zod';

export const locationSchema = z.object({
  id: z.number().positive().int(),
  name: z.string(),
  isCountry: z.boolean(),
  countryCode: z.string().length(2).optional(),
});

export const cardSchema = z.object({
  id: z.number().positive().int(),
  name: z.string(),
  rarity: z.string(),
  maxLevel: z.number().positive().int(),
  elixirCost: z.number().positive().int().nullable().default(null),
  maxEvolutionLevel: z.number().positive().int().optional(),
  iconUrls: z.object({
    medium: z.url(),
    evolutionMedium: z.url().optional(),
  }),
});

export const playedCardSchema = cardSchema.extend({
  evolutionLevel: z.number().positive().int().optional(),
});

export const playerBattleDataSchema = z.object({
  cards: z.array(playedCardSchema),
});

export const battleSchema = z.object({
  battleTime: z.string(),
  team: z.array(playerBattleDataSchema),
  opponent: z.array(playerBattleDataSchema),
});

export const recentBattlesResponse = z.array(battleSchema);

const pagingSchema = z.object({
  cursors: z.object({
    before: z.string().optional(),
    after: z.string().optional(),
  }),
});

const responseWithPaging = <T extends z.ZodType>(schema: T) =>
  z.object({
    items: z.array(schema),
    paging: pagingSchema.optional(),
  });

export const locationsResponse = responseWithPaging(locationSchema);
export const cardsReponse = responseWithPaging(cardSchema);
