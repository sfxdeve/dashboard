import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2Icon } from "lucide-react";
import { useParams } from "react-router";
import { toast } from "sonner";

import { EntityTable } from "~/components/blocks/entity-table";
import { PageHeader } from "~/components/blocks/page-header";
import { QueryStateCard } from "~/components/blocks/query-state-card";
import { ScoringRunPanel } from "~/components/blocks/scoring-run-panel";
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
import { Input } from "~/components/ui/input";
import { adminApi } from "~/lib/api";
import { queryKeys } from "~/lib/api/query-keys";
import type { Match } from "~/lib/api/types";
import { scoringConfigSchema, toFieldErrors } from "~/lib/validation/admin";

function computeWinner(match: Match) {
  let setA = 0;
  let setB = 0;

  for (const set of match.setScores) {
    if (set.pairAScore > set.pairBScore) {
      setA += 1;
    } else if (set.pairBScore > set.pairAScore) {
      setB += 1;
    }
  }

  if (setA === setB) {
    return undefined;
  }

  return setA > setB ? match.pairAId : match.pairBId;
}

export function meta() {
  return [{ title: "Scoring" }];
}

export default function ScoringPage() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: queryKeys.scoringConfig(tournamentId),
    queryFn: () => adminApi.getScoringConfig(tournamentId),
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.scoringRuns(tournamentId),
    queryFn: () => adminApi.getScoringRuns(tournamentId),
  });

  const matchesQuery = useQuery({
    queryKey: queryKeys.matches(tournamentId),
    queryFn: () => adminApi.getMatches(tournamentId),
  });

  const entryListQuery = useQuery({
    queryKey: queryKeys.entryList(tournamentId),
    queryFn: () => adminApi.getEntryList(tournamentId),
  });

  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [confirmRecalcOpen, setConfirmRecalcOpen] = React.useState(false);

  const [basePointMultiplier, setBasePointMultiplier] = React.useState("1");
  const [bonusWin20, setBonusWin20] = React.useState("6");
  const [bonusWin21, setBonusWin21] = React.useState("3");
  const [configErrors, setConfigErrors] = React.useState<
    Record<string, string>
  >({});
  const [configFormError, setConfigFormError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!configQuery.data) {
      return;
    }

    setBasePointMultiplier(String(configQuery.data.basePointMultiplier));
    setBonusWin20(String(configQuery.data.bonusWin20));
    setBonusWin21(String(configQuery.data.bonusWin21));
  }, [configQuery.data]);

  const previewRows = React.useMemo(() => {
    const matches = (matchesQuery.data ?? []).filter(
      (item) => item.status === "completed",
    );
    const entries = entryListQuery.data ?? [];

    const pairToPlayers: Record<string, string[]> = {};
    entries.forEach((entry) => {
      pairToPlayers[entry.pair.id] = entry.pair.playerIds;
    });

    const pointsByPlayer = new Map<string, number>();
    const multiplier = Number.parseInt(basePointMultiplier, 10);
    const win20Bonus = Number.parseInt(bonusWin20, 10);
    const win21Bonus = Number.parseInt(bonusWin21, 10);

    for (const match of matches) {
      const firstTwoSets = match.setScores.slice(0, 2);
      let pairABase = 0;
      let pairBBase = 0;

      for (const set of firstTwoSets) {
        pairABase += set.pairAScore;
        pairBBase += set.pairBScore;
      }

      for (const playerId of pairToPlayers[match.pairAId] ?? []) {
        pointsByPlayer.set(
          playerId,
          (pointsByPlayer.get(playerId) ?? 0) + pairABase * multiplier,
        );
      }
      for (const playerId of pairToPlayers[match.pairBId] ?? []) {
        pointsByPlayer.set(
          playerId,
          (pointsByPlayer.get(playerId) ?? 0) + pairBBase * multiplier,
        );
      }

      const winnerPair = match.winnerPairId ?? computeWinner(match);
      if (winnerPair) {
        const bonus = match.setScores.length === 2 ? win20Bonus : win21Bonus;
        for (const playerId of pairToPlayers[winnerPair] ?? []) {
          pointsByPlayer.set(
            playerId,
            (pointsByPlayer.get(playerId) ?? 0) + bonus,
          );
        }
      }
    }

    return Array.from(pointsByPlayer.entries())
      .map(([playerId, points]) => ({ playerId, points }))
      .sort((a, b) => b.points - a.points);
  }, [
    basePointMultiplier,
    bonusWin20,
    bonusWin21,
    entryListQuery.data,
    matchesQuery.data,
  ]);

  const hasCompletedMatches = (matchesQuery.data ?? []).some(
    (item) => item.status === "completed",
  );
  const hasScoringRuns = (runsQuery.data ?? []).length > 0;

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.scoringConfig(tournamentId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.scoringRuns(tournamentId),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.leagues });
  };

  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      const parsed = scoringConfigSchema.safeParse({
        basePointMultiplier,
        bonusWin20,
        bonusWin21,
      });

      if (!parsed.success) {
        setConfigErrors(toFieldErrors(parsed.error));
        throw new Error("Please correct the highlighted fields");
      }

      setConfigErrors({});
      setConfigFormError(null);
      return adminApi.updateScoringConfig(tournamentId, parsed.data);
    },
    onSuccess: () => {
      toast.success("Scoring config updated");
      setIsConfigOpen(false);
      refresh();
    },
    onError: (error) => {
      setConfigFormError(
        error instanceof Error
          ? error.message
          : "Failed to update scoring config",
      );
    },
  });

  const runMutation = useMutation({
    mutationFn: () => adminApi.recalculateScoring(tournamentId),
    onSuccess: () => {
      toast.success("Scoring recalculation completed");
      setConfirmRecalcOpen(false);
      refresh();
    },
  });

  if (
    configQuery.isLoading ||
    runsQuery.isLoading ||
    matchesQuery.isLoading ||
    entryListQuery.isLoading
  ) {
    return (
      <QueryStateCard
        state="loading"
        title="Loading Scoring"
        description="Fetching scoring config, runs, matches, and entry list."
      />
    );
  }

  if (
    configQuery.isError ||
    runsQuery.isError ||
    matchesQuery.isError ||
    entryListQuery.isError
  ) {
    return (
      <QueryStateCard
        state="error"
        title="Scoring Unavailable"
        description="Scoring data failed to load."
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.scoringConfig(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.scoringRuns(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.matches(tournamentId),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.entryList(tournamentId),
          });
        }}
      />
    );
  }

  const isPending = updateConfigMutation.isPending || runMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scoring Engine"
        description="Configure deterministic scoring and execute recomputation runs."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsConfigOpen(true)}
              disabled={isPending}
            >
              <Settings2Icon />
              Edit Config
            </Button>
            <Button
              onClick={() => setConfirmRecalcOpen(true)}
              disabled={isPending}
            >
              Recalculate
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Dry-Run Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityTable
            rows={previewRows}
            getRowKey={(row) => row.playerId}
            columns={[
              { key: "player", label: "Player", render: (row) => row.playerId },
              {
                key: "points",
                label: "Projected Points",
                render: (row) => row.points,
              },
            ]}
            emptyMessage="No completed matches yet."
          />
        </CardContent>
      </Card>

      {hasCompletedMatches || hasScoringRuns ? (
        <ScoringRunPanel runs={runsQuery.data ?? []} />
      ) : (
        <QueryStateCard
          state="empty"
          title="No Scoring Activity Yet"
          description="Complete at least one match and run recalculation to generate scoring runs."
        />
      )}

      <Dialog
        open={isConfigOpen}
        onOpenChange={(nextOpen) => {
          if (!updateConfigMutation.isPending) {
            setIsConfigOpen(nextOpen);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Scoring Config</DialogTitle>
            <DialogDescription>
              Update multipliers and win bonuses used by scoring runs.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              updateConfigMutation.mutate();
            }}
          >
            <Input
              value={basePointMultiplier}
              onChange={(event) => setBasePointMultiplier(event.target.value)}
              placeholder="Base multiplier"
              disabled={updateConfigMutation.isPending}
            />
            {configErrors.basePointMultiplier ? (
              <p className="text-destructive text-xs">
                {configErrors.basePointMultiplier}
              </p>
            ) : null}

            <Input
              value={bonusWin20}
              onChange={(event) => setBonusWin20(event.target.value)}
              placeholder="2-0 bonus"
              disabled={updateConfigMutation.isPending}
            />
            {configErrors.bonusWin20 ? (
              <p className="text-destructive text-xs">
                {configErrors.bonusWin20}
              </p>
            ) : null}

            <Input
              value={bonusWin21}
              onChange={(event) => setBonusWin21(event.target.value)}
              placeholder="2-1 bonus"
              disabled={updateConfigMutation.isPending}
            />
            {configErrors.bonusWin21 ? (
              <p className="text-destructive text-xs">
                {configErrors.bonusWin21}
              </p>
            ) : null}

            {configFormError ? (
              <p className="text-destructive text-xs">{configFormError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfigOpen(false)}
                disabled={updateConfigMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateConfigMutation.isPending}>
                {updateConfigMutation.isPending ? "Saving..." : "Save Config"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmRecalcOpen}
        onOpenChange={(open) => {
          if (!runMutation.isPending) {
            setConfirmRecalcOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalculate scoring now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run a deterministic recomputation using the current
              config and completed matches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={runMutation.isPending}
              onClick={() => runMutation.mutate()}
            >
              {runMutation.isPending ? "Running..." : "Run Recalculation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
