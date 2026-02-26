import type { Session } from "~/lib/api/types";

const SESSION_STORAGE_KEY = "fantabeach_admin_session";

function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

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

function setSession(session: Session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function getSessionToken() {
  return getSession()?.token;
}

export { getSession, setSession, clearSession, getSessionToken };
