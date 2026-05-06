import { unwrapApiData } from "../schema/api";

export async function fetchApiData<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with ${response.status}`);
  }

  return unwrapApiData<T>(payload);
}
