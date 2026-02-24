import { useMemo } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIcon,
  ArrowRightIcon,
  FlagIcon,
  LockIcon,
  PlayCircleIcon,
  SirenIcon,
  TrophyIcon,
} from "lucide-react";
import { Link } from "react-router";

import { KpiCard } from "~/components/blocks/kpi-card";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { StatusChip } from "~/components/blocks/status-chip";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import { formatDateTimeForButton } from "~/lib/datetime";

function formatGenderLabel(gender: string) {
  return `${gender[0]?.toUpperCase() ?? ""}${gender.slice(1)}`;
}

export function meta() {
  return [{ title: "Admin Overview" }];
}

export default function AdminOverviewPage() {
  const queryClient = useQueryClient();
  const tournamentsQuery = useQuery({
    queryKey: queryKeys.tournaments(),
    queryFn: () => adminApi.getTournaments(),
  });

  const paymentQuery = useQuery({
    queryKey: queryKeys.paymentEvents(1, 100),
    queryFn: () => adminApi.getPaymentEvents({ page: 1, pageSize: 100 }),
  });

  const matchQueries = useQueries({
    queries: (tournamentsQuery.data ?? []).map((tournament) => ({
      queryKey: queryKeys.matches(tournament.id),
      queryFn: () => adminApi.getMatches(tournament.id),
    })),
  });

  const scoringQueries = useQueries({
    queries: (tournamentsQuery.data ?? []).map((tournament) => ({
      queryKey: queryKeys.scoringRuns(tournament.id),
      queryFn: () => adminApi.getScoringRuns(tournament.id),
    })),
  });

  const hasDependentLoading =
    matchQueries.some((query) => query.isLoading) ||
    scoringQueries.some((query) => query.isLoading);
  const hasDependentError =
    matchQueries.some((query) => query.isError) ||
    scoringQueries.some((query) => query.isError);

  const kpis = useMemo(() => {
    const tournaments = tournamentsQuery.data ?? [];
    const matches = matchQueries.flatMap((query) => query.data ?? []);
    const scoringRuns = scoringQueries.flatMap((query) => query.data ?? []);
    const paymentEvents = paymentQuery.data?.items ?? [];

    return {
      activeTournaments: tournaments.filter((item) =>
        ["open", "live", "entry_locked"].includes(item.status),
      ).length,
      lockedEntryLists: tournaments.filter((item) => item.entryListLocked)
        .length,
      pendingMatches: matches.filter(
        (item) => item.status === "scheduled" || item.status === "live",
      ).length,
      completedMatches: matches.filter((item) => item.status === "completed")
        .length,
      scoringRuns: scoringRuns.length,
      failedPaymentEvents: paymentEvents.filter(
        (item) => item.status === "rejected",
      ).length,
    };
  }, [
    matchQueries,
    paymentQuery.data?.items,
    scoringQueries,
    tournamentsQuery.data,
  ]);

  if (
    tournamentsQuery.isLoading ||
    paymentQuery.isLoading ||
    hasDependentLoading
  ) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Overview"
        description="Gathering tournament, match, scoring, and payment signals."
      />
    );
  }

  if (tournamentsQuery.isError || paymentQuery.isError || hasDependentError) {
    return (
      <QueryStateCard
        state="error"
        title="Overview Unavailable"
        description="One or more admin datasets failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.tournamentsRoot,
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.paymentEventsRoot,
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.matchesRoot,
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.scoringRunsRoot,
          });
        }}
      />
    );
  }

  if ((tournamentsQuery.data ?? []).length === 0) {
    return (
      <QueryStateCard
        state="empty"
        title="No Tournaments Found"
        description="Create a tournament to unlock operational KPIs."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Overview"
        description="Operational KPIs and integrity checkpoints across admin modules."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Active Tournaments"
            value={kpis.activeTournaments}
            icon={<TrophyIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Entry Lists Locked"
            value={kpis.lockedEntryLists}
            icon={<LockIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Pending Matches"
            value={kpis.pendingMatches}
            icon={<PlayCircleIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Completed Matches"
            value={kpis.completedMatches}
            icon={<FlagIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Scoring Runs"
            value={kpis.scoringRuns}
            icon={<ActivityIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/payments" className="block">
          <KpiCard
            label="Failed Payments"
            value={kpis.failedPaymentEvents}
            icon={<SirenIcon className="size-4" />}
          />
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Tournament Integrity Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(tournamentsQuery.data ?? []).map((tournament) => (
            <Link
              key={tournament.id}
              to={`/admin/tournaments/${tournament.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium">{tournament.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatGenderLabel(tournament.gender)} · Lock{" "}
                  {formatDateTimeForButton(
                    tournament.policy.lineupLockAt,
                    tournament.policy.timezone,
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={tournament.status} />
                <StatusChip
                  status={tournament.entryListLocked ? "locked" : "open"}
                />
                <ArrowRightIcon className="text-muted-foreground size-4" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
