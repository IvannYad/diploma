import type { Article, NewsResponse } from '../types/news';
import type { ClusterInfo } from '../types/pipeline';
import {
  getCachedClusters,
  getCachedNews,
  setCachedClusters,
  setCachedNews,
} from './cache';
import { API_BASE } from '../config/env';
import { withMongoUri } from '../lib/mongoHeaders';

export const PAGE_SIZE = 20;

export type { ClusterInfo };

export async function fetchClusters(): Promise<ClusterInfo[]> {
  const cached = getCachedClusters();
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/api/clusters`, { headers: withMongoUri() });
  if (!res.ok) return [];
  const data = await res.json();
  const clusters = (data as { clusters: ClusterInfo[] }).clusters ?? [];
  setCachedClusters(clusters);
  return clusters;
}

export async function fetchNews(
  page: number,
  query = '',
  clusters: string[] = [],
  minClusterSize = 0,
  dateFrom = '',
  dateTo = '',
): Promise<NewsResponse> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  if (query.trim()) params.set('q', query.trim());
  clusters.forEach((c) => params.append('cluster', c));
  if (minClusterSize > 0) params.set('min_cluster_size', String(minClusterSize));
  if (dateFrom.trim()) params.set('date_from', dateFrom.trim());
  if (dateTo.trim()) params.set('date_to', dateTo.trim());

  const cacheKey = params.toString();
  const cached = getCachedNews(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/api/news?${params}`, { headers: withMongoUri() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  const result = (await res.json()) as NewsResponse;
  setCachedNews(cacheKey, result);
  return result;
}

export async function fetchArticleById(id: string): Promise<Article | null> {
  const res = await fetch(`${API_BASE}/api/news/${encodeURIComponent(id)}`, { headers: withMongoUri() });
  if (!res.ok) return null;
  return res.json();
}

export {
  fetchChartConfig,
  fetchChartData,
  fetchFindSubcluster,
  invalidateCache,
  invalidateChartConfigCache,
} from './charts';

export {
  fetchOlapSchemaTree,
  rebuildOlapSchemas,
  getRebuildProgress,
} from './olap';

export type {
  OlapClusterTree,
  OlapSchemaPayload,
  OlapSchemaTree,
  RebuildProcessStatus,
} from '../types/olap';

export { startPipeline, fetchPipelineStatus } from './pipeline';

export type { PipelineStatus, StartPipelineRequest, StartPipelineResponse } from '../types/pipeline';
