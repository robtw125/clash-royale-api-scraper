import 'dotenv/config';
import { fectchRecentBattles, fetchCards } from './api.js';
import { upsertCard, getOrCreateDeck } from './database.js';

async function main() {
  const cards = await fetchCards();
  cards.items.forEach(async (card) => await upsertCard(card));

  const battles = await fectchRecentBattles('#RCLC0J0YQ');

  const mostRecentBattle = battles[0];

  if (!mostRecentBattle) return;

  const teamMember = mostRecentBattle.opponent[0];

  if (!teamMember) return;

  const usedDeck = await getOrCreateDeck(teamMember.cards);
  console.log(usedDeck.id);
}

main();
