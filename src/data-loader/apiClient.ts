import { unwrapApiData } from "../schema/api";

const responseCache = new Map<string, unknown>();
const inflightCache = new Map<string, Promise<unknown>>();

function canCache(init?: RequestInit): boolean {
  const method = init?.method?.toUpperCase() ?? "GET";
  return method === "GET";
}

export async function fetchApiData<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (canCache(init)) {
    const cached = responseCache.get(path);
    if (cached !== undefined) return cached as T;

    const inflight = inflightCache.get(path);
    if (inflight) return inflight as Promise<T>;
  }

  const request = fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  })
    .then(async (response) => {
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? `Request failed with ${response.status}`);
      }

      const data = unwrapApiData<T>(payload);
      if (canCache(init)) responseCache.set(path, data);
      return data;
    })
    .finally(() => {
      if (canCache(init)) inflightCache.delete(path);
    });

  if (canCache(init)) inflightCache.set(path, request);

  return request;
}

export function readApiDataCache<T>(path: string): T | null {
  return (responseCache.get(path) as T | undefined) ?? null;
}

export function clearApiDataCache(): void {
  responseCache.clear();
  inflightCache.clear();
}
