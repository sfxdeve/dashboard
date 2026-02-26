import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const overviewQuery = useQuery({
    queryKey: queryKeys.overview,
    queryFn: () => adminApi.getOverview(),
  });

  if (overviewQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Overview"
        description="Gathering tournament, match, scoring, and payment signals."
      />
    );
  }

  if (overviewQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Overview Unavailable"
        description="One or more admin datasets failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.overview,
          });
        }}
      />
    );
  }

  const overview = overviewQuery.data;
  if (!overview || overview.tournaments.length === 0) {
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
            value={overview.activeTournaments}
            icon={<TrophyIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Entry Lists Locked"
            value={overview.lockedEntryLists}
            icon={<LockIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Pending Matches"
            value={overview.pendingMatches}
            icon={<PlayCircleIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Completed Matches"
            value={overview.completedMatches}
            icon={<FlagIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/tournaments" className="block">
          <KpiCard
            label="Scoring Runs"
            value={overview.scoringRuns}
            icon={<ActivityIcon className="size-4" />}
          />
        </Link>
        <Link to="/admin/payments" className="block">
          <KpiCard
            label="Failed Payments"
            value={overview.failedPaymentEvents}
            icon={<SirenIcon className="size-4" />}
          />
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Tournament Integrity Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.tournaments.map((tournament) => (
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
