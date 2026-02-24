import { Navigate } from "react-router";

import { useStoredSession } from "~/lib/auth/session";

export function meta() {
  return [{ title: "FantaBeach Admin" }];
}

export default function HomePage() {
  const session = useStoredSession();

  if (session) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/login" replace />;
}
