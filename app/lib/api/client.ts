import axios from "axios";

import { env } from "~/lib/env";
import { getSessionToken } from "~/lib/auth/session";

export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  traceId?: string;

  constructor(
    message: string,
    code = "API_ERROR",
    details?: Record<string, unknown>,
    traceId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.traceId = traceId;
  }
}

export const httpClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_API_TIMEOUT_MS,
});

httpClient.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const envelope = error.response?.data as
        | {
            code?: unknown;
            message?: unknown;
            details?: unknown;
            traceId?: unknown;
          }
        | undefined;

      const message =
        typeof envelope?.message === "string" &&
        envelope.message.trim().length > 0
          ? envelope.message
          : error.message || "Request failed";
      const code =
        typeof envelope?.code === "string" && envelope.code.trim().length > 0
          ? envelope.code
          : "API_ERROR";
      const details =
        envelope?.details && typeof envelope.details === "object"
          ? (envelope.details as Record<string, unknown>)
          : undefined;
      const traceId =
        typeof envelope?.traceId === "string" ? envelope.traceId : undefined;

      return Promise.reject(new ApiError(message, code, details, traceId));
    }

    return Promise.reject(new ApiError("Unexpected API failure"));
  },
);
