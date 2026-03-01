import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Trophy, Calendar, Medal, Clock } from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
import type { Tournament } from "~/lib/api/types";

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

const columnHelper = createColumnHelper<Tournament>();

const columns = [
  columnHelper.accessor("location", {
    header: "Location",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <Badge variant={STATUS_VARIANT[info.getValue()] ?? "outline"}>
        {info.getValue().replace("_", " ")}
      </Badge>
    ),
  }),
  columnHelper.accessor("startDate", {
    header: "Start Date",
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
  columnHelper.accessor("endDate", {
    header: "End Date",
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link to={`/admin/tournaments/${row.original._id}`} />}
      >
        View
      </Button>
    ),
  }),
];

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

  const table = useReactTable({
    data: recentTournaments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loadingTournaments ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No tournaments yet.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
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
