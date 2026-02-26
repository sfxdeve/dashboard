import { useEffect, useState } from "react";
import type { Session } from "~/lib/api/types";
import { getSession } from "~/lib/auth/session";

export function useSession() {
  const [session, setSessionState] = useState<Session | null>(() =>
    getSession(),
  );

  useEffect(() => {
    const handleStorageChange = () => {
      setSessionState(getSession());
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return session;
}
