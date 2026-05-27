import type { ChartConfigFile, ChartDataFile, NewsResponse } from '../types/news';
import type { OlapSchemaTree } from '../types/olap';
import type { ClusterInfo } from '../types/pipeline';

const NEWS_TTL = 5 * 60 * 1000;
const CLUSTERS_TTL = 10 * 60 * 1000;
const CHART_CONFIG_TTL = 30 * 60 * 1000;
const CHART_DATA_TTL = 30 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const newsCache = new Map<string, CacheEntry<NewsResponse>>();
const chartConfigCache = new Map<string, CacheEntry<ChartConfigFile>>();
const chartDataCache = new Map<string, CacheEntry<ChartDataFile>>();
let olapSchemaTreeCache: CacheEntry<OlapSchemaTree> | null = null;
let clustersCache: CacheEntry<ClusterInfo[]> | null = null;

export function invalidateCache() {
  newsCache.clear();
  clustersCache = null;
  chartConfigCache.clear();
  chartDataCache.clear();
  olapSchemaTreeCache = null;
}

export function invalidateChartConfigCache(cluster: string, scId: string) {
  chartConfigCache.delete(`${cluster}::${scId}`);
  chartDataCache.delete(`${cluster}::${scId}`);
}

export function getCachedNews(key: string) {
  const entry = newsCache.get(key);
  return entry && Date.now() < entry.expires ? entry.data : null;
}

export function setCachedNews(key: string, data: NewsResponse) {
  newsCache.set(key, { data, expires: Date.now() + NEWS_TTL });
}

export function getCachedClusters() {
  return clustersCache && Date.now() < clustersCache.expires ? clustersCache.data : null;
}

export function setCachedClusters(data: ClusterInfo[]) {
  clustersCache = { data, expires: Date.now() + CLUSTERS_TTL };
}

export function getCachedOlapTree() {
  return olapSchemaTreeCache && Date.now() < olapSchemaTreeCache.expires
    ? olapSchemaTreeCache.data
    : null;
}

export function setCachedOlapTree(data: OlapSchemaTree) {
  olapSchemaTreeCache = { data, expires: Date.now() + CLUSTERS_TTL };
}

export function getCachedChartConfig(key: string) {
  const entry = chartConfigCache.get(key);
  return entry && Date.now() < entry.expires ? entry.data : null;
}

export function setCachedChartConfig(key: string, data: ChartConfigFile) {
  chartConfigCache.set(key, { data, expires: Date.now() + CHART_CONFIG_TTL });
}

export function getCachedChartData(key: string) {
  const entry = chartDataCache.get(key);
  return entry && Date.now() < entry.expires ? entry.data : null;
}

export function setCachedChartData(key: string, data: ChartDataFile) {
  chartDataCache.set(key, { data, expires: Date.now() + CHART_DATA_TTL });
}
