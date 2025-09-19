import axios from 'axios';
import { ZodType } from 'zod';
import { cardsReponse, recentBattlesResponse } from './schemas.js';

const HOST = 'https://api.clashroyale.com/v1';

function getHeaders() {
  const apiToken = process.env.API_TOKEN;

  if (!apiToken) throw new Error('API_TOKEN is not set');

  return { Authorization: `Bearer ${apiToken}` };
}

async function get<T extends ZodType>(url: string, schema: T) {
  const response = await axios.get(url, { headers: getHeaders() });
  return schema.parse(response.data);
}

export async function fetchCards() {
  const url = `${HOST}/cards`;
  return get(url, cardsReponse);
}

export async function fetchRecentBattles(playerTag: string) {
  const encodedPlayerTag = encodeURIComponent(playerTag);
  const url = `${HOST}/players/${encodedPlayerTag}/battlelog`;
  return get(url, recentBattlesResponse);
}
