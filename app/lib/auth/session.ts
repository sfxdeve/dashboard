import { useSyncExternalStore } from "react";
import type { Session } from "~/lib/api/types";

const SESSION_STORAGE_KEY = "fantabeach_admin_session";
const SESSION_CHANGE_EVENT = "fantabeach:session-changed";
let cachedRawSession: string | null | undefined;
let cachedParsedSession: Session | null = null;

function canUseStorage() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function emitSessionChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

function parseSession(raw: string): Session | null {
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.user?.id || !parsed?.expiresAt) {
      return null;
    }

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (raw === cachedRawSession) {
    return cachedParsedSession;
  }

  cachedRawSession = raw;
  if (!raw) {
    cachedParsedSession = null;
    return null;
  }

  const parsed = parseSession(raw);
  if (!parsed) {
    cachedParsedSession = null;
    return null;
  }

  cachedParsedSession = parsed;
  return cachedParsedSession;
}

export function setSession(session: Session) {
  if (!canUseStorage()) {
    return;
  }

  const raw = JSON.stringify(session);
  window.localStorage.setItem(SESSION_STORAGE_KEY, raw);
  cachedRawSession = raw;
  cachedParsedSession = session;
  emitSessionChanged();
}

export function clearSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  cachedRawSession = null;
  cachedParsedSession = null;
  emitSessionChanged();
}

export function getSessionToken() {
  return getSession()?.token;
}

export function subscribeToSessionChange(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_STORAGE_KEY) {
      return;
    }

    cachedRawSession = undefined;
    listener();
  };

  window.addEventListener(SESSION_CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStoredSession() {
  return useSyncExternalStore(
    subscribeToSessionChange,
    () => getSession(),
    () => null,
  );
}
