import { withMongoUri } from '../lib/mongoHeaders';
import { MONGO_URI_KEY, getAuthToken } from '../lib/session';
import type {
  OlapSchemaPayload,
  OlapSchemaTree,
  RebuildProcessStatus,
} from '../types/olap';
import { API_BASE } from '../config/env';
import { getCachedOlapTree, setCachedOlapTree } from './cache';

export type {
  OlapClusterTree,
  OlapSchemaPayload,
  OlapSchemaTree,
  RebuildProcessStatus,
} from '../types/olap';

export async function fetchOlapSchemaTree(): Promise<OlapSchemaTree> {
  const cached = getCachedOlapTree();
  if (cached) return cached;

  const mongoUri = sessionStorage.getItem(MONGO_URI_KEY) ?? '';
  const params = new URLSearchParams();
  if (mongoUri.trim()) {
    params.set('mongo_uri', mongoUri.trim());
  }

  const url = params.size > 0
    ? `${API_BASE}/api/olap-schemas/tree?${params}`
    : `${API_BASE}/api/olap-schemas/tree`;

  const res = await fetch(url, { headers: withMongoUri() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }

  const data = (await res.json()) as OlapSchemaTree;
  setCachedOlapTree(data);
  return data;
}

export async function rebuildOlapSchemas(
  cluster: string,
  subcluster: string,
  schema: OlapSchemaPayload,
): Promise<RebuildProcessStatus> {
  const mongoDbServerUrl = sessionStorage.getItem(MONGO_URI_KEY) ?? '';
  const token = getAuthToken();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/olap-rebuild/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      cluster,
      subcluster,
      schema,
      mongoDbServerUrl,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }

  return data as RebuildProcessStatus;
}

export async function getRebuildProgress(processId: string): Promise<RebuildProcessStatus> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params = new URLSearchParams({ processId });
  const res = await fetch(`${API_BASE}/api/olap-rebuild/progress?${params}`, { headers });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }

  return data as RebuildProcessStatus;
}
