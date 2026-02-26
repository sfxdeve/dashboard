import { Navigate } from "react-router";
import { useSession } from "~/hooks/use-session";

export function meta() {
  return [{ title: "FantaBeach Admin" }];
}

export default function HomePage() {
  const session = useSession();

  if (session) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/login" replace />;
}
