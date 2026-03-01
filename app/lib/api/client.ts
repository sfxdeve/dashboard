import axios from "axios";
import { env } from "~/lib/env";
import { clearSession, getSessionToken } from "~/lib/auth/session";

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

function shouldHandleAuthFailure(url: string | undefined): boolean {
  if (!url) {
    return true;
  }

  return !(
    url.includes("/api/v1/auth/login") || url.includes("/api/v1/auth/logout")
  );
}

function handleAuthFailure() {
  clearSession();
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.pathname.startsWith("/login")) {
    return;
  }
  const redirect = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.assign(`/login?redirect=${redirect}`);
}

httpClient.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => {
    // Unwrap backend envelope: { success, data: T } → T
    // Paginated spread:        { success, items, meta } → { items, meta }
    const body = response.data as Record<string, unknown> | undefined;
    if (body && typeof body === "object" && body.success === true) {
      if ("items" in body) {
        response.data = { items: body.items, meta: body.meta };
      } else if ("data" in body) {
        response.data = body.data;
      }
    }
    return response;
  },
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

      const status = error.response?.status;
      if (
        (status === 401 || status === 403) &&
        shouldHandleAuthFailure(error.config?.url)
      ) {
        handleAuthFailure();
      }

      return Promise.reject(new ApiError(message, code, details, traceId));
    }

    return Promise.reject(new ApiError("Unexpected API failure"));
  },
);
