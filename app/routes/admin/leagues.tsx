import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { toast } from "sonner";

import { EntityTable } from "~/components/blocks/entity-table";
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
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
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
import type { LeagueMode, LeagueStatus } from "~/lib/api/types";
import { leagueSchema, toFieldErrors } from "~/lib/validation/admin";

const STATUS_ORDER: LeagueStatus[] = ["active", "paused", "completed"];

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

  const seasonsQuery = useQuery({
    queryKey: queryKeys.seasons,
    queryFn: () => adminApi.getSeasons(),
  });

  const leaguesQuery = useQuery({
    queryKey: queryKeys.leagues,
    queryFn: () => adminApi.getLeagues(),
  });

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isTieBreakerOpen, setIsTieBreakerOpen] = React.useState(false);
  const [seasonId, setSeasonId] = React.useState("s_2026");
  const [name, setName] = React.useState("New League");
  const [mode, setMode] = React.useState<LeagueMode>("overall");
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

  React.useEffect(() => {
    if (seasonsQuery.data?.[0]) {
      setSeasonId(seasonsQuery.data[0].id);
    }
  }, [seasonsQuery.data]);

  React.useEffect(() => {
    if (leaguesQuery.data?.[0] && !selectedLeagueId) {
      setSelectedLeagueId(leaguesQuery.data[0].id);
    }
  }, [leaguesQuery.data, selectedLeagueId]);

  React.useEffect(() => {
    const selected = (leaguesQuery.data ?? []).find(
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.leagues });
    if (selectedLeagueId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboard(selectedLeagueId),
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = leagueSchema.safeParse({ seasonId, name, mode });
      if (!parsed.success) {
        setCreateErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }

      setCreateErrors({});
      setCreateFormError(null);
      return adminApi.createLeague(parsed.data);
    },
    onSuccess: () => {
      toast.success("League created");
      setIsCreateOpen(false);
      refresh();
    },
    onError: (error) => {
      setCreateFormError(
        error instanceof Error ? error.message : "Failed to create league",
      );
    },
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
          void queryClient.invalidateQueries({ queryKey: queryKeys.seasons });
          void queryClient.invalidateQueries({ queryKey: queryKeys.leagues });
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
              Edit Tie-Breakers
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

      <EntityTable
        rows={leaguesQuery.data ?? []}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: "name",
            label: "League",
            render: (row) => (
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => setSelectedLeagueId(row.id)}
              >
                {row.name}
              </button>
            ),
          },
          {
            key: "mode",
            label: "Mode",
            render: (row) => row.mode.replaceAll("_", " "),
          },
          {
            key: "tieBreakers",
            label: "Tie-Breakers",
            render: (row) => row.tieBreakers.join(", "),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <StatusChip status={row.status} />,
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) => {
              const currentIndex = STATUS_ORDER.indexOf(row.status);
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
                        aria-label={`Open actions for ${row.name}`}
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
                          leagueId: row.id,
                          leagueName: row.name,
                          nextStatus,
                        })
                      }
                    >
                      Set {nextStatus}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setPendingAction({
                          type: "recompute",
                          leagueId: row.id,
                          leagueName: row.name,
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
        ]}
      />

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
            <EntityTable
              rows={leaderboardQuery.data ?? []}
              getRowKey={(row) => row.id}
              columns={[
                { key: "rank", label: "Rank", render: (row) => row.rank },
                {
                  key: "user",
                  label: "User",
                  render: (row) => row.displayName,
                },
                {
                  key: "points",
                  label: "Points",
                  render: (row) => row.totalPoints,
                },
                {
                  key: "tie",
                  label: "Tie-Break",
                  render: (row) => row.tieBreakerScore,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {(leaguesQuery.data ?? []).length === 0 ? (
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
              createMutation.mutate();
            }}
          >
            <NativeSelect
              value={seasonId}
              onChange={(event) => setSeasonId(event.target.value)}
              disabled={createMutation.isPending}
            >
              {(seasonsQuery.data ?? []).map((season) => (
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

            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="League name"
              disabled={createMutation.isPending}
            />
            {createErrors.name ? (
              <p className="text-destructive text-xs">{createErrors.name}</p>
            ) : null}

            <NativeSelect
              value={mode}
              onChange={(event) => setMode(event.target.value as LeagueMode)}
              disabled={createMutation.isPending}
            >
              <NativeSelectOption value="overall">Overall</NativeSelectOption>
              <NativeSelectOption value="head_to_head">
                Head to Head
              </NativeSelectOption>
            </NativeSelect>
            {createErrors.mode ? (
              <p className="text-destructive text-xs">{createErrors.mode}</p>
            ) : null}

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
            <SheetTitle>Edit Tie-Breakers</SheetTitle>
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
            <NativeSelect
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value)}
              disabled={tieBreakerMutation.isPending}
            >
              {(leaguesQuery.data ?? []).map((league) => (
                <NativeSelectOption key={league.id} value={league.id}>
                  {league.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            <Input
              value={tieBreakersInput}
              onChange={(event) => setTieBreakersInput(event.target.value)}
              placeholder="highest_player_score, match_dominance"
              disabled={tieBreakerMutation.isPending}
            />

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
                  : "Save Tie-Breakers"}
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
                ? `Set ${pendingAction.leagueName} to ${pendingAction.nextStatus}?`
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
