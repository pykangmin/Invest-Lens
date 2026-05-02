interface ApiEnvelope<T> {
  data?: T;
  error?: string;
}

export function unwrapApiData<T>(payload: ApiEnvelope<T>): T {
  if (payload.error) {
    throw new Error(payload.error);
  }

  if (payload.data === undefined) {
    throw new Error("API response did not include data.");
  }

  return payload.data;
}

export function assertTicker(value: string): string {
  const ticker = value.trim().toUpperCase();

  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
    throw new Error("Ticker must be an S&P 500 ticker symbol.");
  }

  return ticker;
}

export function normalizeSearchQuery(value: string): string {
  return value.trim().slice(0, 80);
}
