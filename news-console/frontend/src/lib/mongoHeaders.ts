import { MONGO_URI_KEY } from './session';

export const MONGO_URI_HEADER = 'X-Mongo-Uri';

export function withMongoUri(headers: HeadersInit = {}): HeadersInit {
  const uri = sessionStorage.getItem(MONGO_URI_KEY)?.trim();
  if (!uri) return headers;

  const merged = new Headers(headers);
  merged.set(MONGO_URI_HEADER, uri);
  return merged;
}
