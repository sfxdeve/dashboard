import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Trophy, Calendar, Medal, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { HttpAdminApi } from "~/lib/api/http-admin-api";

const adminApi = new HttpAdminApi();

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  UPCOMING: "outline",
  REGISTRATION_OPEN: "secondary",
  LOCKED: "destructive",
  ONGOING: "default",
  COMPLETED: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  REGISTRATION_OPEN: "Open",
  LOCKED: "Locked",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
};

export function meta() {
  return [{ title: "Overview — FantaBeach Admin" }];
}

export default function OverviewPage() {
  const { data: tournamentsData, isLoading: loadingTournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => adminApi.getTournaments({ limit: 100 }),
  });

  const { data: championships, isLoading: loadingChampionships } = useQuery({
    queryKey: ["championships"],
    queryFn: () => adminApi.getChampionships(),
  });

  const { data: leaguesData, isLoading: loadingLeagues } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => adminApi.getLeagues({ limit: 100 }),
  });

  const tournaments = tournamentsData?.items ?? [];
  const ongoingCount = tournaments.filter((t) => t.status === "ONGOING").length;
  const upcomingCount = tournaments.filter(
    (t) => t.status === "UPCOMING" || t.status === "REGISTRATION_OPEN",
  ).length;

  const recentTournaments = tournaments.slice(0, 8);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Championships"
          value={championships?.length ?? 0}
          icon={Trophy}
          loading={loadingChampionships}
        />
        <StatCard
          title="Ongoing Tournaments"
          value={ongoingCount}
          icon={Calendar}
          loading={loadingTournaments}
        />
        <StatCard
          title="Upcoming"
          value={upcomingCount}
          icon={Clock}
          loading={loadingTournaments}
        />
        <StatCard
          title="Leagues"
          value={leaguesData?.meta.total ?? 0}
          icon={Medal}
          loading={loadingLeagues}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Recent Tournaments</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTournaments ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : recentTournaments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No tournaments yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentTournaments.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell>{t.location}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(t.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(t.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link to={`/admin/tournaments/${t._id}`} />}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
