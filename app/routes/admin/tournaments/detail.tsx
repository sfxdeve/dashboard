import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { KpiCard } from "~/components/blocks/kpi-card";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import { cn } from "~/lib/utils";

export function meta() {
  return [{ title: "Tournament Detail" }];
}

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const queryClient = useQueryClient();

  const tournamentQuery = useQuery({
    queryKey: queryKeys.tournament(tournamentId),
    queryFn: () => adminApi.getTournament(tournamentId),
  });

  const entryListQuery = useQuery({
    queryKey: queryKeys.entryList(tournamentId),
    queryFn: () => adminApi.getEntryList(tournamentId),
  });

  const matchesQuery = useQuery({
    queryKey: queryKeys.matches(tournamentId),
    queryFn: () => adminApi.getMatches(tournamentId),
  });

  const scoringRunsQuery = useQuery({
    queryKey: queryKeys.scoringRuns(tournamentId),
    queryFn: () => adminApi.getScoringRuns(tournamentId),
  });

  const tournament = tournamentQuery.data;

  if (
    tournamentQuery.isLoading ||
    entryListQuery.isLoading ||
    matchesQuery.isLoading ||
    scoringRunsQuery.isLoading
  ) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Tournament"
        description="Fetching tournament summary, Entry List, matches, and scoring runs."
      />
    );
  }

  if (
    tournamentQuery.isError ||
    entryListQuery.isError ||
    matchesQuery.isError ||
    scoringRunsQuery.isError
  ) {
    return (
      <QueryStateCard
        state="error"
        title="Tournament Unavailable"
        description="Unable to load one or more tournament datasets."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.tournament(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.entryList(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.matches(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.scoringRuns(tournamentId),
          });
        }}
      />
    );
  }

  if (!tournament) {
    return (
      <QueryStateCard
        state="empty"
        title="Tournament Missing"
        description="This tournament could not be found in the current environment."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tournament?.name ?? "Tournament"}
        description="Tournament summary, integrity status, and module navigation."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Entry Pairs" value={entryListQuery.data?.length ?? 0} />
        <KpiCard label="Matches" value={matchesQuery.data?.length ?? 0} />
        <KpiCard
          label="Completed Matches"
          value={
            (matchesQuery.data ?? []).filter(
              (item) => item.status === "completed",
            ).length
          }
        />
        <KpiCard
          label="Scoring Runs"
          value={scoringRunsQuery.data?.length ?? 0}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Quick Navigation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            className={cn(buttonVariants({ variant: "outline" }))}
            to={`/admin/tournaments/${tournamentId}/entry-list`}
          >
            Entry List
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "outline" }))}
            to={`/admin/tournaments/${tournamentId}/matches`}
          >
            Matches
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "outline" }))}
            to={`/admin/tournaments/${tournamentId}/bracket`}
          >
            Bracket
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "outline" }))}
            to={`/admin/tournaments/${tournamentId}/scoring`}
          >
            Scoring
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "outline" }))}
            to={`/admin/tournaments/${tournamentId}/lineup`}
          >
            Lineup Policy
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
