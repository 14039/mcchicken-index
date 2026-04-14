/**
 * McChicken Index — Redis Storage
 *
 * Upstash Redis operations for McChicken Index data.
 *
 * Key schema:
 *   dashboard:mcchicken:current   → JSON: current index + components
 *   dashboard:mcchicken:news      → JSON: array of news items
 *   dashboard:mcchicken:history   → Sorted Set: historical price points
 */

import { Redis } from "@upstash/redis";

// ── Types ────────────────────────────────────────────────────────

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
  summary?: string;
}

export interface McChickenCurrentData {
  indexValue: number;
  price: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  regionalPrices: {
    northeast: number | null;
    south: number | null;
    midwest: number | null;
    west: number | null;
  };
  components: {
    cpiFood: number;
    chickenWholesale: number;
    avgFoodServiceWage: number;
    federalMinWage: number;
  };
  lastUpdated: string;
  methodologyVersion: string;
  source: string;
  dataSources: string[];
}

export interface McChickenHistoryPoint {
  date: string;
  price: number;
  indexValue: number;
  source?: string;
}

// ── Redis Client ─────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

// ── Generic Helpers ──────────────────────────────────────────────

async function getJSON<T>(key: string): Promise<T | null> {
  const data = await getRedis().get<T>(key);
  return data ?? null;
}

async function setJSON<T>(key: string, data: T): Promise<void> {
  await getRedis().set(key, JSON.stringify(data));
}

// ── McChicken Index ──────────────────────────────────────────────

const MCCHICKEN_CURRENT_KEY = "dashboard:mcchicken:current";
const MCCHICKEN_NEWS_KEY = "dashboard:mcchicken:news";
const MCCHICKEN_HISTORY_KEY = "dashboard:mcchicken:history";

export async function getMcChickenCurrent(): Promise<McChickenCurrentData | null> {
  return getJSON<McChickenCurrentData>(MCCHICKEN_CURRENT_KEY);
}

export async function setMcChickenCurrent(data: McChickenCurrentData): Promise<void> {
  await setJSON(MCCHICKEN_CURRENT_KEY, data);
}

export async function getMcChickenNews(): Promise<NewsItem[]> {
  const news = await getJSON<NewsItem[]>(MCCHICKEN_NEWS_KEY);
  return news ?? [];
}

export async function setMcChickenNews(items: NewsItem[]): Promise<void> {
  await setJSON(MCCHICKEN_NEWS_KEY, items);
}

export async function appendMcChickenHistory(
  point: McChickenHistoryPoint
): Promise<void> {
  const score = new Date(point.date).getTime();
  const member = JSON.stringify(point);
  await getRedis().zadd(MCCHICKEN_HISTORY_KEY, { score, member });
}

export async function batchAppendMcChickenHistory(
  points: McChickenHistoryPoint[]
): Promise<void> {
  const pipeline = getRedis().pipeline();
  for (const point of points) {
    const score = new Date(point.date).getTime();
    const member = JSON.stringify(point);
    pipeline.zadd(MCCHICKEN_HISTORY_KEY, { score, member });
  }
  await pipeline.exec();
}

export async function getMcChickenHistory(
  startDate?: string,
  endDate?: string
): Promise<McChickenHistoryPoint[]> {
  const min = startDate ? new Date(startDate).getTime() : 0;
  const max = endDate ? new Date(endDate).getTime() : Date.now();
  const raw = await getRedis().zrange<string[]>(MCCHICKEN_HISTORY_KEY, min, max, { byScore: true });
  return raw.map((s) => (typeof s === "string" ? JSON.parse(s) : s));
}
