import type { ChartConfigFile, ChartDataFile } from '../types/news';
import { API_BASE } from '../config/env';
import { withMongoUri } from '../lib/mongoHeaders';
import {
  getCachedChartConfig,
  getCachedChartData,
  setCachedChartConfig,
  setCachedChartData,
} from './cache';

export { invalidateChartConfigCache, invalidateCache } from './cache';

export async function fetchFindSubcluster(cluster: string, articleId: string): Promise<string> {
  const params = new URLSearchParams({ cluster, article_id: articleId });
  const res = await fetch(`${API_BASE}/api/find-subcluster?${params}`, { headers: withMongoUri() });
  if (!res.ok) return '';
  const data = (await res.json()) as { scId?: string };
  return data.scId ?? '';
}

export async function fetchChartConfig(cluster: string, scId: string): Promise<ChartConfigFile> {
  const key = `${cluster}::${scId}`;
  const cached = getCachedChartConfig(key);
  if (cached) return cached;

  const params = new URLSearchParams({ cluster, sc_id: scId });
  const res = await fetch(`${API_BASE}/api/chart-config?${params}`, { headers: withMongoUri() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  const result = (await res.json()) as ChartConfigFile;
  setCachedChartConfig(key, result);
  return result;
}

export async function fetchChartData(cluster: string, scId: string): Promise<ChartDataFile> {
  const key = `${cluster}::${scId}`;
  const cached = getCachedChartData(key);
  if (cached) return cached;

  const params = new URLSearchParams({ cluster, sc_id: scId });
  const res = await fetch(`${API_BASE}/api/chart-data?${params}`, { headers: withMongoUri() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  const result = (await res.json()) as ChartDataFile;
  setCachedChartData(key, result);
  return result;
}
