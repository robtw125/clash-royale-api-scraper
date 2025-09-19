import {
  getOrCreateBattle,
  upsertCard,
  updatePlayer,
  getUnfetchedPlayers,
} from './database.js';
import { fetchCards, fetchRecentBattles } from './api.js';

const MIN_TIMEOUT_MS = 1000;
const BATTLES_LIMIT = 100000; // Beispiel: Begrenzung auf 500 Battles

async function wait(ms: number) {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBattles(depth: number, maxBattles: number) {
  let battlesProcessed = 0;
  let lastFetchedAt = 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (let i = 1; i <= depth; i++) {
    console.log(`\n--- Depth: ${i}/${depth} ---`);

    const unfetchedPlayers = await getUnfetchedPlayers();
    if (unfetchedPlayers.length === 0) {
      console.log('No more unfetched players found. Exiting.');
      break;
    }

    for (let j = 0; j < unfetchedPlayers.length; j++) {
      if (battlesProcessed >= maxBattles) {
        console.log(
          `\nMax battle limit of ${maxBattles} reached. Stopping process.`
        );
        return;
      }

      const player = unfetchedPlayers[j]!;

      // Logging für den aktuellen Fortschritt
      console.log(
        `Processing player ${j + 1}/${
          unfetchedPlayers.length
        } in iteration ${i}. Player tag: ${player.tag}`
      );

      const timeSinceLastFetch = Date.now() - lastFetchedAt;
      if (timeSinceLastFetch < MIN_TIMEOUT_MS) {
        const timeToWait = MIN_TIMEOUT_MS - timeSinceLastFetch;
        console.log(`  Waiting ${timeToWait}ms to respect timeout...`);
        await wait(timeToWait);
      }

      console.time(`  Fetch Battles for ${player.tag}`);
      const recentBattles = await fetchRecentBattles(player.tag);
      lastFetchedAt = Date.now();
      console.timeEnd(`  Fetch Battles for ${player.tag}`);

      for (const battle of recentBattles) {
        //Only keep Ladder and ranked1v1 games
        if (
          battle.gameMode.name !== 'Ladder' &&
          !battle.gameMode.name.startsWith('Ranked1v1')
        ) {
          console.log(`Skipping battle of game mode ${battle.gameMode.name}`);
          continue;
        }

        if (battle.battleTime < sevenDaysAgo) {
          console.log(
            `  Skipping battle from ${battle.battleTime.toISOString()} as it's older than 7 days.`
          );
          continue;
        }

        if (battlesProcessed >= maxBattles) {
          console.log(
            `\nMax battle limit of ${maxBattles} reached. Stopping process.`
          );
          return;
        }

        console.time(
          `  Processing battle ${battlesProcessed + 1}/${maxBattles}`
        );
        await getOrCreateBattle(battle);
        console.timeEnd(
          `  Processing battle ${battlesProcessed + 1}/${maxBattles}`
        );
        battlesProcessed++;
      }

      console.time(`  Updating player ${player.tag}`);
      await updatePlayer(player.tag);
      console.timeEnd(`  Updating player ${player.tag}`);
    }
  }
}

async function main() {
  console.log('--- Initializing: Fetching cards and initial player ---');
  const allCards = await fetchCards();

  for (const card of allCards.items) {
    await upsertCard(card, false);
  }

  for (const card of allCards.supportItems) {
    await upsertCard(card, true);
  }

  await updatePlayer('#RCLC0J0YQ');

  console.log('\n--- Starting battle fetching process ---');
  await fetchBattles(3, BATTLES_LIMIT); // Startet den Prozess mit einer Tiefe von 3 und einem Limit von 500 Battles
  console.log('\n--- Process finished ---');
}

main().catch((error) => {
  console.error('An error occurred:', error);
  process.exit(1);
});
