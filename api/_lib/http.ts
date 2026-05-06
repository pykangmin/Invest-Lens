export interface ApiRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader?(name: string, value: string): void;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function assertGet(req: ApiRequest, res: ApiResponse): boolean {
  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return false;
  }

  return true;
}

export function sendData<T>(res: ApiResponse, data: T): void {
  res.status(200).json({ data });
}

export function sendError(
  res: ApiResponse,
  error: unknown,
  fallbackStatus = 500,
): void {
  const status = error instanceof ApiError ? error.statusCode : fallbackStatus;
  // Vercel Function Logs 에 항상 기록 — production 진단용
  if (status >= 500) {
    console.error("[api error]", error);
  }
  const message =
    error instanceof Error && (error instanceof ApiError || status < 500)
      ? error.message
      : "Internal server error.";

  res.status(status).json({ error: message });
}

export function getQueryString(
  req: ApiRequest,
  key: string,
  fallback = "",
): string {
  const value = req.query?.[key];

  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

export function getQueryInt(
  req: ApiRequest,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = getQueryString(req, key, String(fallback));
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function normalizeTicker(value: string): string {
  const ticker = value.trim().toUpperCase();

  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(ticker)) {
    throw new ApiError("Invalid ticker.", 400);
  }

  return ticker;
}
