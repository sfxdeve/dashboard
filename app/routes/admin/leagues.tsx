import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { MoreHorizontalIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { StatusChip } from "~/components/blocks/status-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import type {
  LeaderboardRow,
  League,
  LeagueMode,
  LeagueStatus,
} from "~/lib/api/types";
import { leagueSchema, toFieldErrors } from "~/lib/validation/admin";

const STATUS_ORDER: LeagueStatus[] = ["active", "paused", "completed"];

function formatStatusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .split(" ")
    .map((word) =>
      word.length > 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word,
    )
    .join(" ");
}

type PendingLeagueAction =
  | {
      type: "status";
      leagueId: string;
      leagueName: string;
      nextStatus: LeagueStatus;
    }
  | { type: "recompute"; leagueId: string; leagueName: string }
  | null;

export function meta() {
  return [{ title: "Leagues" }];
}

export default function LeaguesPage() {
  const queryClient = useQueryClient();
  const [seasonPage, setSeasonPage] = React.useState(1);
  const [leaguePage, setLeaguePage] = React.useState(1);
  const pageSize = 20;

  const seasonsQuery = useQuery({
    queryKey: queryKeys.seasons(seasonPage, pageSize),
    queryFn: () => adminApi.getSeasons({ page: seasonPage, pageSize }),
  });

  const leaguesQuery = useQuery({
    queryKey: queryKeys.leagues(leaguePage, pageSize),
    queryFn: () => adminApi.getLeagues({ page: leaguePage, pageSize }),
  });

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isTieBreakerOpen, setIsTieBreakerOpen] = React.useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = React.useState("");
  const [tieBreakersInput, setTieBreakersInput] = React.useState(
    "highest_player_score, match_dominance",
  );
  const [createErrors, setCreateErrors] = React.useState<
    Record<string, string>
  >({});
  const [createFormError, setCreateFormError] = React.useState<string | null>(
    null,
  );
  const [tieBreakerError, setTieBreakerError] = React.useState<string | null>(
    null,
  );
  const [pendingAction, setPendingAction] =
    React.useState<PendingLeagueAction>(null);

  const createForm = useForm({
    defaultValues: {
      seasonId: "s_2026",
      name: "New League",
      mode: "overall" as LeagueMode,
    },
    onSubmit: async ({ value }) => {
      const parsed = leagueSchema.safeParse(value);
      if (!parsed.success) {
        setCreateErrors(toFieldErrors(parsed.error));
        setCreateFormError("Please correct the highlighted fields");
        return;
      }

      setCreateErrors({});
      setCreateFormError(null);
      try {
        await createMutation.mutateAsync(parsed.data);
        toast.success("League created");
        setIsCreateOpen(false);
        createForm.reset();
        refresh();
      } catch (error) {
        setCreateFormError(
          error instanceof Error ? error.message : "Failed to create league",
        );
      }
    },
  });

  React.useEffect(() => {
    if (seasonsQuery.data?.items?.[0]) {
      createForm.setFieldValue("seasonId", seasonsQuery.data.items[0].id);
    }
  }, [seasonsQuery.data]);

  React.useEffect(() => {
    if (leaguesQuery.data?.items?.[0] && !selectedLeagueId) {
      setSelectedLeagueId(leaguesQuery.data.items[0].id);
    }
  }, [leaguesQuery.data, selectedLeagueId]);

  React.useEffect(() => {
    const selected = (leaguesQuery.data?.items ?? []).find(
      (league) => league.id === selectedLeagueId,
    );
    if (!selected) {
      return;
    }

    setTieBreakersInput(selected.tieBreakers.join(", "));
  }, [leaguesQuery.data, selectedLeagueId]);

  const leaderboardQuery = useQuery({
    queryKey: queryKeys.leaderboard(selectedLeagueId),
    queryFn: () => adminApi.getLeagueLeaderboard(selectedLeagueId),
    enabled: Boolean(selectedLeagueId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.leagues() });
    if (selectedLeagueId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboard(selectedLeagueId),
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: adminApi.createLeague,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      leagueId,
      status,
    }: {
      leagueId: string;
      status: LeagueStatus;
    }) => adminApi.updateLeague(leagueId, { status }),
    onSuccess: () => {
      toast.success("League updated");
      setPendingAction(null);
      refresh();
    },
  });

  const tieBreakerMutation = useMutation({
    mutationFn: () => {
      const tieBreakers = tieBreakersInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (tieBreakers.length === 0) {
        throw new Error("At least one tie-breaker is required");
      }

      return adminApi.updateLeague(selectedLeagueId, { tieBreakers });
    },
    onSuccess: () => {
      toast.success("Tie-breakers updated");
      setIsTieBreakerOpen(false);
      setTieBreakerError(null);
      refresh();
    },
    onError: (error) => {
      setTieBreakerError(
        error instanceof Error
          ? error.message
          : "Failed to update tie-breakers",
      );
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: (leagueId: string) => adminApi.recomputeLeague(leagueId),
    onSuccess: () => {
      toast.success("Leaderboard recomputed");
      setPendingAction(null);
      refresh();
    },
  });

  const isAnyMutationPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    tieBreakerMutation.isPending ||
    recomputeMutation.isPending;

  const leagueColumns = React.useMemo<ColumnDef<League>[]>(
    () => [
      {
        accessorKey: "name",
        header: "League",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left underline-offset-2 hover:underline"
            onClick={() => setSelectedLeagueId(row.original.id)}
          >
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: "mode",
        header: "Mode",
        cell: ({ row }) => row.original.mode.replaceAll("_", " "),
      },
      {
        accessorKey: "tieBreakers",
        header: "Tie-breakers",
        cell: ({ row }) => row.original.tieBreakers.join(", "),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const currentIndex = STATUS_ORDER.indexOf(row.original.status);
          const nextStatus =
            STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={isAnyMutationPending}
                    aria-label={`Open actions for ${row.original.name}`}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    setPendingAction({
                      type: "status",
                      leagueId: row.original.id,
                      leagueName: row.original.name,
                      nextStatus,
                    })
                  }
                >
                  Set status to {formatStatusLabel(nextStatus)}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setPendingAction({
                      type: "recompute",
                      leagueId: row.original.id,
                      leagueName: row.original.name,
                    })
                  }
                >
                  Recompute
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [isAnyMutationPending],
  );

  const leaderboardColumns = React.useMemo<ColumnDef<LeaderboardRow>[]>(
    () => [
      { accessorKey: "rank", header: "Rank" },
      { accessorKey: "displayName", header: "User" },
      { accessorKey: "totalPoints", header: "Points" },
      { accessorKey: "tieBreakerScore", header: "Tie-break" },
    ],
    [],
  );

  const leagueTable = useReactTable({
    data: leaguesQuery.data?.items ?? [],
    columns: leagueColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const leaderboardTable = useReactTable({
    data: leaderboardQuery.data ?? [],
    columns: leaderboardColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  if (seasonsQuery.isLoading || leaguesQuery.isLoading) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Leagues"
        description="Fetching seasons, leagues, and leaderboard context."
      />
    );
  }

  if (seasonsQuery.isError || leaguesQuery.isError) {
    return (
      <QueryStateCard
        state="error"
        title="Leagues Unavailable"
        description="Failed to load league management data."
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.seasons() });
          void queryClient.invalidateQueries({ queryKey: queryKeys.leagues() });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="League Engine"
        description="Manage overall and head-to-head leagues with tie-breakers and leaderboard recomputation."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsTieBreakerOpen(true)}
              disabled={!selectedLeagueId || isAnyMutationPending}
            >
              <Settings2Icon />
              Edit Tie-breakers
            </Button>
            <Button
              onClick={() => setIsCreateOpen(true)}
              disabled={isAnyMutationPending}
            >
              <PlusIcon />
              New League
            </Button>
          </div>
        }
      />

      <Table>
        <TableHeader>
          {leagueTable.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {leagueTable.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="text-muted-foreground py-8 text-center"
                colSpan={leagueColumns.length}
              >
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            leagueTable.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard ({selectedLeagueId || "-"})</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboardQuery.isLoading ? (
            <QueryStateCard
              state="loading"
              title="Loading Leaderboard"
              description="Fetching computed league standings."
            />
          ) : leaderboardQuery.isError ? (
            <QueryStateCard
              state="error"
              title="Leaderboard Unavailable"
              description="Could not load the selected league leaderboard."
              onRetry={() => {
                if (selectedLeagueId) {
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.leaderboard(selectedLeagueId),
                  });
                }
              }}
            />
          ) : (leaderboardQuery.data ?? []).length === 0 ? (
            <QueryStateCard
              state="empty"
              title="Leaderboard Empty"
              description="Run scoring and recompute the league to populate standings."
            />
          ) : (
            <Table>
              <TableHeader>
                {leaderboardTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {leaderboardTable.getRowModel().rows.map((row) => (
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(leaguesQuery.data?.items.length ?? 0) === 0 ? (
        <QueryStateCard
          state="empty"
          title="No Leagues Configured"
          description="Create a league to begin leaderboard operations."
        />
      ) : null}

      <Dialog
        open={isCreateOpen}
        onOpenChange={(nextOpen) => {
          if (!createMutation.isPending) {
            setIsCreateOpen(nextOpen);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create League</DialogTitle>
            <DialogDescription>
              Create a new league tied to a season and mode.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createForm.handleSubmit();
            }}
          >
            <createForm.Field name="seasonId">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="league-season">Season</Label>
                  <NativeSelect
                    id="league-season"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={createMutation.isPending}
                  >
                    {(seasonsQuery.data?.items ?? []).map((season) => (
                      <NativeSelectOption key={season.id} value={season.id}>
                        {season.year} - {season.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {createErrors.seasonId ? (
                    <p className="text-destructive text-xs">
                      {createErrors.seasonId}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            <createForm.Field name="name">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="league-name">League Name</Label>
                  <Input
                    id="league-name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="League name"
                    disabled={createMutation.isPending}
                  />
                  {createErrors.name ? (
                    <p className="text-destructive text-xs">
                      {createErrors.name}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            <createForm.Field name="mode">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="league-mode">League Mode</Label>
                  <NativeSelect
                    id="league-mode"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value as LeagueMode)
                    }
                    disabled={createMutation.isPending}
                  >
                    <NativeSelectOption value="overall">
                      Overall
                    </NativeSelectOption>
                    <NativeSelectOption value="head_to_head">
                      Head-to-head
                    </NativeSelectOption>
                  </NativeSelect>
                  {createErrors.mode ? (
                    <p className="text-destructive text-xs">
                      {createErrors.mode}
                    </p>
                  ) : null}
                </div>
              )}
            </createForm.Field>

            {createFormError ? (
              <p className="text-destructive text-xs">{createFormError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create League"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={isTieBreakerOpen}
        onOpenChange={(nextOpen) => {
          if (!tieBreakerMutation.isPending) {
            setIsTieBreakerOpen(nextOpen);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Tie-breakers</SheetTitle>
            <SheetDescription>
              Comma-separated list, in priority order.
            </SheetDescription>
          </SheetHeader>

          <form
            className="space-y-3 px-4"
            onSubmit={(event) => {
              event.preventDefault();
              tieBreakerMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="tie-breaker-league">League</Label>
              <NativeSelect
                id="tie-breaker-league"
                value={selectedLeagueId}
                onChange={(event) => setSelectedLeagueId(event.target.value)}
                disabled={tieBreakerMutation.isPending}
              >
                {(leaguesQuery.data?.items ?? []).map((league) => (
                  <NativeSelectOption key={league.id} value={league.id}>
                    {league.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tie-breakers">Tie-breakers</Label>
              <Input
                id="tie-breakers"
                value={tieBreakersInput}
                onChange={(event) => setTieBreakersInput(event.target.value)}
                placeholder="highest_player_score, match_dominance"
                disabled={tieBreakerMutation.isPending}
              />
            </div>

            {tieBreakerError ? (
              <p className="text-destructive text-xs">{tieBreakerError}</p>
            ) : null}

            <SheetFooter className="px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTieBreakerOpen(false)}
                disabled={tieBreakerMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={tieBreakerMutation.isPending || !selectedLeagueId}
              >
                {tieBreakerMutation.isPending
                  ? "Saving..."
                  : "Save Tie-breakers"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (
            !updateMutation.isPending &&
            !recomputeMutation.isPending &&
            !open
          ) {
            setPendingAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "status"
                ? "Confirm status change"
                : "Confirm leaderboard recompute"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "status"
                ? `Set ${pendingAction.leagueName} to ${formatStatusLabel(pendingAction.nextStatus)}?`
                : pendingAction
                  ? `Recompute leaderboard for ${pendingAction.leagueName}?`
                  : "Confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAnyMutationPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isAnyMutationPending || !pendingAction}
              onClick={() => {
                if (!pendingAction) {
                  return;
                }

                if (pendingAction.type === "status") {
                  updateMutation.mutate({
                    leagueId: pendingAction.leagueId,
                    status: pendingAction.nextStatus,
                  });
                  return;
                }

                recomputeMutation.mutate(pendingAction.leagueId);
              }}
            >
              {isAnyMutationPending ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
