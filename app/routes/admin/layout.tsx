import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router";

import { AdminShell } from "~/components/blocks/admin-shell";
import { ApiError } from "~/lib/api/client";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import { clearSession, useStoredSession } from "~/lib/auth/session";

export function meta() {
  return [{ title: "FantaBeach Admin" }];
}

export default function AdminLayoutRoute() {
  const session = useStoredSession();
  const location = useLocation();
  const redirect = encodeURIComponent(location.pathname + location.search);

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => adminApi.me(),
    enabled: Boolean(session),
  });

  const isUnauthorized =
    meQuery.error instanceof ApiError && meQuery.error.code === "UNAUTHORIZED";

  useEffect(() => {
    if (isUnauthorized && session) {
      clearSession();
    }
  }, [isUnauthorized, session?.token]);

  if (!session) {
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (meQuery.isError) {
    const message =
      meQuery.error instanceof Error
        ? meQuery.error.message
        : "Session validation failed.";

    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {isUnauthorized ? "Session expired" : "Session validation failed"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              {isUnauthorized
                ? "Signing out and redirecting to login..."
                : message}
            </p>
            {!isUnauthorized ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void meQuery.refetch();
                }}
              >
                Retry
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (meQuery.isLoading) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading session</CardTitle>
          </CardHeader>
          <CardContent>Validating admin credentials...</CardContent>
        </Card>
      </main>
    );
  }

  return (
    <AdminShell session={session}>
      <Outlet />
    </AdminShell>
  );
}
