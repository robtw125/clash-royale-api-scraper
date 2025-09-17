import z from 'zod';

export const CompactDateString = z
  .string()
  .regex(/^\d{8}T\d{6}\.\d{3}Z$/, 'Ungültiges Datum-Format')
  .transform((val) => {
    // Beispiel val: "20250908T071045.000Z"
    const iso = val.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/,
      '$1-$2-$3T$4:$5:$6.$7Z'
    );

    return new Date(iso);
  });

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
  tag: z.string(),
  cards: z.array(playedCardSchema),
  supportCards: z.array(playedCardSchema),
  crowns: z.number(),
  startingTrophies: z.number().positive().int().optional(),
});

export const gameModeSchema = z.object({
  id: z.number().positive().int(),
  name: z.string(),
});

export const battleSchema = z.object({
  battleTime: CompactDateString,
  team: z.array(playerBattleDataSchema),
  opponent: z.array(playerBattleDataSchema),
  gameMode: gameModeSchema,
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
export const cardsReponse = responseWithPaging(cardSchema).extend({
  supportItems: z.array(cardSchema),
});
