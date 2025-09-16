import 'dotenv/config';
import { fectchRecentBattles, fetchCards } from './api.js';
import {
  upsertCard,
  getOrCreateBattle,
  getNeverFetchedPlayers,
  updatePlayerFetch,
  loadCardCache,
} from './database.js';

async function main() {
  const cards = await fetchCards();

  for (const card of cards.items) {
    await upsertCard(card);
  }

  await loadCardCache();

  await loadBattles(3, 5000, 1500);
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadBattles(
  maxDepth: number,
  maxPlayers: number,
  minDelayMs: number
) {
  let lastFetchTime: null | number = null;
  let fetchedPlayers = 0;

  for (let i = 0; i < maxDepth; i++) {
    const playersToCheck = await getNeverFetchedPlayers();
    const playerCount = playersToCheck.length;

    if (fetchedPlayers > maxPlayers) {
      console.log('Äußerer Loop: Max Anzahl Player erreicht!');
      break;
    }

    for (let j = 0; j < playerCount; j++) {
      if (fetchedPlayers > maxPlayers) {
        console.log('Innerer Loop: Max Anzahl Player erreicht!');
        break;
      }

      if (lastFetchTime) {
        const timeSinceFetch = Date.now() - lastFetchTime;
        console.log(`Dauer der letzten Anfrage: ${timeSinceFetch}`);

        if (timeSinceFetch < minDelayMs) {
          console.log('Dauer unter ' + minDelayMs + 'ms, warte...');
          await wait(minDelayMs - timeSinceFetch);
        }
      }

      lastFetchTime = Date.now();

      console.log(
        `Iteration ${i + 1}/${maxDepth}, Spieler ${j + 1}/${
          playersToCheck.length
        }`
      );

      const player = playersToCheck[j]!;
      const battles = await fectchRecentBattles(player.tag);

      for (const battle of battles) {
        try {
          await getOrCreateBattle(battle);
        } catch (e) {
          if (
            e instanceof Error &&
            e.message.endsWith('nicht im Cache gefunden!')
          ) {
            console.warn('Deck beinhaltet Eventkarte -> Skip');
            continue;
          }
        }
      }

      await updatePlayerFetch(player.tag);
      fetchedPlayers++;
    }
  }
}

main();
